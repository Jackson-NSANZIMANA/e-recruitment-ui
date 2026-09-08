// ══════════════════════════════════════════════════════════════════
// edge-dev — the edge surface the browser is allowed to see
//
// Every path here is EXACT. Ids travel in a body (POST) or a query param (GET),
// exactly as upstream, for one reason worth stating: if the edge restored
// `/applications/:id` ergonomics, `@usrp/api-client` would grow interpolated
// URLs, the build guard would have to permit them, and the guard is the only
// thing standing between this codebase and the class of bug invariant 1 exists
// to prevent. One rule everywhere beats a rule with an exception.
//
// FOUR officer transitions are exposed, not three. `accept` is ADR-014's
// cross-agency lock — the write that stops one citizen being accepted by two
// agencies. Ship the console without it and someone hand-rolls a raw fetch for
// the most safety-critical write in the platform inside a week.
//
// WHAT THIS FILE DOES NOT DO: enforce agency isolation. It ASSERTS the officer's
// agency (rejecting a session whose agency does not match this deployment) and
// then forwards the officer's own credential, under which Postgres RLS does the
// enforcing. The assertion is defence in depth and a clean error message. It is
// not the control.
// ══════════════════════════════════════════════════════════════════

import { HttpError, type RequestContext, type Route, type HttpResult } from './http.ts';
import {
  assertCsrfDoubleSubmit,
  assertOriginPinned,
  clearedCookies,
  cookieNames,
  csrfCookie,
  sessionCookie,
  type CookieNames,
} from './csrf.ts';
import { EdgeSessionStore, type EdgeSession, type SessionKind } from './session-store.ts';
import { ScrubCounter, scrubForBrowser } from './redact.ts';
import { callUpstream, errorCodeOf, fanOut, SystemTokenProvider, type UpstreamResponse } from './upstream.ts';
import { upstreamRoute } from './upstream-routes.ts';
import type { EdgeConfig } from './config.ts';

export interface EdgeContext {
  readonly config: EdgeConfig;
  readonly store: EdgeSessionStore;
  readonly names: CookieNames;
  readonly scrubs: ScrubCounter;
  readonly systemTokens: SystemTokenProvider;
}

export function createEdgeContext(config: EdgeConfig): EdgeContext {
  return {
    config,
    store: new EdgeSessionStore(config.session),
    names: cookieNames(config.cookieSecure),
    scrubs: new ScrubCounter(),
    systemTokens: new SystemTokenProvider(
      config.upstream.iam,
      config.systemClient.clientId,
      config.systemClient.clientSecret,
    ),
  };
}

// ── Session resolution ──────────────────────────────────────────

/**
 * Resolve the caller's session or throw ONE 401.
 *
 * Every rejection reason — no cookie, unknown handle, idle timeout, absolute
 * ceiling, revoked — collapses to the same body. The reason is genuinely useful
 * to the UI (a timeout deserves different copy from a revocation), and it is
 * still refused here, because a handle-probing attacker learns from the
 * difference and an honest user learns nothing they cannot see from the clock.
 * The UI gets its distinction from `GET /edge/v1/session` BEFORE expiry, not
 * from the 401 after it.
 */
function requireSession(ctx: RequestContext, edge: EdgeContext, kind: SessionKind): EdgeSession {
  const handle = ctx.cookies.get(edge.names.session);
  const lookup = edge.store.touch(handle);
  if (!lookup.ok) {
    throw new HttpError(401, 'NO_SESSION', 'Sign in to continue.');
  }
  if (lookup.session.credential.kind !== kind) {
    // An applicant session on an officer route is not "forbidden", it is
    // unauthenticated FOR THIS SURFACE. 403 would confirm the route exists to
    // a citizen who has no business knowing.
    throw new HttpError(401, 'NO_SESSION', 'Sign in to continue.');
  }
  assertCsrfDoubleSubmit(ctx, edge.store, lookup.session, edge.names);
  return lookup.session;
}

