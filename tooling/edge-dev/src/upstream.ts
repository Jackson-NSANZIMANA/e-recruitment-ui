// ══════════════════════════════════════════════════════════════════
// edge-dev — upstream calls, fan-out, and the G2G retry rule
//
// Three things happen here and nowhere else:
//
//   1. THE CREDENTIAL IS ATTACHED SERVER-SIDE. The browser sent a handle; the
//      session store turned it into an officer JWT or a citizen session token;
//      this file puts it in an `Authorization` header the browser never saw.
//
//   2. `x-correlation-id` IS INHERITED, NEVER MINTED. The backend already
//      threads it through every controller and seeds it into the Kafka event
//      context, so one browser click and every event it causes share one trace
//      id. Generating a fresh id per hop would sever exactly the join that makes
//      the trail readable — so the inbound id is forwarded verbatim.
//
//   3. RETRY IS SCOPED TO G2G FAULTS AND NOTHING ELSE. NIDA/NESA/RIB/HEC are
//      other people's systems on a government VPN; they are expected to be
//      briefly unavailable, and that is a DIFFERENT event from our own service
//      failing. Retrying a 500 would double-submit a write. Retrying a 409 is
//      nonsense. So the rule is: 503 with a recognised G2G code, GET or an
//      explicitly idempotent POST, twice, with backoff. Everything else fails
//      once and fails honestly.
// ══════════════════════════════════════════════════════════════════

import { HttpError } from './http.ts';
import type { UpstreamCredential } from './session-store.ts';

/**
 * 503 codes that mean "a foreign government system is down".
 *
 * Transcribed from the backend's `mapDomainError` bodies. Each is a distinct,
 * user-explainable outage: telling a citizen "the national ID registry is
 * briefly unavailable, your application is untouched" is a different sentence
 * from "something went wrong", and only the first one is true.
 */
export const G2G_UNAVAILABLE_CODES: readonly string[] = [
  'NIDA_UNAVAILABLE',
  'NESA_UNAVAILABLE',
  'RIB_UNAVAILABLE',
  'HEC_UNAVAILABLE',
  'SCANNER_UNAVAILABLE',
  'ELIGIBILITY_STORE_UNAVAILABLE',
  'UPSTREAM_UNAVAILABLE',
] as const;

const G2G = new Set<string>(G2G_UNAVAILABLE_CODES);

export interface UpstreamResponse {
  readonly status: number;
  readonly body: unknown;
  readonly correlationId: string | null;
}

export interface UpstreamRequest {
  readonly baseUrl: string;
  readonly method: 'GET' | 'POST';
  /** EXACT path. Never built by interpolation — see `paths` in @usrp/api-client. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly credential?: UpstreamCredential | { readonly kind: 'system'; readonly token: string };
  readonly correlationId: string;
  /**
   * Whether a retried call is safe. GETs are always safe; a POST must OPT IN,
   * and only the read-shaped ones do (identity verify is idempotent by
   * design — it answers ALREADY_EXISTS). No transition ever opts in.
   */
  readonly retryable?: boolean;
}

const RETRY_BACKOFF_MS: readonly number[] = [100, 400];

export async function callUpstream(request: UpstreamRequest): Promise<UpstreamResponse> {
  const attempts = request.retryable === true ? RETRY_BACKOFF_MS.length + 1 : 1;
  let last: UpstreamResponse | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await once(request);
    if (!isG2GFault(last)) return last;
    const delay = RETRY_BACKOFF_MS[attempt];
    if (delay === undefined) break;
    await sleep(delay);
  }
  return last as UpstreamResponse;
}

/** A 503 whose code names a foreign system — the only retryable failure. */
export function isG2GFault(response: UpstreamResponse): boolean {
  if (response.status !== 503) return false;
  const code = errorCodeOf(response.body);
  return code !== null && G2G.has(code);
}

/**
 * Pull the machine-readable code out of a body.
 *
 * The platform has TWO shapes and they are not interchangeable: transport and
 * infrastructure faults key on `error`, business outcomes key on `status`.
 * `analyze-document.controller.ts` is the sole controller that keys business
 * outcomes on `error` too, which is why this reads both rather than picking one.
 */
export function errorCodeOf(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const error = record['error'];
  if (typeof error === 'string') return error;
  const status = record['status'];
  if (typeof status === 'string') return status;
  return null;
}

