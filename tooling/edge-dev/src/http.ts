// ══════════════════════════════════════════════════════════════════
// edge-dev — the transport substrate
//
// A deliberately small mirror of the backend's `@usrp/shared-http` (ADR-005):
// zero dependencies, `node:http`, EXACT-PATH routing with no param syntax,
// cookies as a first-class result field (a `Record<string,string>` header map
// can express exactly one Set-Cookie, and every login here emits two), and
// `x-correlation-id` threaded through untouched.
//
// It is a mirror rather than an import because `tooling/` is outside the pnpm
// workspace and `@usrp/shared-http` lives in the other repo. The shapes are
// deliberately identical so the real BFF can delete this file and depend on
// the real substrate without touching a single route handler.
// ══════════════════════════════════════════════════════════════════

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface SetCookie {
  readonly name: string;
  readonly value: string;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: CookieSameSite;
  readonly path?: string;
  readonly domain?: string;
  readonly maxAgeSeconds?: number;
}

export interface HttpResult {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly cookies?: readonly SetCookie[];
}

export interface RequestContext {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies: ReadonlyMap<string, string>;
  /** Inbound `x-correlation-id`, or a fresh one. Never regenerated per hop. */
  readonly correlationId: string;
  /** Always fresh; echoed as `x-request-id`. */
  readonly requestId: string;
  json<T = unknown>(): Promise<T>;
}

export type RouteHandler = (ctx: RequestContext) => Promise<HttpResult> | HttpResult;

export interface Route {
  readonly method: string;
  readonly path: string;
  readonly handler: RouteHandler;
}

/** A caller-visible failure. `code` is the stable machine-readable half. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;

  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const HOST_COOKIE_PREFIX = '__Host-';

const COOKIE_NAME_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;
const COOKIE_OCTET_RE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;

/**
 * Render one Set-Cookie. Throws on a cookie a browser would SILENTLY DROP.
 *
 * The `__Host-` rules (Secure, Path=/, no Domain) are enforced rather than
 * documented for one reason: a dropped session cookie presents as "login does
 * nothing", the least debuggable failure available. Same hard line as
 * `shared-http/src/cookies.ts`, on purpose — the real BFF inherits that file
 * and must behave identically.
 */
export function serializeSetCookie(cookie: SetCookie): string {
  if (!COOKIE_NAME_RE.test(cookie.name)) {
    throw new Error(`Invalid cookie name ${JSON.stringify(cookie.name)}: must be an RFC 6265 token.`);
  }
  if (!COOKIE_OCTET_RE.test(cookie.value)) {
    throw new Error(
      `Invalid value for cookie "${cookie.name}": must be RFC 6265 cookie-octets. ` +
        'Refused rather than escaped — silently rewriting a credential is worse.',
    );
  }
  if (cookie.name.startsWith(HOST_COOKIE_PREFIX)) {
    if (cookie.secure !== true) {
      throw new Error(`Cookie "${cookie.name}": the __Host- prefix requires Secure; browsers drop it otherwise.`);
    }
    if (cookie.path !== '/') {
      throw new Error(`Cookie "${cookie.name}": the __Host- prefix requires Path=/; browsers drop it otherwise.`);
    }
    if (cookie.domain !== undefined) {
      throw new Error(`Cookie "${cookie.name}": the __Host- prefix FORBIDS Domain — host-locking is the point.`);
    }
  }
  if (cookie.sameSite === 'None' && cookie.secure !== true) {
    throw new Error(`Cookie "${cookie.name}": SameSite=None requires Secure.`);
  }

  const parts: string[] = [`${cookie.name}=${cookie.value}`];
  if (cookie.path !== undefined) parts.push(`Path=${cookie.path}`);
  if (cookie.domain !== undefined) parts.push(`Domain=${cookie.domain}`);
  if (cookie.maxAgeSeconds !== undefined) parts.push(`Max-Age=${cookie.maxAgeSeconds}`);
  if (cookie.sameSite !== undefined) parts.push(`SameSite=${cookie.sameSite}`);
  if (cookie.secure === true) parts.push('Secure');
  if (cookie.httpOnly === true) parts.push('HttpOnly');
  return parts.join('; ');
}

/** First occurrence wins — a duplicate name is the cookie-shadowing trick. */
export function parseCookieHeader(header: string | undefined): ReadonlyMap<string, string> {
  const jar = new Map<string, string>();
  if (header === undefined || header.length === 0) return jar;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name.length === 0 || jar.has(name)) continue;
    let value = pair.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    jar.set(name, value);
  }
  return jar;
}

export interface CorsPolicy {
  /** Exact-match allow-list. Never a pattern. */
  readonly origins: readonly string[];
  readonly credentials: boolean;
}

