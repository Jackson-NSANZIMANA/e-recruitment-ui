// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — the transport
//
// What changed from the old client, and why each change is not cosmetic:
//
//   • It takes an OPERATION ID, not a path. There is no `get(path)` to call with
//     an interpolated string, so the exact-path invariant is enforced by the
//     function signature rather than by reviewer vigilance.
//   • It sends the CSRF double-submit header on every unsafe request. Without it
//     every write 403s, which is the correct default: forgetting the header must
//     break loudly in development, not silently weaken CSRF in production.
//   • It sends `x-correlation-id` and lets the caller supply one, so a browser
//     action stitches to the backend events and Kafka trace it causes. The
//     backend already threads this header; we inherit it rather than invent a
//     second id nobody can join on.
//   • There is NO `Authorization` header and no code path that could add one.
//     The officer JWT and the citizen opaque token live at the edge.
//   • `patch` and `del` are GONE. Not one route in the platform accepts either
//     verb; keeping helpers for them invited exactly the fictional generic PATCH
//     this rewrite deletes.
// ══════════════════════════════════════════════════════════════════

import { ApiError, normaliseErrorBody, type NormalisedError } from './errors.js';
import { operation, type EdgeOperation } from './paths.js';
import { withRetry, type RetryPolicy, DEFAULT_RETRY_POLICY } from './retry.js';

export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_COOKIE_SECURE = '__Host-usrp_csrf';
export const CSRF_COOKIE_DEV = 'usrp_csrf_dev';
export const CORRELATION_HEADER = 'x-correlation-id';

export interface ApiClientOptions {
  /** The EDGE base URL — e.g. "http://localhost:4021". Never a service port. */
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
  /** Reads the readable CSRF echo cookie. Injectable for tests. */
  readonly readCsrfToken?: () => string | null;
  /** Mints a correlation id per browser action. Injectable for tests. */
  readonly newCorrelationId?: () => string;
  readonly retryPolicy?: RetryPolicy;
  /** Observability hook. Receives ids and codes only — never a body. */
  readonly onRequest?: (record: RequestRecord) => void;
}

export interface RequestRecord {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly status: number | null;
  readonly correlationId: string;
  readonly durationMs: number;
  readonly error: string | null;
}

export interface CallOptions {
  /** Query params. GET single-record reads use `?applicationId=` (ADR-005). */
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /**
   * Reuse a correlation id across several calls belonging to ONE user action, so
   * the whole action is one trace instead of five unrelated ones.
   */
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
}

function defaultReadCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  for (const pair of document.cookie.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name === CSRF_COOKIE_SECURE || name === CSRF_COOKIE_DEV) return pair.slice(eq + 1).trim();
  }
  return null;
}

function defaultCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ApiClient {
  /**
   * Invoke an operation by ID.
   *
   * There is deliberately no path parameter. The registry owns every path, so a
   * caller cannot build one — which is the mechanism, not a stylistic choice.
   */
  readonly call: <T>(operationId: string, options?: CallOptions) => Promise<T>;
  readonly baseUrl: string;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetchImpl ?? fetch;
  const readCsrf = options.readCsrfToken ?? defaultReadCsrfToken;
  const newCorrelationId = options.newCorrelationId ?? defaultCorrelationId;
  const retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;

  const callOnce = async <T>(edgeOperation: EdgeOperation, correlationId: string, callOptions: CallOptions): Promise<T> => {
    const url = new URL(edgeOperation.edgePath, options.baseUrl);
    for (const [key, value] of Object.entries(callOptions.query ?? {})) url.searchParams.set(key, value);

    const headers: Record<string, string> = { accept: 'application/json', [CORRELATION_HEADER]: correlationId };
    const isUnsafe = edgeOperation.method === 'POST';
    if (isUnsafe) {
      const token = readCsrf();
      // Sent when present; absent means the write will 403 at the edge. That is
      // the intended failure: a missing CSRF token must break, visibly.
      if (token !== null) headers[CSRF_HEADER] = token;
      headers['content-type'] = 'application/json';
    }

    const started = Date.now();
    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        method: edgeOperation.method,
        // The cookie IS the credential and the browser attaches it.
        credentials: 'include',
        headers,
        ...(isUnsafe ? { body: JSON.stringify(callOptions.body ?? {}) } : {}),
        ...(callOptions.signal !== undefined ? { signal: callOptions.signal } : {}),
      });
    } catch {
      const normalised: NormalisedError = { kind: 'network' };
      options.onRequest?.({
        operationId: edgeOperation.id, method: edgeOperation.method, path: edgeOperation.edgePath,
        status: null, correlationId, durationMs: Date.now() - started, error: 'network',
      });
      throw new ApiError(normalised, 'The request could not be sent. Check your connection.');
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (response.ok) {
          const normalised: NormalisedError = { kind: 'malformed', detail: 'a 2xx response was not JSON' };
          throw new ApiError(normalised, 'The server returned an unexpected response.');
        }
      }
    }

    if (!response.ok) {
      const normalised = normaliseErrorBody(response.status, parsed);
      options.onRequest?.({
        operationId: edgeOperation.id, method: edgeOperation.method, path: edgeOperation.edgePath,
        status: response.status, correlationId, durationMs: Date.now() - started, error: normalised.kind,
      });
      throw new ApiError(normalised, `${edgeOperation.id} failed with ${response.status}.`);
    }

    options.onRequest?.({
      operationId: edgeOperation.id, method: edgeOperation.method, path: edgeOperation.edgePath,
      status: response.status, correlationId, durationMs: Date.now() - started, error: null,
    });
    return (response.status === 204 ? ({} as T) : (parsed as T));
  };

  return {
    baseUrl: options.baseUrl,
    call: async <T>(operationId: string, callOptions: CallOptions = {}): Promise<T> => {
      const edgeOperation = operation(operationId);
      const correlationId = callOptions.correlationId ?? newCorrelationId();
      return withRetry(
        () => callOnce<T>(edgeOperation, correlationId, callOptions),
        // The registry decides, not the call site. A write cannot opt itself in.
        edgeOperation.retryOnG2G,
        retryPolicy,
      );
    },
  };
}
