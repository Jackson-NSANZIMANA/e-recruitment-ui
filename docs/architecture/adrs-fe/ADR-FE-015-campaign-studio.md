# ADR-FE-015 — The Campaign Studio follows the real control plane

**Status:** Accepted · 2026-10-29 · Session S05 · Backend: BUILD-001, ADR-030, ADR-031

## Context

Until S05 only `pnpm rehearse` could create a campaign. A product for agency administrators must not be generic CRUD with a "published" checkbox: the backend control plane (BUILD-001) has four ordered steps with different failure modes, an immutable policy version with a hash, a coverage rule, and a frozen published structure. The Studio has to be that control plane made usable, and provably the same one the rehearsal drives.

## Decision

1. **One screen per control-plane step, in the order the server enforces.** Draft, then immutable policy version, then one session per target district, then preflight and publish; close, complete and cancel afterwards. The basics are create-only (there is no edit-draft operation); a published campaign is read-only everywhere (`frozen`).
2. **Pure models, mirrored from the server, server still authoritative.** `draft.ts` mirrors `campaign-validation.ts` (code token, 50-character label, chronology, agency categories, walk-in policy); `sessions.ts` and `preflight.ts` mirror the coverage and publish gates. The server's refusal is always rendered: per field when it names one, otherwise as a message that points to the failing step (`stepOfRefusal`).
3. **The policy lives in one module, `model/policy.ts` (contract v1).** The platform supplies no official thresholds, so engine constants are offered as *suggestions*, labelled as such, and each category must be confirmed by the officer before the command can be built (`validatePolicy`); legal basis code and reference are never defaulted. S12c adopts policy v2 (ADR-049) by replacing this module and `PolicyStep.tsx`; nothing else in the Studio knows the document's shape.
4. **The hash is shown, then verified on the device.** The edge returns the SHA-256 of canonical JSON v1 over `{ legalBasisCode, legalBasisReference, policyDocument }`; `policyDigest` recomputes it with WebCrypto and the screen says whether the two agree. The same inputs give the same hash whether they came from the Studio or from `pnpm rehearse` (proved live, `live-campaign-studio.spec.ts`).
5. **The diff compares with the last version this device saved.** The admin read returns the policy's version, hash and legal basis, not its document, so a server-side diff is not possible today. The screen says what the comparison is made against. A policy document in the admin read is a backend request (recorded in the S05 hand-off).
6. **Idempotency is per intent.** `useIntentKey` keeps one UUID per form while the body is unchanged and mints a new one when it changes (`keyForIntent`); a retry replays, and the screen says "already done" for an `Idempotency-Replayed` answer. No write is retried automatically.
7. **Typed confirmation for every consequential command.** Publish, close, complete and cancel use `TypedConfirm` (the shared `ConfirmAction` plus the public code typed). The consequence lines carry counts from the admin read, or "unavailable" when the read lacks them, never zero.
8. **Permissions build the UI.** The menu item needs `campaign.read.admin`; every write control needs its own `campaign.*` permission; the agency is the session's, never a field. The edge and services re-check everything.
9. **Times are Kigali times, said so.** `kigali.ts` converts the datetime-local value to an instant with an explicit `+02:00` (Rwanda has no daylight saving), and every date on screen names its zone.
10. **Citizen preview is a deliberate copy.** Slices never import each other, so `CitizenPreview` mirrors the applicant portal's campaign card field for field, fed only by fields the public projection carries.

## What this does not claim

- **The hash check proves consistency, not correctness of the policy.** A wrong threshold hashes just as well. The confirmation step and the legal basis are what carry the officer's responsibility.
- **Walk-in for RCS** stays off in the Studio (`WALKIN_POLICY`); S12c may change the policy and this constant with it.
- **The policy diff is per device.** A different browser or a cleared session shows "every field is new".
- **Persona applications to a Studio campaign** are exercised by the applicant portal's live spec, not by this ADR's proof; the Studio proof stops at the public projection.

## Consequences and proofs

- Models: `packages/features/campaigns/src/model/studio.test.ts`, `campaigns.test.ts`.
- Mocked E2E for every manifest state: `apps/officer-console/e2e/campaign-studio.spec.ts`.
- Live: `apps/officer-console/e2e/live-campaign-studio.spec.ts` (policy-hash parity with `pnpm rehearse --sandbox rdf-2026`).
- Surface manifest `docs/ui-surfaces/officer.campaign-studio.json` at E2E-PROVEN.