async function once(request: UpstreamRequest): Promise<UpstreamResponse> {
  const url = new URL(request.path, request.baseUrl);
  for (const [key, value] of Object.entries(request.query ?? {})) url.searchParams.set(key, value);

  const headers: Record<string, string> = {
    accept: 'application/json',
    // Inherited, not minted. This is the join to the Kafka trace.
    'x-correlation-id': request.correlationId,
  };
  if (request.credential !== undefined) {
    headers['authorization'] = `Bearer ${request.credential.token}`;
  }
  if (request.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    });
  } catch (err) {
    // A dead upstream is OUR outage, not a G2G one — 502, and not retried,
    // because we cannot tell a refused connection from one that half-completed.
    throw new HttpError(502, 'UPSTREAM_UNREACHABLE', `Could not reach ${request.baseUrl}${request.path}`, );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: 'UPSTREAM_MALFORMED_BODY' };
    }
  }
  return {
    status: response.status,
    body,
    correlationId: response.headers.get('x-correlation-id'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ── System tokens (ADR-016) ────────────────────────────────────

interface CachedSystemToken {
  readonly token: string;
  readonly expiresAtMs: number;
}

/**
 * Client-credentials system tokens, cached and re-fetched on expiry.
 *
 * The edge needs one because THREE routes the browser must reach are
 * `kind:'system'` upstream: `GET /v1/applications/by-applicant`,
 * `POST /v1/applications/withdraw-own`, and `POST /v1/identities/verify` for
 * the citizen lane. identity-service already does exactly this and ADR-018
 * calls it dogfooding ADR-016 — the edge inherits the pattern rather than
 * inventing a fourth kind of credential.
 *
 * TTL is 15 minutes upstream; refreshed at 60s of margin so an in-flight
 * request cannot straddle the expiry.
 */
export class SystemTokenProvider {
  private cached: CachedSystemToken | null = null;
  // Written out rather than declared as constructor parameter properties: those
  // are NOT erasable TypeScript, and this tool must run under a bare
  // `node --experimental-strip-types` with no build step and no install.
  private readonly iamBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(iamBaseUrl: string, clientId: string, clientSecret: string) {
    this.iamBaseUrl = iamBaseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async token(correlationId: string, nowMs: number = Date.now()): Promise<string> {
    if (this.cached !== null && this.cached.expiresAtMs - 60_000 > nowMs) return this.cached.token;

    const response = await callUpstream({
      baseUrl: this.iamBaseUrl,
      method: 'POST',
      path: '/v1/auth/service/token',
      body: { clientId: this.clientId, clientSecret: this.clientSecret },
      correlationId,
    });
    if (response.status !== 200) {
      // The edge's own machine identity is broken. This is never the citizen's
      // fault, so it must not surface as a 401 that asks them to log in again.
      throw new HttpError(502, 'EDGE_SYSTEM_TOKEN_UNAVAILABLE', 'The edge could not authenticate to iam-service.');
    }
    const body = response.body as { token?: unknown; expiresAt?: unknown };
    if (typeof body.token !== 'string' || typeof body.expiresAt !== 'string') {
      throw new HttpError(502, 'EDGE_SYSTEM_TOKEN_MALFORMED', 'iam-service returned an unexpected token body.');
    }
    this.cached = { token: body.token, expiresAtMs: Date.parse(body.expiresAt) };
    return body.token;
  }

  /** Drop the cache — used by the selfcheck to prove a re-fetch happens. */
  invalidate(): void {
    this.cached = null;
  }
}

// ── Fan-out ────────────────────────────────────────────────────

/**
 * Run several upstream reads concurrently and keep every result, failure
 * included.
 *
 * `Promise.all` is WRONG for an aggregate read: one 404 on a secondary panel
 * would discard a successful primary payload and turn a mostly-complete screen
 * into a blank error page. The aggregation rule is: the PRIMARY read's failure
 * is the response's failure; a SECONDARY read's failure is reported as a
 * per-panel `null` plus a named partial, so the UI can render what exists and
 * say honestly which panel is missing.
 */
export async function fanOut<T extends Record<string, UpstreamRequest>>(
  requests: T,
): Promise<{ readonly [K in keyof T]: UpstreamResponse | { readonly failed: true; readonly reason: string } }> {
  const entries = Object.entries(requests) as [keyof T & string, UpstreamRequest][];
  const settled = await Promise.allSettled(entries.map(([, request]) => callUpstream(request)));

  const out = {} as Record<string, UpstreamResponse | { failed: true; reason: string }>;
  settled.forEach((result, index) => {
    const entry = entries[index];
    if (entry === undefined) return;
    const [key] = entry;
    out[key] =
      result.status === 'fulfilled'
        ? result.value
        : { failed: true, reason: result.reason instanceof HttpError ? result.reason.code : 'UPSTREAM_ERROR' };
  });
  return out as { readonly [K in keyof T]: UpstreamResponse | { readonly failed: true; readonly reason: string } };
}
