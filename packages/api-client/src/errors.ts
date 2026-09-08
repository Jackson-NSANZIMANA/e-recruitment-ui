// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — typed error normalisation over the REAL error bodies
//
// The old version assumed one shape: `{ code, message }`. Nothing in this
// platform emits that. What actually exists, verified across fifteen
// controllers:
//
//   TRANSPORT / INFRASTRUCTURE   { error: 'CODE', detail?: string }
//                                (`detail` only on 4xx — `expose = status < 500`
//                                 discards it on every 5xx, so eight
//                                 caller-facing 503 hints are written and
//                                 silently thrown away)
//   BUSINESS OUTCOMES            { status: 'OUTCOME', ...outcome-specific }
//                                e.g. { status: 'CROSS_AGENCY_LOCKED',
//                                       lockedByAgency } and
//                                     { status: 'AGE_PENDING', currentStatus }
//   AND THREE INCOMPATIBLE 403s  { error:'FORBIDDEN', detail } from withAuth,
//                                { error:'FORBIDDEN' } from outcome branches,
//                                { status:'AGENCY_MISMATCH' } from
//                                biometric-service. No single discriminated
//                                union covers 403, which is why `kind:'forbidden'`
//                                below carries no payload it cannot guarantee.
//
// The distinction between `error` and `status` is LOAD-BEARING: a business
// outcome is something the officer did, an infrastructure fault is something we
// did, and showing one as the other is how a UI tells a user to retry a
// conflict forever. So both are read, and the discriminant is preserved.
// ══════════════════════════════════════════════════════════════════

/** Foreign-government systems. Expected to be briefly down; distinct; explainable. */
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

/**
 * A normalised failure. Discriminated on `kind`, so a caller must handle the
 * cases it cares about and cannot accidentally treat a conflict as an outage.
 */
export type NormalisedError =
  /** The session is gone. Sign-in is the only path forward. */
  | { readonly kind: 'unauthenticated'; readonly status: 401; readonly code: string }
  /**
   * Refused. Carries NO detail, because 403 has three incompatible bodies
   * platform-wide and promising a field that two of them lack would be a lie.
   */
  | { readonly kind: 'forbidden'; readonly status: 403; readonly code: string }
  /**
   * Not found. Deliberately BARE — the backend's 404 bodies carry no detail on
   * purpose: a sibling agency's real id and a nonexistent one return
   * byte-identical responses, and adding detail here would build the
   * cross-agency existence oracle the backend refused to build.
   */
  | { readonly kind: 'notFound'; readonly status: 404 }
  /**
   * A business conflict: the platform's state disagrees with the request.
   * `outcome` is the `status` field, and `data` keeps the outcome-specific
   * fields (`lockedByAgency`, `currentStatus`) the UI needs to explain it.
   */
  | { readonly kind: 'conflict'; readonly status: 409; readonly outcome: string; readonly data: Readonly<Record<string, unknown>> }
  /** The request body was wrong for this agency's mode (ADR-013) or invalid. */
  | { readonly kind: 'unprocessable'; readonly status: 422; readonly outcome: string; readonly data: Readonly<Record<string, unknown>> }
  /** A shape error. `detail` is present here and IS safe to show. */
  | { readonly kind: 'badRequest'; readonly status: 400; readonly code: string; readonly detail: string | null }
  /**
   * The agency does not support this lane at all — walk-in on RNP/RCS. A real,
   * permanent answer, not a fault, and the UI should hide the control rather
   than offer a retry.
   */
  | { readonly kind: 'unsupportedAgency'; readonly status: 501; readonly agency: string | null }
  /**
   * A named foreign-government outage. The ONLY retryable failure, and the only
   * one the UI can explain specifically and truthfully.
   */
  | { readonly kind: 'g2gUnavailable'; readonly status: 503; readonly authority: string }
  /** Our own fault. Never phrased as the user's problem. Detail is withheld upstream. */
  | { readonly kind: 'serverError'; readonly status: number; readonly code: string }
  /** The request never completed. Offline, DNS, TLS, a dropped socket. */
  | { readonly kind: 'network' }
  /** A 2xx whose body did not match the contract. Loud, because it is drift. */
  | { readonly kind: 'malformed'; readonly detail: string };

