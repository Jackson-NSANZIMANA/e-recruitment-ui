// ══════════════════════════════════════════════════════════════════
// edge-dev — the browser-boundary scrubber (INVARIANT 2)
//
// `nationalIdHash` is an internal cross-service key. The raw National ID is
// request-only. Neither may reach a browser. The backend already holds that
// line at every controller it owns — but "every current controller is careful"
// is not the same guarantee as "the boundary cannot pass it", and the edge is
// the last place to make it the second kind.
//
// This is a BELT, not the braces. The braces are the contract's negative
// fixtures (44 of them, rejecting exactly these keys in response schemas). The
// belt exists because the edge outlives any one schema version: a field added
// upstream tomorrow ships to production before anyone regenerates a client.
//
// It COUNTS what it strips and the count is asserted in the selfcheck. A
// silent filter is how a leak becomes permanent: the leak stops being visible
// without ever being fixed.
// ══════════════════════════════════════════════════════════════════

/**
 * Keys refused on anything travelling to a browser.
 *
 * `nationalId` is here as well as `nationalIdHash`: the raw value is
 * request-only, so its presence in a RESPONSE is a defect regardless of which
 * direction it came from.
 */
export const FORBIDDEN_RESPONSE_KEYS: readonly string[] = [
  'nationalIdHash',
  'nationalId',
  'rawNationalId',
  // Upstream credentials. `sessionToken` is the exact key
  // POST /v1/applicants/auth/otp/verify returns — the edge consumes it and the
  // browser must never see it.
  'sessionToken',
  'token',
  'accessToken',
  'clientSecret',
  'password',
  // ADR-018: the phone is fetched live from NIDA and never stored. It must not
  // become durable by way of a browser cache either.
  'registeredPhoneNumber',
  'phoneNumber',
  'phoneNumberHash',
  'otp',
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_RESPONSE_KEYS);

export interface ScrubReport {
  /** Dotted paths that were removed. Empty is the expected state. */
  readonly violations: readonly string[];
}

export interface ScrubResult<T> {
  readonly value: T;
  readonly report: ScrubReport;
}

/**
 * Deep-copy `value`, dropping every forbidden key at any depth, and report
 * what was dropped.
 *
 * Recurses through arrays and plain objects only. A `Date`/`Buffer`/class
 * instance is passed through untouched: rebuilding one would silently change
 * its meaning, and none of them appear in a JSON wire body anyway.
 */
export function scrubForBrowser<T>(value: T): ScrubResult<T> {
  const violations: string[] = [];
  const scrubbed = walk(value, '$', violations) as T;
  return { value: scrubbed, report: { violations } };
}

function walk(value: unknown, path: string, violations: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => walk(item, `${path}[${index}]`, violations));
  }
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN.has(key)) {
      violations.push(`${path}.${key}`);
      continue;
    }
    out[key] = walk(child, `${path}.${key}`, violations);
  }
  return out;
}

/** Running tally, so the selfcheck can assert the belt actually engaged. */
export class ScrubCounter {
  private total = 0;
  private readonly paths: string[] = [];

  record(report: ScrubReport): void {
    if (report.violations.length === 0) return;
    this.total += report.violations.length;
    for (const violation of report.violations) {
      if (!this.paths.includes(violation)) this.paths.push(violation);
      // Loud on stderr: an upstream that started returning a forbidden key is
      // a backend defect, and a dev tool that hides it is complicit.
      process.stderr.write(
        `${JSON.stringify({ level: 'warn', event: 'edge.response.forbidden_key_stripped', path: violation })}\n`,
      );
    }
  }

  snapshot(): { readonly total: number; readonly paths: readonly string[] } {
    return { total: this.total, paths: [...this.paths] };
  }
}
