// ════════════════════════════════════════════════════════════════
// Invariant audit of the generated route table, as PURE FUNCTIONS.
//
// The table in src/generated/routes.ts is data, which means the platform's
// security-shaped rules about routes can be CHECKED rather than reviewed. This
// module holds the checks and touches no filesystem, so the same predicates are
// exercised by hand-built fixtures in test/route-invariants.test.ts (proving
// each one goes red) and by the real 58-row table in test/route-table.test.ts
// (proving the shipped contract obeys them).
//
// WHAT THIS IS NOT. None of this is a security control. Agency isolation is
// enforced by Postgres RLS with FORCE'd policies and per-agency NOLOGIN group
// roles; nothing in a browser bundle enforces anything. These checks stop the
// FRONTEND from describing a surface that contradicts the backend's own
// boundaries — a documentation and codegen gate, not a guard.
// ════════════════════════════════════════════════════════════════

export interface RouteLike {
  readonly service: string;
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly auth: readonly string[];
  readonly reach: string;
}

export interface RouteProblem {
  readonly rule: string;
  readonly operationId: string;
  readonly message: string;
}

const AUTH_KINDS: readonly string[] = ['officer', 'system', 'applicant-session', 'none'];
const PROBES: readonly string[] = ['/health', '/ready'];

/**
 * The ONLY operations allowed to be reachable from a browser with no credential.
 *
 * This list is the point of the rule. Each entry is an endpoint a member of the
 * public can hit unauthenticated, so growing it must cost a reviewer's
 * signature rather than happening as a side effect of a codegen run.
 *
 *   officerLogin           issues the officer bearer token; anonymous by nature
 *   requestApplicantOtp    starts citizen auth (ADR-018)
 *   verifyApplicantOtp     completes it and issues the opaque session
 *   getSlotInvitationKey   scheduling-service, inline route in src/main.ts,
 *                          returns the key material used to validate a slot
 *                          invitation. Anonymous in the backend as read.
 */
export const ANONYMOUS_BROWSER_OPERATIONS: readonly string[] = [
  'officerLogin',
  'requestApplicantOtp',
  'verifyApplicantOtp',
  'getSlotInvitationKey',
];

export function auditRoutes(routes: readonly RouteLike[]): readonly RouteProblem[] {
  const problems: RouteProblem[] = [];
  const push = (rule: string, operationId: string, message: string): void => {
    problems.push({ rule, operationId, message });
  };

  const seen = new Set<string>();
  for (const route of routes) {
    const id = route.operationId;

    // INVARIANT 1 — exact path only.
    if (/[{}$]/.test(route.path) || /\/:[A-Za-z_]/.test(route.path)) {
      push('exact-path-only', id, `path "${route.path}" is templated; ids travel in the body`);
    }
    if (!route.path.startsWith('/')) {
      push('exact-path-only', id, `path "${route.path}" is not absolute`);
    }

    // One method+path PER SERVICE may be claimed once, or a client cannot pick
    // a validator. Scoped per service on purpose: all eleven services expose
    // GET /health and GET /ready, and they are eleven different endpoints on
    // eleven different hosts, not one endpoint declared eleven times.
    const key = `${route.service} ${route.method} ${route.path}`;
    if (seen.has(key)) {
      push('unique-route', id, `${route.method} ${route.path} is declared more than once for ${route.service}`);
    }
    seen.add(key);

    // Auth kinds must be known, non-empty, and `none` cannot be qualified.
    if (route.auth.length === 0) {
      push('auth-declared', id, 'declares no authentication kind at all');
    }
    for (const kind of route.auth) {
      if (!AUTH_KINDS.includes(kind)) {
        push('auth-declared', id, `unknown auth kind "${kind}"`);
      }
    }
    if (route.auth.includes('none') && route.auth.length > 1) {
      push('auth-declared', id, `"none" combined with ${route.auth.join('|')} — a route is either open or it is not`);
    }

    // INVARIANT 4 — the two human credentials are not interchangeable.
    if (route.auth.includes('applicant-session') && route.auth.includes('officer')) {
      push(
        'credentials-not-interchangeable',
        id,
        'accepts both an officer Ed25519 JWT and an opaque citizen session. They are different credential kinds with different failure codes (UNAUTHENTICATED vs INVALID_SESSION); one route cannot honour both.',
      );
    }
    if (route.auth.includes('applicant-session') && route.auth.includes('system')) {
      push(
        'credentials-not-interchangeable',
        id,
        'accepts both a system token and a citizen session',
      );
    }

    // Reach must be known.
    if (route.reach !== 'browser' && route.reach !== 'service-internal') {
      push('reach-declared', id, `unknown reach "${route.reach}"`);
    }

    // ADR-016 — a system token never lives in a browser.
    if (route.auth.includes('system') && route.reach === 'browser') {
      push(
        'system-token-never-in-browser',
        id,
        'takes a system client-credentials token but is marked browser-reachable. Proxying it to a browser is an incident, not a convenience.',
      );
    }

    // ADR-018 — a citizen session only exists in a browser.
    if (route.auth.includes('applicant-session') && route.reach !== 'browser') {
      push(
        'session-is-browser-only',
        id,
        'requires a citizen session but is not browser-reachable; nothing else holds that session',
      );
    }

    // Probes are unauthenticated and internal, on every service.
    if (PROBES.includes(route.path)) {
      if (route.auth.length !== 1 || !route.auth.includes('none')) {
        push('probe-shape', id, `${route.path} must be auth: ["none"], got ${route.auth.join('|')}`);
      }
      if (route.reach !== 'service-internal') {
        push('probe-shape', id, `${route.path} must not be browser-reachable`);
      }
      continue;
    }

    // Anonymous browser surface is an allowlist, not an accident.
    if (route.reach === 'browser' && route.auth.includes('none')) {
      if (!ANONYMOUS_BROWSER_OPERATIONS.includes(id)) {
        push(
          'anonymous-browser-allowlist',
          id,
          `${route.method} ${route.path} is browser-reachable with no credential and is not on the reviewed allowlist in scripts/lint/route-invariants.ts`,
        );
      }
    }
  }

  // The allowlist may not rot: an entry naming an operation that no longer
  // exists is a permission granted to nothing, and hides the next real one.
  const ids = new Set(routes.map((route) => route.operationId));
  for (const allowed of ANONYMOUS_BROWSER_OPERATIONS) {
    if (!ids.has(allowed)) {
      problems.push({
        rule: 'anonymous-browser-allowlist',
        operationId: allowed,
        message: 'allowlisted anonymous operation does not exist in the route table; remove the entry',
      });
    }
  }

  return problems;
}