export class ApiError extends Error {
  readonly normalised: NormalisedError;

  constructor(normalised: NormalisedError, message: string) {
    super(message);
    this.name = 'ApiError';
    this.normalised = normalised;
  }

  /** True only for a named G2G 503. Nothing else in this platform may be retried. */
  get isRetryable(): boolean {
    return this.normalised.kind === 'g2gUnavailable';
  }
}

interface RawBody {
  readonly error?: unknown;
  readonly status?: unknown;
  readonly detail?: unknown;
}

/**
 * Turn a non-2xx response body into a `NormalisedError`.
 *
 * Reads BOTH discriminants because the platform genuinely uses both, and
 * `analyze-document.controller.ts` uniquely keys business outcomes on `error` —
 * so keying on one field alone would misread that controller entirely.
 */
export function normaliseErrorBody(httpStatus: number, body: unknown): NormalisedError {
  const raw: RawBody = body !== null && typeof body === 'object' ? (body as RawBody) : {};
  const errorCode = typeof raw.error === 'string' ? raw.error : null;
  const outcome = typeof raw.status === 'string' ? raw.status : null;
  const code = errorCode ?? outcome ?? 'UNKNOWN';
  const detail = typeof raw.detail === 'string' ? raw.detail : null;
  const data: Record<string, unknown> = {};
  if (body !== null && typeof body === 'object') {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (key !== 'status' && key !== 'error' && key !== 'detail') data[key] = value;
    }
  }

  if (httpStatus === 503 && G2G.has(code)) return { kind: 'g2gUnavailable', status: 503, authority: code };
  if (httpStatus === 401) return { kind: 'unauthenticated', status: 401, code };
  if (httpStatus === 403) return { kind: 'forbidden', status: 403, code };
  if (httpStatus === 404) return { kind: 'notFound', status: 404 };
  if (httpStatus === 409) return { kind: 'conflict', status: 409, outcome: code, data };
  if (httpStatus === 422) return { kind: 'unprocessable', status: 422, outcome: code, data };
  if (httpStatus === 400 || httpStatus === 413 || httpStatus === 415) {
    return { kind: 'badRequest', status: 400, code, detail };
  }
  if (httpStatus === 501) {
    const agency = typeof data['agency'] === 'string' ? data['agency'] : null;
    return { kind: 'unsupportedAgency', status: 501, agency };
  }
  // 502 is included here on purpose: an unreachable dependency is OUR outage,
  // and it is NOT retryable, because a refused connection is indistinguishable
  // from one that half-completed a write.
  return { kind: 'serverError', status: httpStatus, code };
}

/** A short, non-leaking summary for logs. Never contains a body or PII. */
export function describeError(normalised: NormalisedError): string {
  switch (normalised.kind) {
    case 'unauthenticated':
      return `401 ${normalised.code}`;
    case 'forbidden':
      return `403 ${normalised.code}`;
    case 'notFound':
      return '404';
    case 'conflict':
      return `409 ${normalised.outcome}`;
    case 'unprocessable':
      return `422 ${normalised.outcome}`;
    case 'badRequest':
      return `400 ${normalised.code}`;
    case 'unsupportedAgency':
      return `501 UNSUPPORTED_AGENCY${normalised.agency === null ? '' : ` (${normalised.agency})`}`;
    case 'g2gUnavailable':
      return `503 ${normalised.authority}`;
    case 'serverError':
      return `${normalised.status} ${normalised.code}`;
    case 'network':
      return 'network';
    case 'malformed':
      return `malformed: ${normalised.detail}`;
    default:
      return assertNever(normalised);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled error kind: ${JSON.stringify(value)}`);
}
