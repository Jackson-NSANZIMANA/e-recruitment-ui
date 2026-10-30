# ADR-FE-011 — The station model: permission-derived stations, venue/day session, the degraded-gate rung

**Status:** Accepted · 2026-10-18 (S02, scaffold) · S08 fills the stations

## Decision

1. **A station is available when the session grants it; it is never a free choice.** `stationsFor(session)` (`packages/features/field-ops/src/model/stations.ts`) derives the list from the backend's permission names:

   | Station | Any of | Agencies | S02 |
   |---|---|---|---|
   | Gate | `admission.gate` | all | built (`/gate`) |
   | Paper documents | `document.verify.venue` | all | S08 |
   | Physical | `field.score.sync` | all | built (`/physical`, S08) |
   | Medical | `medical.review` | all | built (`/medical`, S08) |
   | Walk-in | `walkin.register`, `walkin.vet`, `identity.verify` | RDF only (ADR-012) | built (`/walk-in`) |
   | Supervisor | `field.conflict.resolve`, `field.device.manage` | all | built (`/supervisor`, S08; ADR-FE-016) |

   This is a usability layer: the edge and the owning service still refuse an unpermitted write.
2. **The picker** (`/stations`, the Field Station's start page) shows only granted stations, links the built ones and marks the rest "not yet available" without a link. A session with no station gets a plain answer pointing at the officer console.
3. **Venue and day.** Until a venue/session read exists (B-5/B-6), the gate's venue is typed once and confirmed, remembered on the device, and matched case- and space-insensitively by the server (ADR-034). S08 moves this to a `/setup` step that fixes venue and exam day for the session and runs the device readiness check (ADR-FE-010).
4. **Degraded gate rung.** When the edge is unreachable, the gate may verify the signed `USRP-SLOT.v1` invitation offline (Ed25519 public key; `features/scheduling` verifier, S08) and show it as a visibly degraded result that **cannot spend the QR**; admission still requires the online `admitAtGate`.

## Consequences

Each new station is a field-ops route added to `createFieldOpsRoutes`, a manifest in `docs/ui-surfaces/field.*.json`, and `path` set in `STATIONS`.