function requireOfficer(ctx: RequestContext, edge: EdgeContext): EdgeSession & { credential: { kind: 'officer' } } {
  assertOriginPinned(ctx, edge.config.corsOrigins);
  const session = requireSession(ctx, edge, 'officer');
  if (session.credential.kind !== 'officer') throw new HttpError(401, 'NO_SESSION', 'Sign in to continue.');

  if (edge.config.deployment.kind === 'agency' && session.credential.agency !== edge.config.deployment.agency) {
    // Presentational, not security: RLS would refuse the rows anyway. This
    // turns a confusing empty list into a clear message.
    throw new HttpError(403, 'WRONG_AGENCY_DEPLOYMENT', 'This console serves a different agency.');
  }
  return session as EdgeSession & { credential: { kind: 'officer' } };
}

function requireApplicant(ctx: RequestContext, edge: EdgeContext): EdgeSession {
  assertOriginPinned(ctx, edge.config.corsOrigins);
  return requireSession(ctx, edge, 'applicant');
}

// ── Response shaping ────────────────────────────────────────────

/**
 * Hand an upstream response to the browser, scrubbed.
 *
 * Status is passed through unchanged. The edge's job is to remove credentials
 * and internal keys, not to re-interpret outcomes: a 409 `CROSS_AGENCY_LOCKED`
 * flattened into a generic 400 would cost the officer the one fact that
 * explains what happened.
 */
function relay(edge: EdgeContext, response: UpstreamResponse): HttpResult {
  const { value, report } = scrubForBrowser(response.body);
  edge.scrubs.record(report);
  return { status: response.status, body: value };
}

function requireUuidQuery(ctx: RequestContext, name: string): string {
  const value = ctx.query.get(name)?.trim() ?? '';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID.test(value)) throw new HttpError(400, `INVALID_${name.toUpperCase()}`, `Query "${name}" must be a UUID.`);
  return value;
}

// ── Routes ──────────────────────────────────────────────────────

