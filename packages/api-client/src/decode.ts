// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — response decoders
//
// WHY THIS FILE EXISTS.
//
// `transport.ts` ends with `return parsed as T`. That cast is the only thing
// between an edge response and a React render, and a cast checks NOTHING. The
// types in `wire.ts` were transcribed by hand — the file says so in its own
// header — against `tooling/edge-dev`, which RELAYS the upstream body verbatim.
// The production `edge-gateway` does not relay: `adapters/http/projections.ts`
// projects every officer read through an allowlist and returns a BARE ARRAY.
//
// So `{ agency, applications: [...] }` (dev) and `[...]` (production) were both
// called `ApplicationListResponse`, nothing compared them, and the dashboard
// failed at `data.applications.length` — a TypeError inside a component, shown
// to an officer as "Something went wrong", indistinguishable from an outage.
//
// Decoding at the boundary makes that a named `ApiError { kind: 'malformed' }`
// carrying the operation id. Two consequences worth stating:
//
//   • The client now has ONE row shape regardless of which edge answers. The
//     dev harness's envelope is accepted and unwrapped, and in DEV it warns —
//     visible drift, not a silent divergence that only shows up in production.
//   • `agency` is INJECTED from the officer's session on officer reads, never
//     read from the row. That mirrors the gateway's own rule and keeps it
//     server-authoritative: a row cannot relabel itself.
// ══════════════════════════════════════════════════════════════════

import { APPLICATION_STATUSES, type Agency, type ApplicationStatus } from '@usrp/contracts';
import { ApiError } from './errors.js';
import type {
  AmberQueueResponse,
  AmberQueueRow,
  ApplicationDetailResponse,
  ApplicationListResponse,
  ApplicationRecord,
  ApplicationRow,
  MyApplicationRow,
  MyApplicationsResponse,
  StatusHistoryEntry,
  StatusHistoryResponse,
  TransitionResult,
  WalkInVetResponse,
} from './wire.js';

const STATUSES: ReadonlySet<string> = new Set(APPLICATION_STATUSES);
const AGENCIES: ReadonlySet<string> = new Set(['RDF', 'RNP', 'RCS']);

