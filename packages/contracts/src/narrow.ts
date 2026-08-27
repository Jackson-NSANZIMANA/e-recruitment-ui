// ═════════════════════════════════════════════════════════════════
// @usrp/contracts — binding the GENERATED wire types to the per-agency model.
//
// HAND-WRITTEN. src/agency.ts says which statuses are legal for which agency;
// src/generated/* says what the wire carries. This file is the join, and it is
// the piece that turns the divergence model from documentation into a BUILD
// FAILURE.
//
// THE BUG THIS PREVENTS. rdf_ops.application_status carries four WALK_IN_*
// values; rnp_ops and rcs_ops do not carry them at all. A component that renders
// a status lozenge from a wire row is typed against all 19 by default, so it
// will compile a WALK_IN_ON_SITE_VETTING branch for the RNP console — a branch
// that can never fire, sitting in the codebase looking correct, next to the
// missing branch nobody noticed. Worse in the other direction: exhaustive
// switch/case over StatusFor<'RNP'> is only exhaustive if the type is actually
// narrowed.
//
// This is the same class of error the backend hit and fixed by comparing
// `status::text` instead of casting to an enum: an enum-cast comparison against
// WALK_IN_REJECTED is a HARD ERROR for two agencies out of three and fine for
// RDF, so it passes every test run against RDF fixtures and fails in production
// for RNP and RCS.
// ═════════════════════════════════════════════════════════════════

import {
  AGENCIES,
  RDF_ONLY_STATUSES,
  STATUSES_BY_AGENCY,
  type Agency,
  type ApplicationStatus,
  type SharedStatus,
  type StatusFor,
} from './agency.js';
import type {
  ApplicantApplicationSummary,
  ApplicationDetail,
  ApplicationSummary,
  StatusHistoryEntry,
} from './generated/application-service.types.js';

// ─── Types ───────────────────────────────────────────────────────────────

/** Replace a row's agency-agnostic `status` with the agency's legal subset. */
export type WithStatusFor<T extends { status: ApplicationStatus }, A extends Agency> = Omit<
  T,
  'status'
> & { readonly status: StatusFor<A> };

export type ApplicationSummaryFor<A extends Agency> = WithStatusFor<ApplicationSummary, A>;

export type ApplicantApplicationSummaryFor<A extends Agency> = WithStatusFor<
  ApplicantApplicationSummary,
  A
>;

export type ApplicationDetailFor<A extends Agency> = WithStatusFor<ApplicationDetail, A>;

/**
 * The history entry needs BOTH ends narrowed: `fromStatus` is nullable (null on
 * the first entry, because nothing preceded it) and `toStatus` is not.
 */
export type StatusHistoryEntryFor<A extends Agency> = Omit<
  StatusHistoryEntry,
  'fromStatus' | 'toStatus'
> & {
  readonly fromStatus: StatusFor<A> | null;
  readonly toStatus: StatusFor<A>;
};

// ─── Runtime narrowing ───────────────────────────────────────────────────
//
// The compile-time types above are only sound at the boundary where wire data
// is admitted, so that boundary needs a real check. These are it.

/** Is this status legal for this agency? */
export function isStatusFor<A extends Agency>(
  agency: A,
  status: ApplicationStatus,
): status is StatusFor<A> {
  return (STATUSES_BY_AGENCY[agency] as readonly string[]).includes(status);
}

/**
 * A status this agency cannot reach means the wire and the schema disagree. That
 * is not a rendering problem to be defaulted around — it is either an RLS
 * boundary failure or a stale enum, and both are worth stopping for.
 */
export class AgencyStatusError extends Error {
  readonly agency: Agency;
  readonly status: string;

  constructor(agency: Agency, status: string) {
    super(
      `status "${status}" is not legal for ${agency}. ` +
        `${agency} permits ${STATUSES_BY_AGENCY[agency].length} of ${
          STATUSES_BY_AGENCY.RDF.length
        } statuses; the walk-in lane (${RDF_ONLY_STATUSES.join(', ')}) exists only in rdf_ops.`,
    );
    this.name = 'AgencyStatusError';
    this.agency = agency;
    this.status = status;
  }
}

export function assertStatusFor<A extends Agency>(
  agency: A,
  status: ApplicationStatus,
): asserts status is StatusFor<A> {
  if (!isStatusFor(agency, status)) throw new AgencyStatusError(agency, status);
}

/** Narrow one wire row at the boundary, or refuse it. */
export function narrowRow<A extends Agency, T extends { status: ApplicationStatus }>(
  agency: A,
  row: T,
): WithStatusFor<T, A> {
  assertStatusFor(agency, row.status);
  return row as unknown as WithStatusFor<T, A>;
}

/** Narrow a whole list, naming the offending index if one is illegal. */
export function narrowRows<A extends Agency, T extends { status: ApplicationStatus }>(
  agency: A,
  rows: readonly T[],
): readonly WithStatusFor<T, A>[] {
  return rows.map((row, index) => {
    if (!isStatusFor(agency, row.status)) {
      throw new AgencyStatusError(agency, `${row.status} (at index ${index})`);
    }
    return row as unknown as WithStatusFor<T, A>;
  });
}

/** Every agency, for exhaustive iteration that cannot miss one. */
export const ALL_AGENCIES: readonly Agency[] = AGENCIES;

// ─── Compile-time guards ─────────────────────────────────────────────────
//
// Not tests — BUILD FAILURES. `pnpm typecheck` is the gate.

type Assert<T extends true> = T;
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** An RDF row can hold the walk-in lane. */
type _RdfRowSeesWalkIn = Assert<
  Eq<Extract<ApplicationSummaryFor<'RDF'>['status'], 'WALK_IN_REGISTERED'>, 'WALK_IN_REGISTERED'>
>;

/**
 * AN RNP ROW CANNOT. This is the assertion the whole file exists for: if
 * WithStatusFor ever stops narrowing, this line goes red before any component
 * can render an impossible lozenge.
 */
type _RnpRowCannotSeeWalkIn = Assert<
  Eq<Extract<ApplicationSummaryFor<'RNP'>['status'], 'WALK_IN_REGISTERED'>, never>
>;
type _RcsRowCannotSeeWalkIn = Assert<
  Eq<Extract<ApplicationDetailFor<'RCS'>['status'], 'WALK_IN_REJECTED'>, never>
>;

/** Narrowing touches ONLY `status` — no other field may be dropped or widened. */
type _NarrowingPreservesShape = Assert<
  Eq<keyof ApplicationSummaryFor<'RNP'>, keyof ApplicationSummary>
>;

/** RNP's row status is exactly the shared set. */
type _RnpRowIsShared = Assert<Eq<ApplicationSummaryFor<'RNP'>['status'], SharedStatus>>;

/** Both ends of a history entry are narrowed, and fromStatus stays nullable. */
type _HistoryFromIsNarrowedAndNullable = Assert<
  Eq<StatusHistoryEntryFor<'RNP'>['fromStatus'], SharedStatus | null>
>;
type _HistoryToIsNarrowed = Assert<Eq<StatusHistoryEntryFor<'RNP'>['toStatus'], SharedStatus>>;

/** The cross-agency citizen row still carries its agency label. */
type _ApplicantRowKeepsAgency = Assert<
  Eq<ApplicantApplicationSummaryFor<'RDF'>['agency'], 'RDF' | 'RNP' | 'RCS'>
>;
