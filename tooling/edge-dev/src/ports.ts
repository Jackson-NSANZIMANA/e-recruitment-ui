// ══════════════════════════════════════════════════════════════════
// THE AUTHORITATIVE USRP PORT MAP
//
// There were two maps and they disagreed. `docs/architecture/
// frontend-architecture.md` §7 tells every developer to point the officer
// console at `http://localhost:4001/api/v1`; the backend's `.env.example`
// sets `PORT_IDENTITY_SERVICE=4001`. So the console's "BFF" was the identity
// service, which serves no officer route at all — every officer request would
// have 404'd against a service that never had those paths. The applicant
// portal's `4000` is worse in a quieter way: nothing in the platform binds it.
//
// It is data, not prose, because prose in two repos drifts and a table a
// program can read does not. `assertNoPortCollisions()` runs at edge-dev boot,
// so the day two entries collide the dev tool refuses to start instead of one
// process silently losing a socket race — exactly the EADDRINUSE failure the
// backend hit when all eleven services resolved :3000
// (docs/architecture/dev-boot-and-env-contract.md).
//
// PROVENANCE IS PER-ENTRY. `env-canon` means the name and number are read from
// the backend's committed `.env.example` (itself gated by
// scripts/verify-dev-boot.sh) and must not be changed here. `ui-convention`
// means this file is the source and nothing in the backend names it.
// ══════════════════════════════════════════════════════════════════

/** Where a port number's authority comes from. Never invent a third value. */
export type PortProvenance =
  /** Transcribed from the backend's `.env.example`; the backend owns it. */
  | 'env-canon'
  /** This file is the source of truth; no backend variable names it. */
  | 'ui-convention';

export interface PortEntry {
  readonly name: string;
  readonly port: number;
  /** The environment variable that carries it, when one exists. */
  readonly envVar: string | null;
  readonly provenance: PortProvenance;
  readonly note: string;
}

/**
 * Eleven backend services, transcribed from `.env.example` at backend 47d9ad3.
 * `loadRuntimeConfig` DERIVES each variable name from the service name
 * (`identity-service` -> `PORT_IDENTITY_SERVICE`), so these names are computed
 * facts rather than a hand-kept list.
 *
 * NONE of these is browser-reachable in a correct deployment. They are here so
 * the collision check can see them, and so no SPA is ever pointed at one again.
 */
export const SERVICE_PORTS: readonly PortEntry[] = [
  { name: 'identity-service', port: 4001, envVar: 'PORT_IDENTITY_SERVICE', provenance: 'env-canon', note: 'The port frontend-architecture.md §7 wrongly gave the officer console.' },
  { name: 'eligibility-service', port: 4002, envVar: 'PORT_ELIGIBILITY_SERVICE', provenance: 'env-canon', note: 'System-token only. Never browser-reachable.' },
  { name: 'biometric-service', port: 4003, envVar: 'PORT_BIOMETRIC_SERVICE', provenance: 'env-canon', note: 'Officer-token. Registers no readiness probe (GET /ready always 200).' },
  { name: 'document-forensics-service', port: 4004, envVar: 'PORT_DOCUMENT_FORENSICS_SERVICE', provenance: 'env-canon', note: 'System-token only.' },
  { name: 'background-vetting-service', port: 4005, envVar: 'PORT_BACKGROUND_VETTING_SERVICE', provenance: 'env-canon', note: 'No business HTTP route; probes only.' },
  { name: 'application-service', port: 4006, envVar: 'PORT_APPLICATION_SERVICE', provenance: 'env-canon', note: 'Officer reads, the FOUR officer transitions, and walk-in.' },
  { name: 'scheduling-service', port: 4007, envVar: 'PORT_SCHEDULING_SERVICE', provenance: 'env-canon', note: 'Only GET /v1/slots/invitation-key is unauthenticated.' },
  { name: 'notification-service', port: 4008, envVar: 'PORT_NOTIFICATION_SERVICE', provenance: 'env-canon', note: 'No business HTTP route; probes only.' },
  { name: 'field-sync-service', port: 4009, envVar: 'PORT_FIELD_SYNC_SERVICE', provenance: 'env-canon', note: 'Officer-token; field tablets.' },
  { name: 'audit-service', port: 4010, envVar: 'PORT_AUDIT_SERVICE', provenance: 'env-canon', note: 'No business HTTP route; probes only.' },
  { name: 'iam-service', port: 4011, envVar: 'PORT_IAM_SERVICE', provenance: 'env-canon', note: 'Officer login + service-token issuance. Sole private-key holder.' },
] as const;

/**
 * The edge tier. `PORT_CITIZEN_BFF`, `PORT_AGENCY_BFF` and `PORT_ADMIN_BFF` are
 * ALREADY in the backend's `.env.example`, with real loaders behind them
 * (`loadEdgeSessionConfig`, `loadCorsConfig`, `loadAgencyDeploymentConfig`).
 * What is missing is the deployment, not the configuration contract.
 *
 * The backend names ONE `PORT_AGENCY_BFF` because agency-bff is one codebase
 * with three deployments, each setting `AGENCY`. A dev machine runs all three
 * at once, so the RNP and RCS dev ports are this file's invention, marked so.
 */
