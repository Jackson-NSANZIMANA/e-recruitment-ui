// ══════════════════════════════════════════════════════════════════
// edge-dev — configuration
//
// Variable names are the backend's, not new ones. `EDGE_SESSION_HMAC_KEY`,
// `EDGE_SESSION_IDLE_TTL_SECONDS`, `EDGE_SESSION_ABSOLUTE_TTL_SECONDS`,
// `EDGE_COOKIE_SECURE`, `CORS_ORIGINS`, `AGENCY`, `PORT_CITIZEN_BFF`,
// `PORT_AGENCY_BFF` and the `*_BASE_URL` family are all already read by real
// loaders in `@usrp/shared-config`. Inventing an `EDGE_DEV_*` parallel set
// would guarantee the dev tool and the real BFF diverge on day one.
//
// `EDGE_COOKIE_SECURE=false` is the one dev-only concession, and it is not
// silent: `__Host-` REQUIRES Secure, so a non-Secure cookie would be dropped
// by the browser. Dev therefore drops the prefix and says so out loud at boot.
// The real BFF must never do this — the backend's production guard already
// refuses to boot with `EDGE_COOKIE_SECURE=false`.
// ══════════════════════════════════════════════════════════════════

import { assertNoPortCollisions, EDGE_PORTS, EDGE_DEV_MOCK_PORTS } from './ports.ts';

export type EdgeDeployment =
  /** ONE cross-agency deployment. A citizen spans agencies by construction. */
  | { readonly kind: 'citizen' }
  /** ONE codebase, three deployments. `AGENCY` selects which. */
  | { readonly kind: 'agency'; readonly agency: 'RDF' | 'RNP' | 'RCS' };

export interface UpstreamMap {
  readonly iam: string;
  readonly identity: string;
  readonly application: string;
}

export interface EdgeConfig {
  readonly deployment: EdgeDeployment;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly cookieSecure: boolean;
  readonly session: {
    readonly handleHmacKey: string;
    readonly idleTtlSeconds: number;
    readonly absoluteTtlSeconds: number;
  };
  readonly upstream: UpstreamMap;
  /** Client credentials for brokered system-token calls (ADR-016). */
  readonly systemClient: { readonly clientId: string; readonly clientSecret: string };
}

const AGENCIES = new Set(['RDF', 'RNP', 'RCS']);

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is required. Source the backend's .env (set -a; source .env) or pass it explicitly.`);
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function boolish(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function port(entryName: string): number {
  const entry = [...EDGE_PORTS, ...EDGE_DEV_MOCK_PORTS].find((candidate) => candidate.name === entryName);
  if (entry === undefined) throw new Error(`No port-map entry named "${entryName}".`);
  return entry.port;
}

/**
 * Build the config for one deployment.
 *
 * The port map collision check runs HERE rather than in `main()` so every entry
 * point inherits it — including the selfcheck, which is the one caller that
 * would otherwise skip it and therefore the one that must not.
 */
export function loadEdgeConfig(
  deployment: EdgeDeployment,
  env: NodeJS.ProcessEnv = process.env,
): EdgeConfig {
  assertNoPortCollisions();

  if (deployment.kind === 'agency' && !AGENCIES.has(deployment.agency)) {
    throw new Error(`AGENCY must be one of RDF, RNP, RCS — got ${JSON.stringify(deployment.agency)}.`);
  }

  const idleTtlSeconds = integer(env, 'EDGE_SESSION_IDLE_TTL_SECONDS', 1_800);
  const absoluteTtlSeconds = integer(env, 'EDGE_SESSION_ABSOLUTE_TTL_SECONDS', 43_200);
  if (absoluteTtlSeconds < idleTtlSeconds) {
    throw new Error(
      'EDGE_SESSION_ABSOLUTE_TTL_SECONDS must be >= EDGE_SESSION_IDLE_TTL_SECONDS ' +
        '(an absolute ceiling below the sliding window expires active sessions).',
    );
  }

  const configuredPort = env['EDGE_DEV_PORT'];
  const resolvedPort =
    configuredPort !== undefined && configuredPort !== ''
      ? Number.parseInt(configuredPort, 10)
      : deployment.kind === 'citizen'
        ? port('citizen-bff')
        : port(`agency-bff (${deployment.agency})`);

  const corsOrigins = (env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (corsOrigins.length === 0) throw new Error('CORS_ORIGINS resolved to an empty allow-list.');
  if (corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ORIGINS may not contain "*". A credentialed edge cannot use the wildcard — ' +
        'browsers reject Allow-Origin:* alongside Allow-Credentials:true, so this would break the product too.',
    );
  }

  return {
    deployment,
    port: resolvedPort,
    corsOrigins,
    cookieSecure: boolish(env, 'EDGE_COOKIE_SECURE', false),
    session: {
      handleHmacKey: required(env, 'EDGE_SESSION_HMAC_KEY'),
      idleTtlSeconds,
      absoluteTtlSeconds,
    },
    upstream: {
      iam: env['IAM_BASE_URL'] ?? 'http://127.0.0.1:4011',
      identity: env['IDENTITY_SERVICE_BASE_URL'] ?? 'http://127.0.0.1:4001',
      application: env['APPLICATION_SERVICE_BASE_URL'] ?? 'http://127.0.0.1:4006',
    },
    systemClient: {
      clientId: env['IDENTITY_CLIENT_ID'] ?? 'dev.identity-portal',
      clientSecret: env['IDENTITY_CLIENT_SECRET'] ?? 'DevService#2026',
    },
  };
}

/**
 * The cookie name prefix actually usable in this deployment.
 *
 * Not a style choice. A `__Host-` cookie without Secure is SILENTLY DROPPED by
 * every current browser, so on plain-http localhost the prefix must go or
 * nothing works — and the reason must be printed, because a developer who
 * learns the prefix is optional will ship it optional.
 */
export function cookieNamesFor(config: EdgeConfig): { readonly warning: string | null } {
  if (config.cookieSecure) return { warning: null };
  return {
    warning:
      'EDGE_COOKIE_SECURE=false: __Host- prefixed cookies would be silently dropped over plain http, ' +
      'so this dev edge emits unprefixed names. PRODUCTION MUST SET IT TRUE — the backend production guard ' +
      'already refuses to boot otherwise, and the __Host- prefix is what stops a sibling *.gov.rw host ' +
      'writing the session cookie.',
  };
}
