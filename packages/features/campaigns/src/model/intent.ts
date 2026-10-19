// ══════════════════════════════════════════════════════════════════
// campaigns — one Idempotency-Key per officer intent
//
// PURE given its UUID source. Every campaign write needs a key, and the rule
// that makes a retry safe is that the SAME intent reuses the SAME key while a
// CHANGED intent gets a new one (the edge answers 409/422 when one key is
// spent on two different bodies). The Studio holds one IntentKey per form.
// ══════════════════════════════════════════════════════════════════

export interface IntentKey {
  /** The key to send with this intent. */
  readonly key: string;
  /** Canonical JSON of the body the key was minted for. */
  readonly fingerprint: string;
}

/** Stable JSON: object keys sorted, so field order never changes the intent. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * The key for `body`: the previous one when the intent is unchanged (a retry),
 * a fresh one when it changed or there was none.
 */
export function keyForIntent(previous: IntentKey | null, body: unknown, newUuid: () => string): IntentKey {
  const fingerprint = canonicalJson(body);
  if (previous !== null && previous.fingerprint === fingerprint) return previous;
  return { key: newUuid(), fingerprint };
}