export const EDGE_PORTS: readonly PortEntry[] = [
  { name: 'citizen-bff', port: 4020, envVar: 'PORT_CITIZEN_BFF', provenance: 'env-canon', note: 'ONE cross-agency deployment: a citizen inherently spans agencies (ADR-014/018).' },
  { name: 'agency-bff (RDF)', port: 4021, envVar: 'PORT_AGENCY_BFF', provenance: 'env-canon', note: 'AGENCY=RDF. The officer console targets THIS, not 4001.' },
  { name: 'agency-bff (RNP)', port: 4022, envVar: 'PORT_AGENCY_BFF', provenance: 'ui-convention', note: 'Same codebase, AGENCY=RNP. Dev-only allocation; backend names one variable.' },
  { name: 'agency-bff (RCS)', port: 4023, envVar: 'PORT_AGENCY_BFF', provenance: 'ui-convention', note: 'Same codebase, AGENCY=RCS. Dev-only allocation.' },
  { name: 'admin-bff', port: 4024, envVar: 'PORT_ADMIN_BFF', provenance: 'env-canon', note: 'Named and reserved; this contract specifies no route for it yet.' },
] as const;

/**
 * The two SPAs. 3000/3001 are the first two entries of the backend's
 * `CORS_ORIGINS` allow-list, which is what makes them canon rather than taste.
 */
export const APP_PORTS: readonly PortEntry[] = [
  { name: 'applicant-portal', port: 3000, envVar: null, provenance: 'env-canon', note: 'In CORS_ORIGINS. Talks to citizen-bff (4020) — NOT 4000, which nothing binds.' },
  { name: 'officer-console', port: 3001, envVar: null, provenance: 'env-canon', note: 'In CORS_ORIGINS. Talks to agency-bff (4021/4022/4023).' },
] as const;

/** G2G mocks, from `.env.example`. Listed so nothing allocates over them. */
export const G2G_MOCK_PORTS: readonly PortEntry[] = [
  { name: 'nida-mock', port: 3100, envVar: 'NIDA_BASE_URL', provenance: 'env-canon', note: 'Identity registry.' },
  { name: 'nesa-mock', port: 3101, envVar: 'NESA_BASE_URL', provenance: 'env-canon', note: 'Secondary education results.' },
  { name: 'rib-mock', port: 3102, envVar: 'RIB_BASE_URL', provenance: 'env-canon', note: 'Criminal record.' },
  { name: 'hec-mock', port: 3103, envVar: 'HEC_BASE_URL', provenance: 'env-canon', note: 'Higher-education council.' },
] as const;

/**
 * Ports this dev tool allocates for its own contract mocks, deliberately far
 * from every real number. A mock squatting a real service's port is
 * indistinguishable from that service being up, which is the worst thing a
 * stand-in can do.
 */
export const EDGE_DEV_MOCK_PORTS: readonly PortEntry[] = [
  { name: 'edge-dev mock iam-service', port: 4911, envVar: 'EDGE_DEV_MOCK_IAM_PORT', provenance: 'ui-convention', note: 'Mirrors 4011 in the 49xx band.' },
  { name: 'edge-dev mock identity-service', port: 4901, envVar: 'EDGE_DEV_MOCK_IDENTITY_PORT', provenance: 'ui-convention', note: 'Mirrors 4001.' },
  { name: 'edge-dev mock application-service', port: 4906, envVar: 'EDGE_DEV_MOCK_APPLICATION_PORT', provenance: 'ui-convention', note: 'Mirrors 4006.' },
] as const;

export const ALL_PORTS: readonly PortEntry[] = [
  ...APP_PORTS,
  ...G2G_MOCK_PORTS,
  ...SERVICE_PORTS,
  ...EDGE_PORTS,
  ...EDGE_DEV_MOCK_PORTS,
];

/**
 * Refuse to run on a colliding map.
 *
 * No case is special-cased: two processes sharing a port is the bug this file
 * exists to have caught, and a permitted exception is how the exception
 * becomes the rule.
 */
export function assertNoPortCollisions(entries: readonly PortEntry[] = ALL_PORTS): void {
  const seen = new Map<number, PortEntry>();
  const collisions: string[] = [];
  for (const entry of entries) {
    const prior = seen.get(entry.port);
    if (prior !== undefined) {
      collisions.push(`:${entry.port} claimed by both "${prior.name}" and "${entry.name}"`);
      continue;
    }
    seen.set(entry.port, entry);
  }
  if (collisions.length > 0) {
    throw new Error(`Port map collision — refusing to boot:\n  ${collisions.join('\n  ')}`);
  }
}

/** Render the map as the markdown table published in PORTS.md. */
export function renderPortTable(entries: readonly PortEntry[] = ALL_PORTS): string {
  const rows = entries.map(
    (e) => `| ${e.port} | ${e.name} | ${e.envVar ?? '—'} | ${e.provenance} | ${e.note} |`,
  );
  return ['| Port | Process | Env var | Provenance | Note |', '|---|---|---|---|---|', ...rows].join('\n');
}