export function edgeRoutes(edge: EdgeContext): readonly Route[] {
  const { config, store, names, scrubs } = edge;
  const idle = config.session.idleTtlSeconds;
  const secure = config.cookieSecure;

  const officerLogin: Route = {
    method: 'POST',
    path: '/edge/v1/auth/officer/login',
    handler: async (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      const body = await ctx.json<{ loginHandle?: unknown; password?: unknown }>();
      if (typeof body.loginHandle !== 'string' || body.loginHandle.length === 0 || body.loginHandle.length > 128) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "loginHandle" is required.');
      }
      if (typeof body.password !== 'string' || body.password.length === 0 || body.password.length > 256) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "password" is required.');
      }

      const route = upstreamRoute('officerLogin');
      const response = await callUpstream({
        baseUrl: config.upstream.iam,
        method: route.method,
        path: route.path,
        body: { loginHandle: body.loginHandle, password: body.password },
        correlationId: ctx.correlationId,
      });

      if (response.status !== 200) {
        // ONE rejection. iam-service already collapses unknown handle, wrong
        // password and DISABLED ACCOUNT into one 401 INVALID_CREDENTIALS; the
        // edge must not widen it, and neither may the UI.
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid handle or password.');
      }
      const upstream = response.body as { token?: unknown; expiresAt?: unknown };
      if (typeof upstream.token !== 'string' || typeof upstream.expiresAt !== 'string') {
        throw new HttpError(502, 'UPSTREAM_MALFORMED_BODY', 'iam-service returned an unexpected login body.');
      }

      const claims = readJwtClaims(upstream.token);
      const { handle, csrfToken } = store.create({
        kind: 'officer',
        token: upstream.token,
        expiresAt: upstream.expiresAt,
        agency: claims.agency ?? 'UNKNOWN',
        roles: claims.roles,
        subject: claims.subject ?? 'unknown',
      });

      // 204 with cookies, NOT 200 with a body. There is nothing safe to return:
      // the token stays here, and the contract's negative fixtures already
      // reject a user object on the officer login response.
      return {
        status: 204,
        cookies: [sessionCookie(names, handle, idle, secure), csrfCookie(names, csrfToken, idle, secure)],
      };
    },
  };

  const officerLogout: Route = {
    method: 'POST',
    path: '/edge/v1/auth/officer/logout',
    handler: (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      // Deliberately does NOT require a valid session: logout must always
      // succeed and always clear, or a user with a broken session can never
      // get back to a clean state.
      store.revoke(ctx.cookies.get(names.session));
      return { status: 204, cookies: clearedCookies(names, secure) };
    },
  };

  const otpRequest: Route = {
    method: 'POST',
    path: '/edge/v1/auth/applicant/otp/request',
    handler: async (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      const body = await ctx.json<{ nationalId?: unknown; channel?: unknown }>();
      if (typeof body.nationalId !== 'string' || body.nationalId.trim().length === 0 || body.nationalId.length > 32) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "nationalId" is required.');
      }
      const channel = typeof body.channel === 'string' ? body.channel : 'WEB';

      const route = upstreamRoute('requestApplicantOtp');
      const response = await callUpstream({
        baseUrl: config.upstream.identity,
        method: route.method,
        path: route.path,
        body: { nationalId: body.nationalId, channel },
        correlationId: ctx.correlationId,
        // Idempotent by design and G2G-dependent (it reads NIDA live), so this
        // is one of the few POSTs where a 503 retry is correct.
        retryable: true,
      });

      if (response.status === 202) {
        // BYTE-IDENTICAL. Real send, unknown NID, unverified identity and a
        // phoneless NIDA record all land here and must be indistinguishable —
        // including body, including status, including headers we control.
        return { status: 202, body: { status: 'CHALLENGED' } };
      }
      // A G2G outage is NOT an enumeration signal: it is independent of whether
      // the NID exists, so surfacing it distinctly leaks nothing and is the only
      // way the UI can say something true.
      return relay(edge, response);
    },
  };

  const otpVerify: Route = {
    method: 'POST',
    path: '/edge/v1/auth/applicant/otp/verify',
    handler: async (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      const body = await ctx.json<{ nationalId?: unknown; otp?: unknown; channel?: unknown }>();
      if (typeof body.nationalId !== 'string' || body.nationalId.trim().length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "nationalId" is required.');
      }
      if (typeof body.otp !== 'string' || body.otp.length === 0 || body.otp.length > 12) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "otp" is required.');
      }
      const channel = typeof body.channel === 'string' ? body.channel : 'WEB';

      const route = upstreamRoute('verifyApplicantOtp');
      const response = await callUpstream({
        baseUrl: config.upstream.identity,
        method: route.method,
        path: route.path,
        body: { nationalId: body.nationalId, otp: body.otp, channel },
        correlationId: ctx.correlationId,
      });

      if (response.status !== 200) {
        // ONE 401 for no challenge, expired, LOCKED OUT, wrong code and replay.
        // The 5-attempt lockout is real and the UI must communicate it from its
        // OWN attempt counter, never by reading a distinguishing response —
        // there isn't one, on purpose.
        if (response.status === 401) throw new HttpError(401, 'INVALID_OTP', 'That code is not valid.');
        return relay(edge, response);
      }

      const upstream = response.body as { sessionToken?: unknown; expiresAt?: unknown };
      if (typeof upstream.sessionToken !== 'string' || typeof upstream.expiresAt !== 'string') {
        throw new HttpError(502, 'UPSTREAM_MALFORMED_BODY', 'identity-service returned an unexpected verify body.');
      }

      const { handle, csrfToken } = store.create({
        kind: 'applicant',
        token: upstream.sessionToken,
        expiresAt: upstream.expiresAt,
      });
      // The opaque session token dies here. This is the single reason the edge
      // is not optional: ADR-018 chose a revocable token so it could be killed,
      // and a token living in JS is revocable in theory and stolen in practice.
      return {
        status: 204,
        cookies: [sessionCookie(names, handle, idle, secure), csrfCookie(names, csrfToken, idle, secure)],
      };
    },
  };

  const applicantLogout: Route = {
    method: 'POST',
    path: '/edge/v1/auth/applicant/logout',
    handler: async (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      const handle = ctx.cookies.get(names.session);
      const existing = store.peek(handle);
      if (existing !== undefined && existing.credential.kind === 'applicant') {
        const route = upstreamRoute('logoutApplicant');
        // Revoke UPSTREAM first: dropping only the edge session would leave a
        // live citizen session in identity-service that nothing can now reach.
        await callUpstream({
          baseUrl: config.upstream.identity,
          method: route.method,
          path: route.path,
          credential: existing.credential,
          correlationId: ctx.correlationId,
        });
      }
      store.revoke(handle);
      return { status: 204, cookies: clearedCookies(names, secure) };
    },
  };

  const session: Route = {
    method: 'GET',
    path: '/edge/v1/session',
    handler: (ctx) => {
      const lookup = store.touch(ctx.cookies.get(names.session));
      if (!lookup.ok) return { status: 401, body: { error: 'NO_SESSION' } };
      // `view()` structurally cannot return the upstream token. This replaces
      // the `/auth/me` fiction: same job, real data, no invented endpoint.
      return { status: 200, body: store.view(lookup.session) };
    },
  };

  const refresh: Route = {
    method: 'POST',
    path: '/edge/v1/session/refresh',
    handler: (ctx) => {
      assertOriginPinned(ctx, config.corsOrigins);
      const lookup = store.touch(ctx.cookies.get(names.session));
      if (!lookup.ok) return { status: 401, body: { error: 'NO_SESSION' }, cookies: clearedCookies(names, secure) };
      assertCsrfDoubleSubmit(ctx, store, lookup.session, names);
      const handle = ctx.cookies.get(names.session) ?? '';
      // Re-issue the cookie so the browser's Max-Age slides with the server's
      // idle window. Without this the cookie expires while the session lives.
      return {
        status: 200,
        body: store.view(lookup.session),
        cookies: [sessionCookie(names, handle, idle, secure), csrfCookie(names, lookup.session.csrfToken, idle, secure)],
      };
    },
  };

  // ── Officer reads ──
  const officerGet = (path: string, operationId: string, query?: string): Route => ({
    method: 'GET',
    path,
    handler: async (ctx) => {
      const officer = requireOfficer(ctx, edge);
      const route = upstreamRoute(operationId);
      const response = await callUpstream({
        baseUrl: config.upstream[route.service],
        method: 'GET',
        path: route.path,
        ...(query !== undefined ? { query: { [query]: requireUuidQuery(ctx, query) } } : {}),
        credential: officer.credential,
        correlationId: ctx.correlationId,
        retryable: true,
      });
      return relay(edge, response);
    },
  });

  // ── Officer writes ──
  const officerPost = (path: string, operationId: string): Route => ({
    method: 'POST',
    path,
    handler: async (ctx) => {
      const officer = requireOfficer(ctx, edge);
      const body = await ctx.json<Record<string, unknown>>();
      const route = upstreamRoute(operationId);
      const response = await callUpstream({
        baseUrl: config.upstream[route.service],
        method: 'POST',
        path: route.path,
        body,
        credential: officer.credential,
        correlationId: ctx.correlationId,
        // NEVER retryable. A retried transition is a double write, and
        // `POST /v1/field-sync/scores` already proves this platform can answer
        // 200 on a batch where every record was rejected.
        retryable: false,
      });
      return relay(edge, response);
    },
  });

  /**
   * The aggregation rule, demonstrated.
   *
   * The console's detail screen needs two upstream reads that no single endpoint
   * provides. PRIMARY (`by-id`) failing is the response failing. SECONDARY
   * (`status-history`) failing degrades to `history: null` plus a named
   * `partial`, so the screen renders and says which panel is missing instead of
   * showing a blank error page because a side panel 404'd.
   */
  const applicationDetail: Route = {
    method: 'GET',
    path: '/edge/v1/applications/detail',
    handler: async (ctx) => {
      const officer = requireOfficer(ctx, edge);
      const applicationId = requireUuidQuery(ctx, 'applicationId');
      const byId = upstreamRoute('findApplicationById');
      const history = upstreamRoute('getApplicationStatusHistory');

      const results = await fanOut({
        application: {
          baseUrl: config.upstream[byId.service],
          method: 'GET' as const,
          path: byId.path,
          query: { applicationId },
          credential: officer.credential,
          correlationId: ctx.correlationId,
          retryable: true,
        },
        history: {
          baseUrl: config.upstream[history.service],
          method: 'GET' as const,
          path: history.path,
          query: { applicationId },
          credential: officer.credential,
          correlationId: ctx.correlationId,
          retryable: true,
        },
      });

      const primary = results.application;
      if ('failed' in primary) throw new HttpError(502, primary.reason, 'Could not load the application.');
      if (primary.status !== 200) return relay(edge, primary);

      const secondary = results.history;
      const partials: string[] = [];
      let historyBody: unknown = null;
      if ('failed' in secondary) {
        partials.push('history');
      } else if (secondary.status === 200) {
        historyBody = secondary.body;
      } else {
        partials.push('history');
      }

      const { value, report } = scrubForBrowser({
        application: primary.body,
        history: historyBody,
        partial: partials,
      });
      scrubs.record(report);
      return { status: 200, body: value };
    },
  };

  /**
   * Officer-driven NIDA identity verification (ADR-012 D1).
   *
   * The contract marks this route `service-internal`, but ADR-012 widened it to
   * accept officer principals for exactly this flow, so the OFFICER's own
   * credential is forwarded rather than the edge's system token — the officer's
   * action must be attributable to the officer, and a system token would make
   * every walk-in registration in the audit trail look like it came from the
   * edge.
   */
  const verifyIdentity: Route = {
    method: 'POST',
    path: '/edge/v1/identities/verify',
    handler: async (ctx) => {
      const officer = requireOfficer(ctx, edge);
      const body = await ctx.json<{ nationalId?: unknown; channel?: unknown }>();
      if (typeof body.nationalId !== 'string' || body.nationalId.trim().length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Field "nationalId" is required.');
      }
      const route = upstreamRoute('verifyIdentity');
      const response = await callUpstream({
        baseUrl: config.upstream[route.service],
        method: 'POST',
        path: route.path,
        body: { nationalId: body.nationalId, channel: typeof body.channel === 'string' ? body.channel : 'WALK_IN' },
        credential: officer.credential,
        correlationId: ctx.correlationId,
        // Idempotent upstream: a repeat answers 200 ALREADY_EXISTS rather than
        // creating a second identity, so a G2G retry is safe here.
        retryable: true,
      });
      return relay(edge, response);
    },
  };

  // ── Citizen self-service ──
  const applicantGet = (path: string, operationId: string): Route => ({
    method: 'GET',
    path,
    handler: async (ctx) => {
      const applicant = requireApplicant(ctx, edge);
      const route = upstreamRoute(operationId);
      const response = await callUpstream({
        baseUrl: config.upstream[route.service],
        method: 'GET',
        path: route.path,
        credential: applicant.credential,
        correlationId: ctx.correlationId,
        retryable: true,
      });
      return relay(edge, response);
    },
  });

  const applicantPost = (path: string, operationId: string, forwardBody: boolean): Route => ({
    method: 'POST',
    path,
    handler: async (ctx) => {
      const applicant = requireApplicant(ctx, edge);
      const route = upstreamRoute(operationId);
      const body = forwardBody ? await ctx.json<Record<string, unknown>>() : undefined;
      const response = await callUpstream({
        baseUrl: config.upstream[route.service],
        method: 'POST',
        path: route.path,
        ...(body !== undefined ? { body } : {}),
        credential: applicant.credential,
        correlationId: ctx.correlationId,
        retryable: false,
      });
      return relay(edge, response);
    },
  });

  const health: Route = { method: 'GET', path: '/edge/health', handler: () => ({ status: 200, body: { status: 'ok' } }) };

  /**
   * Readiness means the credential-minting upstreams answer. An edge that is
   * "up" while iam-service is unreachable can serve nothing but 502s, and
   * reporting that as ready is how a rollout completes into an outage.
   */
  const ready: Route = {
    method: 'GET',
    path: '/edge/ready',
    handler: async (ctx) => {
      const checks = await Promise.allSettled([
        fetch(new URL('/health', config.upstream.iam), { headers: { 'x-correlation-id': ctx.correlationId } }),
        fetch(new URL('/health', config.upstream.identity), { headers: { 'x-correlation-id': ctx.correlationId } }),
        fetch(new URL('/health', config.upstream.application), { headers: { 'x-correlation-id': ctx.correlationId } }),
      ]);
      const names_ = ['iam', 'identity', 'application'] as const;
      const upstreams: Record<string, boolean> = {};
      checks.forEach((result, index) => {
        const key = names_[index];
        if (key !== undefined) upstreams[key] = result.status === 'fulfilled' && result.value.ok;
      });
      const allUp = Object.values(upstreams).every(Boolean);
      return { status: allUp ? 200 : 503, body: { ready: allUp, upstreams } };
    },
  };

  /**
   * DEV-ONLY introspection, and the reason the scrubber is a proof rather than a
   * silent filter: the selfcheck asserts over these counters. It exposes counts
   * and dotted paths, never a value.
   */
  const diagnostics: Route = {
    method: 'GET',
    path: '/edge/_diagnostics',
    handler: () => ({
      status: 200,
      body: {
        deployment: config.deployment,
        cookieNames: { session: names.session, csrf: names.csrf, hostPrefixed: names.hostPrefixed },
        sessions: store.size(),
        scrubbed: scrubs.snapshot(),
        idleTtlSeconds: config.session.idleTtlSeconds,
        absoluteTtlSeconds: config.session.absoluteTtlSeconds,
      },
    }),
  };

  const shared: readonly Route[] = [session, refresh, health, ready, diagnostics];

  if (config.deployment.kind === 'citizen') {
    return [
      ...shared,
      otpRequest,
      otpVerify,
      applicantLogout,
      applicantGet('/edge/v1/me/applications', 'listMyApplications'),
      applicantPost('/edge/v1/me/applications/withdraw', 'withdrawMyApplication', true),
      applicantGet('/edge/v1/me/erasure-request', 'getMyErasureRequest'),
      applicantPost('/edge/v1/me/erasure-request', 'fileMyErasureRequest', false),
    ];
  }

  return [
    ...shared,
    officerLogin,
    officerLogout,
    officerGet('/edge/v1/applications', 'listApplications'),
    officerGet('/edge/v1/applications/amber-queue', 'listAmberQueue'),
    officerGet('/edge/v1/applications/by-id', 'findApplicationById', 'applicationId'),
    officerGet('/edge/v1/applications/status-history', 'getApplicationStatusHistory', 'applicationId'),
    applicationDetail,
    officerPost('/edge/v1/applications/medical-review', 'recordMedicalReview'),
    officerPost('/edge/v1/applications/final-decision', 'recordFinalDecision'),
    officerPost('/edge/v1/applications/accept', 'acceptApplication'),
    officerPost('/edge/v1/applications/adjudicate', 'adjudicateApplication'),
    officerPost('/edge/v1/applications/walk-in/register', 'registerWalkIn'),
    officerPost('/edge/v1/applications/walk-in/vet', 'vetWalkIn'),
    verifyIdentity,
    officerGet('/edge/v1/identities/erasure-requests', 'listErasureRequests'),
    officerPost('/edge/v1/identities/erasure-requests/decline', 'declineErasureRequest'),
    officerPost('/edge/v1/identities/erasure', 'eraseIdentity'),
  ];
}

/**
 * Read the agency/roles claims out of an officer JWT WITHOUT verifying it.
 *
 * Unverified is correct and must stay commented, or someone will "fix" it into
 * a security control: the token was just minted by iam-service over a trusted
 * channel, and every downstream service verifies the signature with the public
 * key on every call. The edge reads these claims only to label the session for
 * the UI. If this parse is wrong, RLS still refuses the rows.
 */
function readJwtClaims(token: string): {
  readonly agency: string | undefined;
  readonly roles: readonly string[];
  readonly subject: string | undefined;
} {
  const parts = token.split('.');
  const payload = parts[1];
  if (parts.length !== 3 || payload === undefined) return { agency: undefined, roles: [], subject: undefined };
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const roles = Array.isArray(decoded['roles']) ? decoded['roles'].filter((r): r is string => typeof r === 'string') : [];
    return {
      agency: typeof decoded['agency'] === 'string' ? decoded['agency'] : undefined,
      roles,
      subject: typeof decoded['sub'] === 'string' ? decoded['sub'] : undefined,
    };
  } catch {
    return { agency: undefined, roles: [], subject: undefined };
  }
}