/** Drift is a defect, not a rendering problem. Name the operation and stop. */
function malformed(operationId: string, detail: string): never {
  throw new ApiError(
    { kind: 'malformed', detail: `${operationId}: ${detail}` },
    'The server returned an unexpected response.',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function get(body: unknown, name: string): unknown {
  return isRecord(body) ? body[name] : undefined;
}

/** First non-null of several candidate field names. The two edges disagree on some. */
function firstString(body: unknown, ...names: readonly string[]): string | null {
  for (const name of names) {
    const value = str(get(body, name));
    if (value !== null) return value;
  }
  return null;
}

const warnedOperations = new Set<string>();

/**
 * Accept the production shape (a bare array) and the dev harness shape (an
 * upstream envelope), normalising to rows.
 *
 * The envelope branch warns ONCE per operation in development. Silently
 * accepting both is how the two shapes stayed unreconciled in the first place.
 */
function rowsOf(body: unknown, envelopeKey: string, operationId: string): readonly unknown[] {
  if (Array.isArray(body)) return body;
  const enveloped = get(body, envelopeKey);
  if (Array.isArray(enveloped)) {
    // Read without depending on `vite/client` types: this package is also
    // consumed by node-based selfchecks where `import.meta.env` is undefined.
    const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
    if (isDev) {
      if (!warnedOperations.has(operationId)) {
        warnedOperations.add(operationId);
        console.warn(
          `[api-client] ${operationId} answered with an upstream envelope { ${envelopeKey}: [...] }. ` +
            'The production edge projects a bare array. This response came from a dev harness, not the gateway.',
        );
      }
    }
    return enveloped;
  }
  return malformed(operationId, `expected an array or { ${envelopeKey}: [...] }, got ${describe(body)}`);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

/**
 * Nullable where a missing status is survivable.
 *
 * The officer LIST is strict on purpose — a row with no status cannot be
 * rendered or acted on, and hiding it would be worse than refusing the read.
 * The amber queue is counted, not rendered, so one unreadable forensics row must
 * not blank an officer's dashboard.
 */
function optionalStatus(value: unknown, operationId: string): ApplicationStatus | null {
  return str(value) === null ? null : requireStatus(value, operationId);
}

function requireStatus(value: unknown, operationId: string): ApplicationStatus {
  const status = str(value);
  if (status === null || !STATUSES.has(status)) {
    return malformed(operationId, `unknown application status ${JSON.stringify(value)}`);
  }
  return status as ApplicationStatus;
}

function requireAgency(value: unknown, operationId: string): Agency {
  const agency = str(value);
  if (agency === null || !AGENCIES.has(agency)) {
    return malformed(operationId, `unknown agency ${JSON.stringify(value)}`);
  }
  return agency as Agency;
}

/** `applicationId` on the gateway, `id` upstream. Both mean the row's identity. */
function requireApplicationId(row: unknown, operationId: string): string {
  const id = firstString(row, 'applicationId', 'id');
  if (id === null) return malformed(operationId, 'a row carries no applicationId');
  return id;
}

// ── Officer reads ────────────────────────────────────────────────

export function decodeApplicationList(body: unknown, agency: Agency): ApplicationListResponse {
  return rowsOf(body, 'applications', 'listApplications').map((row): ApplicationRow => ({
    applicationId: requireApplicationId(row, 'listApplications'),
    processingCode: str(get(row, 'processingCode')),
    category: str(get(row, 'category')),
    status: requireStatus(get(row, 'status'), 'listApplications'),
    agency,
    submittedAt: str(get(row, 'submittedAt')),
  }));
}

export function decodeAmberQueue(body: unknown, agency: Agency): AmberQueueResponse {
  return rowsOf(body, 'queue', 'listAmberQueue').map((row): AmberQueueRow => ({
    applicationId: requireApplicationId(row, 'listAmberQueue'),
    processingCode: str(get(row, 'processingCode')),
    status: optionalStatus(get(row, 'status'), 'listAmberQueue'),
    documentType: str(get(row, 'documentType')),
    forensicsScore: num(get(row, 'forensicsScore')),
    queuedAt: str(get(row, 'queuedAt')),
    agency,
  }));
}

/**
 * One application record.
 *
 * The gateway returns the projected record FLAT; the dev harness returns the
 * upstream envelope `{ agency, application }`. Unwrap either.
 */
export function decodeApplication(body: unknown, agency: Agency, operationId = 'findApplicationById'): ApplicationRecord {
  const record = isRecord(get(body, 'application')) ? get(body, 'application') : body;
  if (!isRecord(record)) return malformed(operationId, `expected an application object, got ${describe(body)}`);
  return {
    applicationId: requireApplicationId(record, operationId),
    processingCode: str(record['processingCode']),
    category: str(record['category']),
    status: requireStatus(record['status'], operationId),
    agency,
    submittedAt: str(record['submittedAt']),
    /** Officer-only forensic signals. Absent on the dev harness; null, not undefined. */
    documentLane: str(record['documentLane']),
    documentForensicsScore: num(record['documentForensicsScore']),
    assignedVenueName: str(record['assignedVenueName']),
    physicalTestScheduledAt: str(record['physicalTestScheduledAt']),
    finalDecisionAt: str(record['finalDecisionAt']),
    finalDecisionNotes: str(record['finalDecisionNotes']),
  };
}

/**
 * The decision trail.
 *
 * Field names diverge and both are read: the gateway projects `occurredAt` and
 * `note`, the upstream row carries `at` and `reason`. `actor` is deliberately
 * NOT decoded — it is an officer UUID the gateway strips, and a field that
 * exists only against the dev harness is a field a component will render.
 */
export function decodeStatusHistory(body: unknown, operationId = 'getStatusHistory'): StatusHistoryResponse {
  return rowsOf(body, 'history', operationId).map((entry): StatusHistoryEntry => ({
    fromStatus: str(get(entry, 'fromStatus')) === null ? null : requireStatus(get(entry, 'fromStatus'), operationId),
    toStatus: requireStatus(get(entry, 'toStatus'), operationId),
    actorKind: str(get(entry, 'actorKind')),
    occurredAt: firstString(entry, 'occurredAt', 'at'),
    note: firstString(entry, 'note', 'reason'),
  }));
}

/**
 * The composed detail read.
 *
 * `partial` names the panels that failed. The gateway does not emit it — its
 * detail handler fails whole rather than degrading — so it decodes to an empty
 * list rather than being dropped: the applicant-facing meaning of "this panel is
 * missing" should not disappear because one of two edges omits the field.
 */
export function decodeApplicationDetail(body: unknown, agency: Agency): ApplicationDetailResponse {
  const application = decodeApplication(get(body, 'application'), agency, 'getApplicationDetail');
  const rawHistory = get(body, 'history');
  const history = rawHistory === null || rawHistory === undefined
    ? []
    : decodeStatusHistory(rawHistory, 'getApplicationDetail');
  const partial = get(body, 'partial');
  return {
    application,
    history,
    partial: Array.isArray(partial) ? partial.filter((name): name is string => typeof name === 'string') : [],
  };
}

// ── Writes ───────────────────────────────────────────────────────

/**
 * The 200 body of any transition.
 *
 * The gateway answers `{ applicationId, outcome, fromStatus, status }`; the
 * upstream answers `{ status: 'APPLIED', fromStatus, toStatus }` or
 * `{ status: 'NO_CHANGE', currentStatus }`. Note the collision: `status` is the
 * OUTCOME in one and the resulting STATE in the other, which is precisely the
 * kind of field a cast cannot catch. Both are normalised onto `outcome` plus
 * `status`, so a caller reads one discriminant.
 */
export function decodeTransition(applicationId: string, body: unknown): TransitionResult {
  const outcome = str(get(body, 'outcome')) ?? str(get(body, 'status')) ?? 'APPLIED';
  if (outcome === 'NO_CHANGE') {
    const current = firstString(body, 'currentStatus', 'status');
    return {
      outcome: 'NO_CHANGE',
      applicationId,
      fromStatus: null,
      status: current === null ? null : requireStatus(current, 'transition'),
    };
  }
  const resulting = firstString(body, 'toStatus', 'status');
  return {
    outcome: 'APPLIED',
    applicationId,
    fromStatus: str(get(body, 'fromStatus')) === null ? null : requireStatus(get(body, 'fromStatus'), 'transition'),
    status: resulting === null ? null : requireStatus(resulting, 'transition'),
  };
}

/** Walk-in vetting is a transition plus the autonomous age verdict. */
export function decodeWalkInVet(applicationId: string, body: unknown): WalkInVetResponse {
  return { ...decodeTransition(applicationId, body), ageStatus: str(get(body, 'ageStatus')) };
}

// ── Citizen reads ────────────────────────────────────────────────

/**
 * The citizen's own rows.
 *
 * `agency` comes from the ROW here, not from a session: a citizen is
 * cross-agency by construction (ADR-014/ADR-018) and their session carries no
 * agency to inject.
 */
export function decodeMyApplications(body: unknown): MyApplicationsResponse {
  return rowsOf(body, 'applications', 'listMyApplications').map((row): MyApplicationRow => ({
    applicationId: requireApplicationId(row, 'listMyApplications'),
    agency: requireAgency(get(row, 'agency'), 'listMyApplications'),
    status: requireStatus(get(row, 'status'), 'listMyApplications'),
    processingCode: str(get(row, 'processingCode')),
    submittedAt: str(get(row, 'submittedAt')),
  }));
}
