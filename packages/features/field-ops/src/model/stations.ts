// ══════════════════════════════════════════════════════════════════
// field-ops — the station model (ADR-FE-011)
//
// PURE. A station is available when the officer's session grants it; it is
// never a free choice. The permission names are the backend's, verbatim
// (packages/shared-auth/src/permissions.ts), and this list is a USABILITY
// layer only: the edge and the owning service still refuse an unpermitted
// write, whatever the tablet shows.
//
// `built` says whether this release ships the station's screen. S02 ships the
// gate and the walk-in desk; S08 fills the rest. An unbuilt station is shown to
// an officer who holds its permission (so the picker tells the truth about
// what exists) but it is not a link.
// ══════════════════════════════════════════════════════════════════

export const STATION_IDS = ['gate', 'documents', 'physical', 'medical', 'walk_in', 'supervisor'] as const;
export type StationId = (typeof STATION_IDS)[number];

export interface StationDefinition {
  readonly id: StationId;
  /** Any ONE of these grants the station. */
  readonly anyOf: readonly string[];
  /** Agencies that run this station at all; null means every agency. */
  readonly agencies: readonly string[] | null;
  /** The route this release mounts for it, or null while it is unbuilt. */
  readonly path: string | null;
}

export const STATIONS: readonly StationDefinition[] = [
  { id: 'gate', anyOf: ['admission.gate'], agencies: null, path: '/gate' },
  { id: 'documents', anyOf: ['document.verify.venue'], agencies: null, path: null },
  { id: 'physical', anyOf: ['field.score.sync'], agencies: null, path: null },
  { id: 'medical', anyOf: ['medical.review'], agencies: null, path: null },
  // ADR-012: the walk-in lane is RDF's alone; RNP and RCS recruit online only.
  { id: 'walk_in', anyOf: ['walkin.register', 'walkin.vet', 'identity.verify'], agencies: ['RDF'], path: '/walk-in' },
  { id: 'supervisor', anyOf: ['field.conflict.resolve', 'field.device.enroll'], agencies: null, path: null },
];

export interface StationSession {
  readonly agency: string;
  readonly permissions: readonly string[];
}

export interface AvailableStation {
  readonly id: StationId;
  readonly path: string | null;
  readonly built: boolean;
}

/** The stations this session may open, in picker order. */
export function stationsFor(session: StationSession | null): readonly AvailableStation[] {
  if (session === null) return [];
  const granted = new Set(session.permissions);
  return STATIONS.filter(
    (station) =>
      station.anyOf.some((permission) => granted.has(permission)) &&
      (station.agencies === null || station.agencies.includes(session.agency)),
  ).map((station) => ({ id: station.id, path: station.path, built: station.path !== null }));
}

/** True when this session may open the station at `path` (routing guard, not authorization). */
export function mayOpenStation(session: StationSession | null, path: string): boolean {
  return stationsFor(session).some((station) => station.path === path);
}