export interface EdgeServerOptions {
  readonly serviceName: string;
  readonly port: number;
  readonly host?: string;
  readonly routes: readonly Route[];
  readonly cors: CorsPolicy;
  readonly maxBodyBytes?: number;
}

export interface RunningServer {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
}

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'content-type, x-csrf-token, x-correlation-id';
const EXPOSED_HEADERS = 'x-request-id, x-correlation-id';

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Boot the edge. Preflight is answered by the transport and never reaches a
 * route, so an OPTIONS handler cannot be forgotten on a new endpoint.
 */
export function startEdgeServer(options: EdgeServerOptions): Promise<RunningServer> {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const table = new Map<string, Map<string, RouteHandler>>();
  for (const route of options.routes) {
    if (route.path.includes(':') || route.path.includes('*')) {
      // The whole point of invariant 1 — refuse the shape rather than support it.
      throw new Error(`Route "${route.path}" looks templated. This substrate matches EXACT paths only.`);
    }
    const byMethod = table.get(route.path) ?? new Map<string, RouteHandler>();
    byMethod.set(route.method.toUpperCase(), route.handler);
    table.set(route.path, byMethod);
  }

  const server: Server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = randomUUID();
    const rawHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const single = headerString(value);
      if (single !== undefined) rawHeaders[key.toLowerCase()] = single;
    }
    const correlationId = rawHeaders['x-correlation-id'] ?? randomUUID();
    const origin = rawHeaders['origin'];
    const originAllowed = origin !== undefined && options.cors.origins.includes(origin);

    const baseHeaders: Record<string, string> = {
      'x-request-id': requestId,
      'x-correlation-id': correlationId,
      // Vary: Origin even on a REJECTED origin, or a shared cache can be
      // poisoned into replaying one origin's ACAO header to another.
      vary: 'Origin',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    };
    if (originAllowed && origin !== undefined) {
      baseHeaders['access-control-allow-origin'] = origin;
      if (options.cors.credentials) baseHeaders['access-control-allow-credentials'] = 'true';
      baseHeaders['access-control-expose-headers'] = EXPOSED_HEADERS;
    }

    const url = new URL(req.url ?? '/', 'http://internal');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.writeHead(originAllowed ? 204 : 403, {
        ...baseHeaders,
        'access-control-allow-methods': ALLOWED_METHODS,
        'access-control-allow-headers': ALLOWED_HEADERS,
        'access-control-max-age': '600',
        vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      });
      res.end();
      return;
    }

    const byMethod = table.get(path);
    if (byMethod === undefined) {
      send(res, 404, { error: 'NOT_FOUND' }, baseHeaders);
      return;
    }
    const handler = byMethod.get(method);
    if (handler === undefined) {
      send(res, 405, { error: 'METHOD_NOT_ALLOWED' }, { ...baseHeaders, allow: [...byMethod.keys()].join(', ') });
      return;
    }

    let cached: unknown;
    let parsed = false;
    const ctx: RequestContext = {
      method,
      path,
      query: url.searchParams,
      headers: rawHeaders,
      cookies: parseCookieHeader(rawHeaders['cookie']),
      correlationId,
      requestId,
      async json<T>(): Promise<T> {
        if (parsed) return cached as T;
        const body = await readBody(req, maxBodyBytes);
        if (body.length === 0) throw new HttpError(400, 'EMPTY_BODY', 'A JSON body is required.');
        try {
          cached = JSON.parse(body.toString('utf8'));
        } catch {
          throw new HttpError(400, 'MALFORMED_JSON', 'Body is not valid JSON.');
        }
        parsed = true;
        return cached as T;
      },
    };

    try {
      const result = await handler(ctx);
      const headers: Record<string, string> = { ...baseHeaders, ...(result.headers ?? {}) };
      if (result.cookies !== undefined && result.cookies.length > 0) {
        res.setHeader('set-cookie', result.cookies.map(serializeSetCookie));
      }
      send(res, result.status, result.body, headers);
    } catch (err) {
      if (err instanceof HttpError) {
        // 5xx detail is withheld from the caller and logged instead — same
        // `expose = status < 500` rule the backend transport applies.
        const body =
          err.status < 500 && err.detail !== undefined
            ? { error: err.code, detail: err.detail }
            : { error: err.code };
        send(res, err.status, body, baseHeaders);
        return;
      }
      process.stderr.write(
        `${JSON.stringify({ level: 'error', service: options.serviceName, requestId, correlationId, path, message: String(err) })}\n`,
      );
      send(res, 500, { error: 'INTERNAL_ERROR' }, baseHeaders);
    }
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host ?? '127.0.0.1', () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : options.port;
      resolve({
        url: `http://127.0.0.1:${boundPort}`,
        port: boundPort,
        stop: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections?.();
          }),
      });
    });
  });
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string>): void {
  if (body === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the limit.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
