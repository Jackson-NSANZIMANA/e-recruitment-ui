# USRP — Unified Engineering and National Deployment Baseline

## Comprehensive product specification, architecture, security, operational readiness, and delivery plan

**Source date:** 15 October 2026 (source snapshot date)  
**Purpose:** Unify the product/domain research and the adversarial national-deployment review into one controlled baseline for the Applicant Portal, Field Officer Tablet, Officer Administration Portal, and the backend and operating model that coordinate them.
**Status:** Authoritative proposed target-state baseline; not a production-readiness certification, legal opinion, security certification, or proof that any current code/test claim has been independently rerun.
**Source documents unified:** `usrp_unified_research_findings(1).md` and `USRP — National Deployment Baseline v2 (Adversarial Review).md`. The former supplies detailed product/domain requirements and repository-derived findings; the latter adversarially tests those claims and adds national operating, identity, offline, resilience, residency, and release-integrity controls.

> **Evidence rule.** `Observed` means supported by the source snapshot, contract, test, or accepted ADR described by a source; it is not independently verified by this merge unless an artefact is cited. `Proposed` means a target capability or threshold. `Owner decision` means agency leadership, recruitment operations, security, legal, or the DPO must decide it. `Unverified` means evidence is unavailable or sources disagree. A route, type, or ADR is not by itself proof that a complete user journey works in the deployed environment.

> **Errata (S00, 2026-10-16). Read before relying on any "current state" claim below.**
>
> - **SHAs.** This baseline inspected backend `bd939f61` and frontend `cd27d111` (both 2026-10-15). Both `main` branches have moved on since. The frontend now pins backend `df80f651` (`BACKEND_SHA` in `ci.yml`, `EDGE_BACKEND_SHA` in `paths.ts`).
> - **Operation count.** "42 backend / 42 frontend operations" was true at `bd939f61`. From `df80f651` there are **43**: ADR-034 added `admitAtGate`.
> - **ADR-034, single-use gate admission (BUILD-003).** It landed after this snapshot (backend PR #32, frontend PR #25). It provides one admission per QR (DB-unique), bound to the national ID card, with every scan logged, online only. Where this baseline treats gate admission as unbuilt, read it as built for the online case. Offline admission and biometric evidence remain open.
> - **Do not cite counts or SHAs from this document.** Each CI run of either repository publishes an `evidence-<sha>` artefact (*Evidence bundle* job) holding `evidence-<sha>.json`: the operation inventory with typed and untyped IDs, the pinned peer SHA, proof and test counts with every skipped test named, and the lockfile hash. Cite the bundle for the commit you mean.
> - The stray prompt text noted in W0-01 is no longer present. This file was renamed from `user-facing-feature-spec-2026-10-15.md`.

## Contents

- [1. Unified executive conclusion](#1-unified-executive-conclusion)
- [2. Evidence and readiness model](#2-evidence-and-readiness-model)
- [3. Business process redesign](#3-business-process-redesign-the-target-operating-model)
- [4. Applicant Portal specification](#4-applicant-portal-specification)
- [5. Officer Tablet / field operations](#5-officer-tablet--field-operations-specification)
- [6. Officer Administration Portal / control room](#6-officer-administration-portal--operations-control-room-specification)
- [7. Cross-system architecture](#7-cross-system-architecture-recommendations)
- [8. Security, privacy, fairness and resilience](#8-security-privacy-fairness-and-resilience-requirements)
- [9. Consolidated functional and non-functional requirements](#9-consolidated-functional-and-non-functional-requirements)
- [10. Operational KPIs](#10-operational-kpis-and-dashboard-definitions)
- [11. Unified backend and product backlog](#11-unified-backend-and-product-backlog)
- [12. Owner decisions](#12-owner-decisions-that-must-not-be-silently-invented)
- [13. Dependency-aware delivery plan](#13-dependency-aware-engineering-delivery-plan)
- [14. Release gates and definition of done](#14-release-gates-and-definition-of-done)
- [15. National deployment hardening baseline](#15-national-deployment-hardening-baseline)
- [16. Final recommendation and implementation directive](#16-final-recommendation-and-implementation-directive)

---

# 1. Unified executive conclusion

USRP should be developed as **one national recruitment process expressed through three specialised workspaces**, not as three independent products with separate copies of recruitment logic.

The backend has a significant domain foundation: campaign control, applicant identity and OTP onboarding, age/academic/criminal eligibility checks, document-forensics lanes, application-state projection, slot reservation and signed invitations, field-device and score-sync operations, cross-agency acceptance controls, agency-specific medical processing, audit, erasure, and operation-level permissions. The frontend has an applicant SPA, an officer SPA, six shared domain-feature packages, a typed edge API client, generated service contracts, Atlassian Design System (ADS) components and tokens, Kinyarwanda/English/French resources, and PWA shell configuration.

The primary product gap is no longer simply “missing backend APIs”. It is the distance between **available domain operations** and **complete, understandable, field-tested operating workflows**. The highest-value work is to close those gaps in a disciplined order:

1. keep the backend and frontend contract baselines pinned to the same commit, and remove stale contradictory architecture claims;
2. prove the flagship officer application workspace against its declared surface contract;
3. make the applicant journey—from public campaign choice to successful application, documents, accurate status and exam pass—fully testable end to end;
4. deliver the minimum Campaign Studio needed to operate a recruitment cycle through the product rather than manual/engineering intervention;
5. implement the station-based field workflow, then prove durable offline capture, replay and conflict resolution before the tablet claims it can sync offline records;
6. build the administration command layer and operational read models on real data; and
7. resolve the remaining ownership, security, and policy decisions before production scale.

**North star:** one authoritative application lifecycle; one versioned policy for each filing; one audit trail; and three role-appropriate views of the same operational truth. Citizens see clear next steps. Officers see exact state, history, and permitted actions. Administrators see throughput, capacity, exceptions, staffing, delivery, and service health.

## 1.1 Binding merge decisions — read before implementation

The following decisions reconcile the two source documents. They are the controlling interpretation of this master baseline wherever a later detailed inventory or historical source note appears to conflict.

1. **Evidence provenance beats prose.** The source-refresh report records backend `bd939f61b3fd2f44299c11229783561f6bee1a0c`, frontend `cd27d111204ac33550e83ad91bab2e8839af5299`, and 42 matching method/path pairs. The adversarial reviewer could not independently inspect the backend and could not confirm the same public repository state. Therefore those SHAs/counts are _reported snapshot claims_, not independently certified facts. Before implementation or release, publish CI-generated contract-diff, build, test, and SHA artefacts from a tagged release. Do not rely on moving `main` prose or path equality alone.
2. **Path parity is not full contract parity.** The automated contract gate must compare operation identity, HTTP method/path, request and response schemas, session type, permission metadata, error semantics, idempotency/retry rules, and version compatibility. Run consumer-driven contract tests in both repositories.
3. **OTP is contact-channel verification, not identity proof.** National ID and date of birth are identifiers, not secrets. SMS/PSTN OTP is a restricted factor and must be risk-assessed. Use a lawful, approved identity path, non-enumerating errors, abuse controls and supervised venue identity checks. Step up irreversible actions according to an owner-approved risk policy; always offer a supervised non-biometric alternative.
4. **Manual photo comparison is the baseline for venue identity.** Biometrics are optional, blocked until the API, lawful basis, accuracy, retention, fallback and operational policy are approved. Do not make biometrics the sole route through the gate or persist raw biometric samples by default.
5. **Browser storage is not the authoritative record for exam-day evidence.** A PWA shell may load offline, but IndexedDB alone is not an acceptable national system of record. For the pilot, choose a standardised managed Android fleet with persistent storage and a passed eviction/restart drill; plan a native/wrapped client with encrypted database and hardware-backed key for national scale unless an equivalent control is proven. Keep `OFFLINE_CAPTURE_CAN_SYNC = false` until durability, replay, conflict and closeout proof passes.
6. **Paper fallback is part of the first pilot, not a future enhancement.** From the first pilot, rehearse pre-printed rosters, carbon-copy score sheets, dual-person re-entry, reconciliation and venue relocation. Digital capture must never be the only way to complete an exam day.
7. **Separate API no-store from a candidate-held pass.** Sensitive invitation reads remain `no-store`. A candidate may deliberately download or print the signed pass; an approved SMS short code is a fallback. The signed payload remains minimal and PII-free. The pass proves invitation, not the holder's identity.
8. **System-initiated relocation/rescheduling is P1.** Operators must be able to relocate or reschedule an unusable venue/session, invalidate superseded passes, issue replacement invitations, notify candidates and reconcile capacity/audit. Applicant-requested rescheduling is a separate policy-dependent feature and remains later until authorised.
9. **Assisted access is a launch requirement.** Agent-assisted application/account recovery and pass printing must be available for the pilot. USSD and broader SMS status features are later channel expansions, not prerequisites to confuse with the assisted desk. A responsive web page alone is not channel parity.
10. **Data residency and recovery planning are critical-path work.** Confirm Rwanda hosting, backup, disaster-recovery locations, transfer authorisations and encryption-key custody with qualified legal counsel/DPO before real personal data is processed. The proposed target is two qualified recovery sites in Rwanda; alternatives require documented approval and a demonstrated lawful basis.
11. **Clear the design-system licence before further dependency expansion.** ADS-based architecture and prior implementation can inform the design, but the adversarial review raises a material licensing concern for a national portal and a vendored mirror archive. Obtain written legal/licensing clarification. If permission is not clear, migrate to an appropriately licensed open design system. Keep the shared design-system architecture independent of the chosen component library.
12. **Operational readiness is a product requirement.** A national launch requires named owners, runbooks, registry call budgets, SLOs, RPO/RTO, restore proof, a control room, trained field teams, multilingual incident messages, version/policy attestation, a pilot district, hypercare and explicit stop authority.
13. **Do not turn assumptions into policy.** Capacity estimates, SLOs, ASVS levels, legal interpretations, identity-step-up rules, slot assignment, physical/medical thresholds, rejection disclosures, and cross-agency metrics remain proposals until ratified by their named owners and evidenced.
14. **Feature readiness has six rungs.** `EDGE-AVAILABLE → CLIENT-WIRED → SCREEN-BUILT → E2E-PROVEN → LOAD-PROVEN → OPERATIONALLY-READY`. `NEW / OWNER DECISION` and `EXTEND` remain change classifications, not readiness levels. No release can skip a rung applicable to its risk.

## 1.2 The integrated delivery principle

The product roadmap and deployment-readiness plan are one plan. Evidence, legal/residency, design-system licence, identity assurance, paper/assisted fallback, operator rescheduling, recovery architecture and release integrity begin in Wave 0/1. They are not deferred to a final “hardening” phase. Implementation breadth scales only after the flagship officer application workspace and one auditable cross-workspace recruitment journey are proven.

## 1.3 Critical correction from the source refresh

The first source snapshot inspected during the earlier study was overtaken by a frontend merge during this review. The current inspected `main` heads are:

| Repository                                                                                                         | Current inspected `main` commit            | Commit date (UTC) | Relevance                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Backend](https://github.com/Jackson-NSANZIMANA/e-recruitment/commit/bd939f61b3fd2f44299c11229783561f6bee1a0c)     | `bd939f61b3fd2f44299c11229783561f6bee1a0c` | 2026-10-15 10:41  | Current edge operation registry and backend permission/flow changes reviewed here.                                            |
| [Frontend](https://github.com/Jackson-NSANZIMANA/e-recruitment-ui/commit/cd27d111204ac33550e83ad91bab2e8839af5299) | `cd27d111204ac33550e83ad91bab2e8839af5299` | 2026-10-15 15:30  | Merges PR #24, including campaign-bound application submission, document upload integration, and the downloadable exam QR UI. |

**Superseded finding:** the previous report's “27 frontend operations” and missing `campaignCode` claims described the earlier frontend snapshot. They must not be treated as current. A fresh static comparison of the current edge registries found 42 backend edge operations and 42 frontend operations with matching HTTP method + path pairs; frontend `EDGE_BACKEND_SHA` is now pinned to backend `bd939f61…`. The new applicant wizard also includes `campaignCode` in the submission body. This is source-level alignment, not proof that the E2E journey currently passes.

This correction is important because the older `docs/architecture/cross-repo-contract-reconciliation-2026-10-04.md` still states the old 27-operation inventory and backend SHA `06d9f9b6…`. Current comments in the applicant landing page, field connection-status component, and older citizen E2E test also contradict newer implementation. The first cleanup action is to refresh the evidence register and stale claims rather than repeat them as live defects.

---

# 2. Evidence and readiness model

## 2.1 Sources inspected

- Backend repository: [Jackson-NSANZIMANA/e-recruitment](https://github.com/Jackson-NSANZIMANA/e-recruitment)
- Frontend repository: [Jackson-NSANZIMANA/e-recruitment-ui](https://github.com/Jackson-NSANZIMANA/e-recruitment-ui)
- Backend handbook: [`000.md`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/main/000.md)
- Backend current edge registry: [`edge-operations.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/main/services/edge-gateway/src/domain/edge-operations.ts)
- Frontend current operation registry: [`paths.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment-ui/blob/main/packages/api-client/src/paths.ts)
- Frontend architecture: [`frontend-architecture.md`](https://github.com/Jackson-NSANZIMANA/e-recruitment-ui/blob/main/docs/architecture/frontend-architecture.md)
- Officer reference-surface contract: [`officer.application-workspace.json`](https://github.com/Jackson-NSANZIMANA/e-recruitment-ui/blob/main/docs/architecture/frontend-agent/officer.applications.json)
- Backend decisions: ADR-003 (offline field sync), ADR-006 (single writer/projection), ADR-008 (scheduling gate), ADR-011 (late adjudication), ADR-012 (RDF walk-in), ADR-013 (agency-specific medical), ADR-014 (cross-agency accept lock), ADR-015/019/020 (erasure, retention, self-service), ADR-026 (slot ledger/capacity), ADR-027 (submission integrity), ADR-030 (campaign-bound submission/document door), ADR-031 (permissions/separation of duties), ADR-032 (document requirements), ADR-033 (downloadable exam QR).
- Claude's uploaded source: _USRP — User-Facing Feature Specification_, dated 2026-10-15, including A1–A16, C1–C7, P1–P3, Q1–Q6, F1–F4, T1–T11, B-1–B-13, owner decisions, and suggested delivery waves.
- Previous architecture study: _USRP — End-to-End Recruitment Transformation_.

The repository review is static. I did not run either local workspace's full build, E2E suite, database-backed selfchecks, government integration tests, production telemetry, or a security audit during this consolidation. Where the checked-in docs claim gates are green, that remains a repository-authored claim unless independently run against this source snapshot.

## 2.2 Feature-readiness vocabulary

Claude's original `READY / EXTEND / NEW` tags are useful, but **“the edge operation exists” is not the same as “the feature is ready for users.”** This report uses a layered readiness model so those claims do not get conflated.

| Label                    | Meaning                                                                                                     | Evidence required                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **EDGE-AVAILABLE**       | The current backend edge operation is defined and routed.                                                   | Current backend edge registry and route composition.                            |
| **CLIENT-WIRED**         | The frontend has a typed operation and schema aligned with the current backend.                             | Frontend registry/client/contract-drift checks against the pinned backend SHA.  |
| **SCREEN-BUILT**         | A real route implements the business journey and all relevant states, not just a title or placeholder.      | Surface manifest, UI source, component/API bindings, accessible state coverage. |
| **E2E-PROVEN**           | A real automated test crosses the relevant screens and edge behavior; it is not skipped or `test.fixme`.    | Test run results against the target contract and dependencies.                  |
| **LOAD-PROVEN**          | The service meets ratified throughput/latency/error targets under realistic and stress/failure load.        | Repeatable load/soak/failure-test artefacts tied to a release.                  |
| **OPERATIONALLY-READY**  | Owners, runbooks, monitoring, on-call, rollback, recovery, training and field procedures are tested.        | Signed operational readiness review and rehearsal evidence.                     |
| **EXTEND**               | Existing backend data/service needs an additional public read, safe projection, field, or capability.       | Contract change, owning service, security, migration, and tests.                |
| **NEW / OWNER DECISION** | The proposed feature needs new domain behavior, data model, workflow rule, legal basis, or policy approval. | ADR and named owner decision before implementation.                             |

At the current source level, the operation registries are aligned by path and pinned SHA. That is a meaningful improvement since the earlier snapshot. However, the field-operations slice explicitly keeps `OFFLINE_CAPTURE_CAN_SYNC = false`, its three station route modules remain placeholder views, the scheduling verifier route is only a stub view, the adjudication and DPO queue routes remain minimal, and related E2E tests remain `test.fixme`. Those facts prevent calling the end-to-end operational product “ready”.

## 2.3 Current product inventory

| Area                          | Observed current source                                                                                                                                                                                                                           | What it means                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Applicant Portal              | Campaign selection inside the application wizard; three-stage identity flow; category/education/declaration/review; idempotent submit; upload component; application status/list; downloadable/printable exam QR route; privacy/compliance slice. | Substantially more exists than in the older snapshot, but policy-aware checklist, gate-level status explanation, outcome notices/letters, and active E2E proofs remain gaps.                                    |
| Officer Console               | Dashboard, application list/detail/action workspace, RDF walk-in route, and mounted feature slices for adjudication, compliance, field ops, and scheduling.                                                                                       | It is one SPA currently serving officer/admin/field contexts, not three finished apps. The current dashboard is not the full command centre; several mounted feature routes are stubs.                          |
| Officer Administration Portal | Campaign mutation operations and typed client helpers exist; no dedicated `apps/admin-console` route/application is present in the current frontend tree.                                                                                         | Campaign Studio, resource planning, monitoring, administration and analytics need real product screens. Backend operations should be reused rather than recreated.                                              |
| Browser edge                  | The two source registries have 42 methods/paths each, and their exact method/path pairs match in the source inspected.                                                                                                                            | Keep the registry as the one approved browser boundary. Continue automated reconciliation at every change.                                                                                                      |
| Field sync                    | Current backend edge operations and frontend client identifiers include device enrolment, score sync, and conflict resolution.                                                                                                                    | Network reachability is no longer the only blocker. Durable encrypted local queue, idempotent replay, capture models, and conflict UX must still be implemented and proved before enabling offline sync claims. |
| Administration read models    | Public campaign reads and current application/queue reads exist; public campaign list is not an admin all-state list. Application list contract notes a cap of 100 and no server filter/cursor/total.                                             | Dashboard aggregates, historic campaign reads, counts, and scalable search/pagination need extension.                                                                                                           |

---

# 3. Business process redesign: the target operating model

## 3.1 One process, three lenses

The lifecycle and governing policy remain in backend domain code and database constraints. The UIs should not create their own competing statuses or eligibility logic.

- **Applicant lens:** plain-language stage, what has happened, what is being checked, what the applicant must do next, the official reporting information, and safe rights/self-service options.
- **Field-officer lens:** verified candidate identity, valid credential, station-specific tasks, exact measurement/verdict capture, attributable actions, and per-record sync/reconciliation state.
- **Administration lens:** campaign authoring, policy version, district/session coverage, capacity, staffing, device readiness, queue aging, flow metrics, exceptions, audit, and final closeout.

Application status, document requirement state, individual vetting verdicts, slot/invitation state, field-sync record state, notification delivery state, and campaign lifecycle are distinct state machines. UI labels may group technical values for comprehension; they must not merge or rewrite authoritative state.

### Citizen-facing stage projection (presentation only)

The backend currently declares 21 canonical `APPLICATION_STATUSES`. The table below is a proposal for plain-language presentation; it is not a new backend enum and it must be verified against the status returned for each actual path.

| Citizen-facing stage             | Canonical statuses normally represented                       | Citizen-facing explanation                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Submitted                     | `SUBMITTED`                                                   | The system received the application. Do not describe an unfiled local draft as submitted.                                                                                           |
| 2. Being checked                 | `ACADEMIC_VETTING`, `CRIMINAL_CLEARANCE`                      | Identity/eligibility evidence is being processed; individual gate details are shown only through an approved safe projection.                                                       |
| 3. Document review               | `DOCUMENT_REVIEW_GREEN`, `DOCUMENT_REVIEW_AMBER`              | Automated checks have either cleared the applicable evidence or a specific document needs further review. The checklist itself is advisory and does not silently block progression. |
| 4. Invited                       | `SLOT_ASSIGNED`, `PHYSICAL_TEST_SCHEDULED`                    | A slot has been assigned. The Exam Pass is valid only when the invitation service reports `READY`.                                                                                  |
| 5. Tested / decision in progress | `PHYSICAL_TEST_COMPLETE`, `MEDICAL_REVIEW`, `FINAL_SHORTLIST` | The physical assessment, medical review or final selection process is underway. Medical data is not displayed as a generic one-size-fits-all form.                                  |
| 6. Outcome                       | `ACCEPTED`, `REJECTED`                                        | Show the confirmed outcome and approved next steps. A detailed rejection reason needs a separately approved disclosure policy.                                                      |
| On hold                          | `ADJUDICATION_REVIEW`                                         | The file needs additional human review. The QR invitation is withheld; the message must not imply guilt.                                                                            |
| Closed / withdrawn               | `WITHDRAWN`                                                   | Explain whether the applicant withdrew or another agency's acceptance caused an automatic withdrawal.                                                                               |

`DRAFT` is not a “we received your application” status. RDF walk-in statuses (`WALK_IN_REGISTERED`, `WALK_IN_ON_SITE_VETTING`, `WALK_IN_PHYSICAL_TEST`, `WALK_IN_REJECTED`) belong to the on-site route and should not be presented as a normal citizen-portal application timeline. This mapping must remain a view over the canonical enum and be tested against the application's actual status transitions.

## 3.2 Redesigned end-to-end recruitment flow

1. **Plan the cycle.** An agency administrator drafts a campaign with a public code, label, targeted categories/districts, registration and examination windows, reporting hour, intake target, contacts, and (where authorised) the RDF-only walk-in policy.
2. **Version the eligibility and document policy.** Create an immutable policy version with SHA-256 fingerprint and a complete category policy. Every target category needs its explicit age/reference date, education path and criteria, criminal-clearance threshold, required document set, and medical mode/legal basis. Policy suggestions can be prefilled from approved campaign data but must not silently become official policy.
3. **Plan district × exam-day sessions.** Allocate venue and capacity. Validate coverage of required districts, opening/closing chronology, venue/day consistency, and capacity. The backend's publication and reservation rules remain authoritative.
4. **Run pre-publication checks.** Show missing coverage, invalid dates, policy omissions, capacity errors, role/approval requirements, and a public citizen preview. Publishing opens the registration window; do not invent a separate deadline state that diverges from `registrationClosesAt`.
5. **Publish and discover.** Citizens can see open campaigns with categories, closing date, examination window, eligibility summaries, required documents, and the RDF walk-in note where applicable. A pre-check may help citizens understand category fit, but the backend is authoritative.
6. **Verify identity and establish a session.** National ID and date of birth are identifiers, not secrets. Follow the approved lawful identity-verification path, collect and verify the contact channel with OTP, apply rate limits and SIM-change/porting risk signals where available, and establish the defined opaque session. OTP proves control of a phone channel, not identity by itself. Provide non-enumerating failure copy, expiry/retry guidance and a supervised recovery path. Apply step-up to irreversible actions only under a ratified risk policy.
7. **Submit against a specific campaign.** Select a public campaign code and its category. Collect the NESA index number or HEC registration number dictated by the category. Present a declaration, review what will be filed, and submit a campaign-bound request with an idempotency key. A repeat of the same intent must replay safely; a changed body with the same key must not create a second application.
8. **Run the three eligibility gates asynchronously.** Age, academic verification (NESA/HEC), and criminal clearance (RIB) run under the bound policy and reference date. The citizen sees accurate progress but never raw registry details, forensic scores, secrets, cross-service identifiers, or internal risk data.
9. **Handle document requirements truthfully.** For each policy-bound item, show one of the permitted satisfaction states. Automated verification can waive paper where the policy says so; items without an authoritative registry may require an upload or physical presentation. The document checklist is advisory and does not independently block progression unless an approved transition explicitly says so.
10. **Assign a slot after eligibility clears.** The scheduling gate assigns venue and reporting details. A slot reservation is idempotent; at-least-once event delivery must not mint a different ticket on replay. The signed QR becomes visible only when the invitation is genuinely ready. Pending, on-hold, unavailable, walk-in, expired, and closed states must never be rendered as a valid pass.
11. **Prepare the field operation.** Before exam day, administrators assign venue/day/station roles, devices, contacts, and staffing; verify venue capacity and invitation key availability; then publish/print a run sheet and preload only the minimum venue roster required for the event.
12. **Operate stations.** Gate staff verify QR signature, venue/day and expiry offline; match the candidate's identity by approved procedure; inspect paper documents; then issue a bib/heat assignment. Physical-test staff capture measurements and assessment results. Medical staff use the agency-specific board/certificate workflow. A supervisor owns conflicts and station escalation.
13. **Synchronise and reconcile.** The tablet persists each capture with provenance and device signature. It displays queued/sending/accepted/rejected/conflict states per record. After connectivity returns, records are replayed idempotently; conflicting signed records are adjudicated by a permitted supervisor. An event is not closed until all records are accounted for, no silent sync errors remain, and a reconciliation summary exists.
14. **Adjudicate, decide and accept.** Amber document reviews and late/post-clearance adverse holds enter human queues. Medical assessment precedes final decision according to the policy. Role permissions and separation-of-duties rules are server-enforced. Acceptance invokes the cross-agency lock and auto-withdrawal semantics; duplicate processing must not create inconsistent records or duplicate notices.
15. **Notify and support the citizen.** Provide status, appointment/reporting details and available outcome information through existing approved channels. Distinguish SMS sent, provider-accepted, delivered (if the provider proves it), and failed. Provide an in-portal notice view only when a safe read API exists. Any rejection explanation needs an agreed disclosure policy.
16. **Close the cycle.** Reconcile attendance and no-shows, field records, decisions, appeals/corrections if approved, capacity, notices, outstanding holds, device return/revocation, audit completeness, retention deadlines, and reports. Only then should the campaign be marked operationally complete.

## 3.3 Corrected business rules from the source

| Question in the initial SFRS / Claude spec | Unified finding                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign create → publish → open           | Existing backend command flow is **draft → immutable policy version → district sessions/coverage → publish**. Publishing opens registration; publication checks reject incomplete policy/session/capacity conditions. Build those steps in the Campaign Studio.                       |
| Registration dates versus exam dates       | These are two windows, not one ambiguous deadline: registration opens/closes and examination start/end plus reporting hour.                                                                                                                                                           |
| Eligibility versus fitness                 | Age/academic/criminal eligibility is asynchronous; physical and medical fitness occurs at the venue. Keep separate requirements and state.                                                                                                                                            |
| Criminal proof via local authority         | The current defined criminal-clearance path is RIB. A local-authority attestation is not evidenced as an integration; add only if an agency requires it.                                                                                                                              |
| When to issue QR                           | ADR-033 settles it: the QR is the signed slot invitation, available as `PENDING`, `READY`, `ON_HOLD`, and other defined terminal/unavailable states. Do not mint a generic admission QR immediately after submission.                                                                 |
| Device management                          | Device enrolment and score-sync commands exist. Fleet listing, assignment to venue/kit, last-seen/status and revocation are not a complete exposed fleet API. Enrolment permission is currently a field role concern, not automatically `agency_admin`.                               |
| Walk-in                                    | The walk-in path is RDF-specific. NIDA identity verification at venue is online in the current decision; offline raw-NID intake is a flagged follow-on because it places sensitive information on a disconnected device.                                                              |
| Administrator authority                    | There is no unrestricted superadmin principal. Agency authority is derived from the verified principal and enforced with forced database RLS. National aggregates, if required, need a separately designed and governed aggregate view.                                               |
| Medical forms                              | RDF uses an in-house medical-board verdict; RNP/RCS verify an approved government-physician certificate, including a physician name for a positive certificate verification. They must not be flattened to one generic form.                                                          |
| Document checklist                         | The bound campaign policy's requirement list wins; ground-truth list is fallback, not merged. The checklist is advisory; successful API verification can satisfy paper requirements when the policy says so. A notarised diploma may require both uploaded file and HEC verification. |

---

# 4. Applicant Portal specification

## Goal

Help a citizen understand available recruitment, submit one correct application with minimal repeated data entry, see what has truly happened, arrive prepared if invited, and exercise self-service/privacy rights without understanding agency/service internals.

## A1–A16 feature inventory and readiness

| ID  | Feature                                        | Current evidence / backend relationship                                                                                                                                                                         | Readiness and action                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Public campaign board                          | `listCampaigns` / `getCampaignDetail` are in the current edge/client registry. The latest wizard consumes `usePublicCampaigns`; the primary homepage is still not a rich stand-alone catalogue.                 | **PARTIAL.** Create a campaign catalogue/detail view with public code, targeted categories, date windows, contacts, walk-in note, capacity availability only if supported, and shareable URLs.                                                                                                                                                                                                             |
| A2  | “Am I eligible?” pre-check                     | Public campaign read does not expose a safe, complete public policy summary of age band, education mode and required documents.                                                                                 | **EXTEND.** Add a curated public policy summary per published version. Pre-check is advisory, explain uncertainty and never promise eligibility.                                                                                                                                                                                                                                                           |
| A3  | Citizen onboarding                             | Current UI now presents National ID + date of birth → phone number → OTP. Backend ADR-029/identity paths establish the identity and session rules.                                                              | **SCREEN BUILT; E2E VERIFY.** Update the stale citizen E2E `test.fixme`; verify non-enumeration, DOB mismatch/lockout, expired OTP, repeated OTP, phone handling and session revocation.                                                                                                                                                                                                                   |
| A4  | Guided campaign-bound application wizard       | Current `apply/index.tsx` now chooses an open campaign, restricts categories to the campaign, asks the correct NESA/HEC reference, displays declaration/review and submits `campaignCode` plus idempotency key. | **SCREEN BUILT; E2E VERIFY.** Test campaign closed/wrong agency/category, duplicate, replay, same key/different body, offline attempt, and response-loss recovery.                                                                                                                                                                                                                                         |
| A5  | Smart document checklist and upload            | Current wizard uses `useUploadMyDocument`; upload response is intentionally “received”, not “verified”. It does not yet present the complete policy-aware checklist with current per-item satisfaction states.  | **PARTIAL / EXTEND.** Use `getMyDocumentChecklist` and upload operation; show `API_VERIFIED`, upload-cleared/under-review/rejected/missing, and “bring to venue” where those are actual API states. Never tell the citizen “verified” merely because the file uploaded.                                                                                                                                    |
| A6  | Live status tracker                            | Current citizen list displays the returned top-level status. No applicant-safe history/gate projection sufficiently explains all checks.                                                                        | **EXTEND.** Add sanitized status timeline + safe per-gate state (no NID, nationalIdHash, raw RIB detail, forensic score/flags, or internal risk). Define stage mapping against the 21 current statuses.                                                                                                                                                                                                    |
| A7  | Exam Pass wallet                               | Current `/applications/:applicationId/exam-qr` UI calls `useMyExamInvitation`, renders truthful state variants, and provides PNG download/print for a ready signed token (ADR-033).                             | **SCREEN BUILT; E2E VERIFY.** Prove ownership/authorization, `no-store`, signature payload preservation, PENDING/READY/ON_HOLD/UNAVAILABLE/closed state rendering, download/print, expiry/timezone and offline presentation.                                                                                                                                                                               |
| A8  | Cross-agency citizen view                      | `listMyApplications` is session-derived and designed to return the citizen's own applications across RDF/RNP/RCS. Backend accept-lock/auto-withdrawal are domain rules.                                         | **EDGE-AVAILABLE; VERIFY.** Explain that accepting one offer may withdraw other active applications and differentiate citizen-initiated withdrawal from automatic withdrawal.                                                                                                                                                                                                                              |
| A9  | Outcome/next-steps letter                      | No citizen-safe reason-category projection or signed decision-letter issuer is evidenced in current contracts.                                                                                                  | **NEW.** Decide allowed rejection disclosures, correction/appeal handling, issuer and signature/verification protocol. Do not invent reasons in the UI.                                                                                                                                                                                                                                                    |
| A10 | In-portal notice inbox                         | Notification service can send notices; there is no proven browser-safe per-applicant delivery history for all notifications.                                                                                    | **EXTEND.** Add an ownership-scoped notification read API; distinguish queued/sent/delivered/failed using provider evidence.                                                                                                                                                                                                                                                                               |
| A11 | Privacy centre                                 | Applicant withdrawal and erasure request filing/status APIs exist, and the citizen compliance routes are mounted.                                                                                               | **EDGE-AVAILABLE; SCREEN/E2E VERIFY.** Explain withdrawal impact; erasure request submission is not erasure completion. Show status and retention explanation approved by DPO/legal.                                                                                                                                                                                                                       |
| A12 | Amber document resolution/re-upload            | Applicant-safe amber signal and re-upload window are not exposed as a full workflow.                                                                                                                            | **NEW.** Define who may request re-upload, item-specific reason copy, evidence retention, number of attempts, deadline and effect on slot/eligibility.                                                                                                                                                                                                                                                     |
| A13 | Cannot attend/reschedule                       | Slot ledger is append-only and there is no complete superseding-reservation workflow.                                                                                                                           | **SPLIT PRIORITY.** System-initiated relocation/rescheduling is **P1**: an authorised operator must relocate an unusable venue/session, safely supersede capacity/reservation, invalidate old passes, issue new invitations, notify candidates and audit the change. Applicant-requested rescheduling remains **P3 / owner decision** until eligibility, capacity, notice and fairness rules are ratified. |
| A14 | Campaign alerts                                | Current messages are service/necessity notices (notably invitation/withdrawal), not a campaign-discovery subscription workflow.                                                                                 | **NEW + OWNER/LEGAL DECISION.** Agree separate consent/legal basis, opt-in/out, frequency, retention and suppression rules before opt-in messaging.                                                                                                                                                                                                                                                        |
| A15 | USSD / assisted kiosk parity                   | `USSD` and `IREMBO_KIOSK` appear as channel concepts but no complete USSD gateway is evidenced.                                                                                                                 | **ASSISTED ACCESS REQUIRED FOR PILOT; USSD LATER.** Provide staffed assisted application/account recovery and pass-printing capability from the first pilot, with privacy, identity, receipt and audit procedures. USSD and broader SMS self-service are **P2** after channel owner, security and privacy decisions. A responsive web page alone is not assisted-channel parity.                           |
| A16 | Kinyarwanda, English, French and low bandwidth | i18n bundles and PWA setup exist; media/strings and draft-handling mechanics are present in portions of the app.                                                                                                | **PARTIAL; PROVE.** Verify all relevant bundles, no missing interpolation keys, common Android behaviour, low-bandwidth recovery, keyboard/screen reader use and language switching mid-draft.                                                                                                                                                                                                             |

## Applicant acceptance requirements

1. A filing must name the campaign selected by the citizen. The client sends `campaignCode` and a UUID `Idempotency-Key`; the server resolves the actual agency/category/policy and derives applicant identity from the authenticated session.
2. Retry of the same request with the same key returns the original result; same key with changed content returns the defined key-reuse conflict; a new key must not bypass the one-live-application-per-intent invariant.
3. A valid signed exam QR is available only when the exact eligible slot invitation is ready. Do not generate a generic QR at submit time. Never show a valid pass when the backend says hold, pending, unavailable or terminal.
4. File upload means “received” until server evidence proves the next state. Applicant copy must not reveal forensics score/lane/signals, upstream identifiers or sensitive criminal record details.
5. “Withdrawn”, “rejected”, “auto-withdrawn following acceptance elsewhere”, and “erasure request pending/decided/executed” are distinct explanations.
6. The visible status and next step must be derivable from backend state and the safe projection. A stale/offline response must be labelled as last updated at a known time, not presented as live truth.

---

# 5. Officer Tablet / field operations specification

## Goal

A rugged, touch-first station application for venue operations: gate, document sighting, physical test, medical review, supervisor/conflict resolution. It must prioritise throughput and safe record capture over complex navigation. The same officer-console SPA currently includes tablet-related routes; a separate deployable tablet app is a future product/packaging decision rather than an assumption that it already exists.

## T1–T11 field feature inventory

| ID  | Feature                     | Current evidence / dependency                                                                                                                                                                                                               | Readiness and action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Device enrolment            | `enrollFieldDevice` is an edge/client operation guarded by `field.device.enroll`. Backend has enrolled field-device records and device signatures.                                                                                          | **EDGE-AVAILABLE; UI/POLICY VERIFY.** Build keypair/enrolment flow, show device identity and enrolled status; decide whether a field role or new fleet-management authority owns issuance.                                                                                                                                                                                                                                                                                                                                                                                      |
| T2  | Offline QR gate             | Signed invitation verification model/key caching exists in code/ADRs; `packages/features/scheduling/src/routes/verify-invitation.tsx` is presently a minimal stub.                                                                          | **MODEL EXISTS; SCREEN NOT BUILT.** Verify the signature, `keyId`, allowed claim shape, venue/day, expiry and ticket/application match offline. Stale/missing key and clock uncertainty must fail visibly and use an approved escalation path.                                                                                                                                                                                                                                                                                                                                  |
| T3  | Biometric check-in          | A biometric service and permission concept exist, but `verifyBiometric` is explicitly marked upstream-unverified and is not a current browser-edge operation. A negative match can be represented by HTTP 200 with a `verified=false` body. | **EXTEND/BLOCKED.** Do not build against a guessed API. Verify backend controller/edge/privacy contract first; display semantic verdict, never HTTP status alone. Store score/metadata only as approved; never raw face frames.                                                                                                                                                                                                                                                                                                                                                 |
| T4  | Paper-document sighting     | `verifyDocumentAtVenue` exists in the current edge registry and ADR-032 assigns clearing to the front-door officer.                                                                                                                         | **EDGE-AVAILABLE; SCREEN BUILD.** Show only policy-required paper items and write-once, attributed “seen” marks. API-verifiable items should not be redundantly required on paper unless policy says both.                                                                                                                                                                                                                                                                                                                                                                      |
| T5  | Heat / bib / 3 km timing    | Physical score capture exists on the backend; the current field-ops UI does not provide a complete heat workflow.                                                                                                                           | **PARTIAL / VERIFY POLICY.** Build candidate/heat assignment, stopwatch event handling, split/manual correction and evidence retention. Assessment standards and thresholds must be approved and versioned, not invented from examples.                                                                                                                                                                                                                                                                                                                                         |
| T6  | Bounds-checked measurements | Backend has field-score validation/types. The exact operational thresholds and exceptional-measurement process need authoritative policy versioning.                                                                                        | **PARTIAL.** Validate schema/client-side for speed and server-side for authority; out-of-range values need defined remeasurement/exception reason rather than an arbitrary UI confirmation alone.                                                                                                                                                                                                                                                                                                                                                                               |
| T7  | Sync centre                 | Backend edge sync operations are now in current registries. `OFFLINE_CAPTURE_CAN_SYNC` intentionally remains `false` because the durable queue/replay/conflict UX is not proven.                                                            | **NOT READY OFFLINE.** Implement a durable command/evidence queue on an owner-approved managed-device platform, per-record status and acknowledgements, idempotent replay, record signature/identity, retry policy and explicit “not synced” behaviour. IndexedDB alone is not a national durability guarantee; pilot acceptance requires storage persistence, restart/eviction tests and a documented paper fallback, while national scale should target an encrypted native/wrapped database with hardware-backed key protection unless equivalent controls are demonstrated. |
| T8  | Conflict resolution         | `resolveFieldSyncConflict` is now a browser-edge operation and the backend has conflict semantics. The current conflict route is a title-only placeholder; offline-conflict E2E remains `test.fixme`.                                       | **EDGE-AVAILABLE; SCREEN/TEST MISSING.** Supervisor sees both signed records, provenance, vector-clock/staleness signals, allowed choices and a mandatory reason; resolution appends correction/audit instead of overwriting evidence silently.                                                                                                                                                                                                                                                                                                                                 |
| T9  | Preloaded venue roster      | A venue/day roster read and candidate prefetch API are not evidenced as a complete public contract.                                                                                                                                         | **EXTEND.** Add agency/venue/day scoped roster endpoint and expiring manifest; expose minimum necessary identifiers only, no full PII, and provide refresh/version checks.                                                                                                                                                                                                                                                                                                                                                                                                      |
| T10 | Device hygiene              | Enrolment exists but fleet list, assignment, revoke and last-seen management do not form a complete public fleet interface.                                                                                                                 | **EXTEND + POLICY.** Add revocation and status APIs; local lock, officer switch, local-data deletion on logout/device retirement, key lifecycle and revocation-on-next-contact are required. Define risk while the device is disconnected.                                                                                                                                                                                                                                                                                                                                      |
| T11 | Live station board          | Events/score sync exist; no venue-scoped event/attendance projection is exposed as a complete live board.                                                                                                                                   | **EXTEND.** Add station counts, queue depth, last successful sync, unacknowledged records, unresolved conflicts and event timestamps; label freshness.                                                                                                                                                                                                                                                                                                                                                                                                                          |

## The offline contract is a release gate, not a marketing feature

Two different capabilities must be kept separate:

- **Offline app shell:** the Officer Console has PWA configuration to precache shell assets and to keep `/edge/v1/**` as `NetworkOnly`; this helps the application load without caching sensitive authenticated API responses.
- **Offline business transaction:** the current field feature explicitly sets `OFFLINE_CAPTURE_CAN_SYNC = false`. Durable local capture/replay, queue encryption and lifecycle, idempotency, device signatures on every record, conflict reconciliation, app-update behaviour, and record-level server acknowledgement still need proof.

Until that second capability is implemented and proved, any disconnected capture must be clearly identified as not yet accepted by the server. Never say “synced” because a request was queued or a batch endpoint returned a successful HTTP status. The MDN PWA guidance is clear that service workers enable offline asset/background patterns, but browser workers may be stopped and retry behaviour is constrained; critical operational records need durable storage and explicit reconciliation ([MDN offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)).

## Tablet operating workflow

1. Officer logs in and selects a station allowed by the session's permission.
2. Supervisor confirms campaign/day/venue manifest version and device readiness before accepting candidates.
3. Gate verifies the `USRP-SLOT.v1` signed invitation offline and checks venue, date, expiry, signature key and candidate identity through approved procedure.
4. The front-door officer checks paper-required items, records each mark once, and issues bib/heat assignment.
5. Physical station captures each test record with device identity, officer, timestamp, measurement units, policy version and provenance.
6. Medical station applies BOARD (RDF) or CERTIFICATE (RNP/RCS) mode from verified agency context; the client must not select medical mode itself.
7. Sync centre records per-item acknowledgements and exposes rejected/duplicate/stale/conflicted items. It must never coerce all entries into one batch-level “success”.
8. Supervisor resolves conflicts with an authorised, attributable decision. Corrections create new records linked to originals.
9. Venue closeout compares expected roster, arrivals, captures, medical state, unsynced records, open conflicts and no-shows; unresolved discrepancies remain explicit.

---

# 6. Officer Administration Portal / operations control room specification

## Goal

An agency-scoped command environment for configuring recruitment policy, planning capacity and people, managing queues, monitoring execution, and closing the cycle. The current `officer-console` is not yet a complete administration product and there is no separate `apps/admin-console` in the current frontend tree. A temporary role-gated section inside the Officer Console is acceptable for an initial pilot, but product ownership, route boundaries and permissions must remain explicit.

## 6.1 Campaign Studio — C1–C7

| ID  | Feature                            | Current backend                                                                                                                                     | Readiness and target requirement                                                                                                                                                                                                                                                           |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Campaign basics wizard             | `createCampaign` is in current edge/client contract.                                                                                                | **SCREEN MISSING.** Capture public code, label, categories, districts, registration opens/closes, exam start/end, reporting hour, intake target, contacts and walk-in flag where RDF permits. Validate chronology and agency-specific restrictions on both client/server.                  |
| C2  | Policy editor / immutable version  | `createCampaignPolicy` exists; backend validation requires policy/category completeness and immutable version semantics.                            | **SCREEN MISSING.** Version category criteria, age/reference date, academic pathway/threshold, criminal threshold, required documents, medical mode and legal basis. Show SHA-256, previous version diff and an explicit approval/authority history. Prefill only as labelled suggestions. |
| C3  | Venue/session planner              | `configureCampaignSession` exists; backend checks coverage/capacity and ADR-026 strengthens slot reservation/capacity integrity.                    | **SCREEN MISSING.** Matrix by district × day × venue, capacity, reporting hour, expected load, capacity remaining and unserved districts. Clearly distinguish approved unbounded capacity from absent capacity data.                                                                       |
| C4  | Publication preflight              | `publishCampaign` exists and validates prerequisites.                                                                                               | **SCREEN MISSING.** Render an actionable readiness checklist, preview the public page, show effects, require authorised confirmation and surface a structured 409 without losing draft work.                                                                                               |
| C5  | Lifecycle controls                 | `closeCampaignRegistration`, `completeCampaign`, `cancelCampaign` exist.                                                                            | **SCREEN MISSING.** Show the consequences before close/complete/cancel: in-flight applications, invited candidates, unresolved holds, reserved seats, unsent notices and outstanding field records. Counts require safe read projections.                                                  |
| C6  | Admin campaign list for all states | `listCampaigns` is public/open-campaign discovery, not an administrative list of drafts/closed/completed cycles.                                    | **EXTEND.** Add permissioned `campaign.read.admin` listing with search, status, date, pagination, audit context and agency scope.                                                                                                                                                          |
| C7  | Capacity forecasting               | Capacity columns/reservation rules exist, but district submission counts and complete session-level metrics are not exposed as an admin read model. | **EXTEND.** Project demand vs venue capacity, occupancy/remaining seats, predicted overflow and districts whose sessions are full. Distinguish actual counts from forecasts and show freshness.                                                                                            |

The campaign UI must use the real four-step business workflow: draft → policy version → sessions/coverage → publish. It should not imitate a generic CRUD form that treats publishing as a boolean toggle.

## 6.2 Event operations and resource planning — P1–P3

| ID  | Feature                             | Readiness                                                                                   | Specification                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Officer roster / station assignment | **NEW.** There is no complete venue/day/station assignment model/API demonstrated.          | Assign one or more officers to venue × day × station (Gate, Paper Documents, Physical, Medical, Walk-in, Supervisor). Check each assignment against server permissions; record replacement/absence and immutable change history. The role-to-permission matrix is provisional until agencies ratify it. |
| P2  | Device kits                         | **EXTEND/NEW.** Enrolment exists; fleet list/revoke/assignment interfaces do not.           | Bind enrolled device public keys/IDs to a venue/day kit and the assigned operator. Produce a printable kit/run sheet without private keys or applicant PII. Show device state, last sync and revocation state.                                                                                          |
| P3  | Run sheet export                    | **EXTEND.** Needs roster, venue, expected candidate count, capacity and device information. | Print/export a minimal per-venue document with contacts, approved schedule, station assignments, expected counts and recovery instructions; gate exports by permission and audit them.                                                                                                                  |

## 6.3 Command dashboard — metrics that should actually drive actions

The current dashboard reads the application list and amber queue and presents only basic counts. It is not a command dashboard. Do not create decorative charts until source data, denominator, time window and freshness are defined. The following are recommended operational panels:

| Panel               | Definition                                                                                                                          | Data dependency / caveat                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Recruitment funnel  | Count of applications at each canonical status or citizen-stage projection; conversion between stages; drop-off categories.         | Application-state projection/events; one count must represent one application, not raw event deliveries.                 |
| Daily intake        | Submissions per day by campaign, category and supported channel; optionally district/province where authorised and non-identifying. | `APPLICANT_SUBMITTED` event and policy-bound campaign association. Do not claim USSD/kiosk volume before channels exist. |
| Eligibility latency | p50/p95 elapsed time from submission to age, academic and criminal result; error/timeout rates by approved upstream.                | Gate timestamps/outbox/observability. Missing/unknown data must not be plotted as zero.                                  |
| Document lanes      | Green/amber/red distribution; API-verified share; age of each human queue and SLA breaches.                                         | Forensics events plus bounded queue read. No sensitive forensic scores in general metrics.                               |
| Adjudication holds  | Count and age in `ADJUDICATION_REVIEW`; assigned/awaiting-owner status and cleared/rejected time.                                   | Lifecycle projection and adjudication event history. Never show a blank signal as “clean”.                               |
| Slot/capacity       | Reservations, capacity, remaining seats and full sessions per venue/day/district.                                                   | Slot ledger + session configuration. Reservation ledger is authoritative; dashboard is a projection.                     |
| Exam-day live       | Expected vs checked-in, no-shows, throughput per station/hour and medical backlog.                                                  | Roster/attendance/capture events; this is **EXTEND** until venue-scoped reads are available.                             |
| Field health        | Active devices, last contact/sync, unsynced queue depth, per-record failures and conflicts.                                         | Fleet/field-sync read endpoints. Do not equate device online with queue synchronised.                                    |
| Decisions           | Shortlisted/accepted/rejected counts, decision turnaround and cross-agency automatic withdrawals.                                   | Application transition and withdrawal events. Show the distinction between decisions and notifications delivered.        |
| Notification health | Pending/sent/delivered/failed by provider evidence; aging and retries.                                                              | Notification status read model/provider receipt. SMS submission alone is not delivery.                                   |
| System health       | Edge/service readiness, outbox/dead-letter counts and upstream latency/error rates.                                                 | Operational telemetry and health endpoints; avoid leaking sensitive applicant detail.                                    |

All dashboard aggregates should have agency, campaign, category, date-range, district, venue and channel filters where data supports them. Every panel should drill into a permissioned record list. Cross-agency views are not automatically authorised: the current forced RLS boundary forbids an officer from reading another agency's records. If national aggregates are required, create an explicitly governed system-role projection that returns only approved aggregate data and never becomes a backdoor to candidate records.

## 6.4 Application workbench and specialist queues — Q1–Q6

| ID  | Queue / workbench                 | Current state                                                                                                                                                                                                                                                     | Required target                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Amber document review             | Backend queue/adjudication operations exist; current `amber-queue.tsx` is a minimal title/message, not a functioning review queue.                                                                                                                                | Queue filters and ages, safe document viewer, forensic-signal evidence with `null` meaning “not analysed”, authorised action, reason, provenance and append-only history. Avoid claims of advanced forgery detection unless validated.                                                                                    |
| Q2  | Post-clearance adjudication holds | Backend state/action exists; same minimal queue issue.                                                                                                                                                                                                            | Show exact reason family/source, timeline, evidence confidence and permitted CLEAR/REJECT action; never automatically reject a cleared/invited applicant on a late signal.                                                                                                                                                |
| Q3  | Medical review                    | Current officer detail transitions support a medical action with agency-specific modes, but no dedicated high-throughput medical queue is evidenced.                                                                                                              | RDF BOARD (FIT/UNFIT); RNP/RCS CERTIFICATE (verified/rejected and physician name when verified). Require medical permission and audit.                                                                                                                                                                                    |
| Q4  | Final decision board              | `recordFinalDecision` exists and application workspace has decision action; ranked/bulk board against target intake is not a complete UI.                                                                                                                         | Rank/shortlist protocol must be approved. Bulk decision loops need partial-failure results, per-record confirmation and idempotent safe retry strategy; a bulk action must not hide which candidates succeeded.                                                                                                           |
| Q5  | Acceptance                        | `acceptApplication` and cross-agency lock exist; UI can surface conflict outcome.                                                                                                                                                                                 | Show authoritative outcome of lock, explain automatic withdrawal of other live applications, prevent duplicate clicks, and prove notice/outbox behaviour under replay/failure.                                                                                                                                            |
| Q6  | DPO erasure queue and decline     | Backend erasure request queue/decline controllers now enforce `erasure.queue.read` / `erasure.decide`. But these queue operations are **not** in the current browser edge's 42-operation list, and the frontend queue is a stub with an old authority-gap banner. | **EDGE EXTEND + SCREEN.** Add reviewed edge operations with DPO permissions, then build the queue. Preserve mandatory decline grounds. Update the UI's obsolete claim only after the new edge contract and tests demonstrate the authority model; the backend role table remains provisional pending agency ratification. |

## 6.5 Applicant 360, audit and administration — F1–F4

| ID                             | Feature                                                                                                                                  | Readiness / dependency                                                                                                                                                                                                                                                              | Target |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Applicant 360                  | Existing officer detail + status-history operations provide a foundation.                                                                | Build a tabbed profile with masked identity by default, safe gate result, document checklist, slot/invitation state, field evidence, medical mode and immutable timeline. Purpose-of-access prompt for sensitive reveals is **NEW** and needs a reliable audit read/write contract. |
| F1 Device fleet                | **EXTEND.** `revokedAt` and enrolment data exist; list/assign/revoke/last-seen APIs are missing.                                         | Filter devices by agency/venue/status, see enrolment provenance and pending sync state, revoke with reason and make revocation effective on next contact. Define the offline risk window.                                                                                           |
| F2 Audit explorer              | **NEW read API/UI.** Audit write events exist; no safe query view across actor/entity/event/correlation chain is exposed to this portal. | Search by correlation ID/entity/actor/date/action, show causal chain across services without leaking secrets, and enforce DPO/security permissions and immutable audit semantics.                                                                                                   |
| F3 Officer/role administration | **NEW.** No complete invite/provision/deactivate/role-assignment API. Role-permission map is a provisional default.                      | Ratify roles first; build audited officer lifecycle, role assignment by agency, disable/revoke, session revocation and break-glass policy. No “superadmin” shortcut.                                                                                                                |
| F4 Key/integrity panel         | Invitation key rotation and campaign policy hashes have pieces in the system; production-grade key management/rotation is not complete.  | Show policy hash and signing-key status only to permitted staff. Move signing key material to HSM/KMS, create rotation/compromise playbooks and prove offline public-key distribution before production.                                                                            |

---

# 7. Cross-system architecture recommendations

## 7.1 Keep the existing domain boundaries

Do not replace the current backend with a generic CRUD service or duplicate workflow state in the UI. Preserve these ownership rules:

- `application-service` remains the sole writer of top-level application state and status history.
- Eligibility/vetting, document forensics, scheduling, field sync and notifications publish evidence or events; the owning projections advance authoritative state.
- Campaign policy is versioned and bound to a filing. The category, agency, campaign, policy version and evaluation reference date must be consistent.
- Slot assignment is idempotent and backed by an integrity ledger. A replay redispatches the same reservation/invitation rather than issuing a new ticket.
- Officer writes use operation-specific permissions and agency scope. The server enforces authority; UI guards only prevent confusing navigation.
- Audit records are append-only evidence, not the transport for live workflow updates.

## 7.2 Browser architecture and data contracts

The browser has one origin under `/edge/v1/**`. It must not directly call internal service ports, set upstream authorization headers, send agency as an authority input, or construct arbitrary service paths. Use typed operation IDs, generated request/response shapes and schema validators. Keep write retries disabled unless an operation has a contractually correct idempotency protocol. The applicant filing is explicitly idempotent; state transitions, walk-in registration, device enrolment, field sync and conflict resolution must not be blindly auto-retried by a generic HTTP interceptor.

The two latest registry files have matching method/path pairs at the inspected source heads. Keep that as an executable cross-repository invariant. Regenerate frontend contracts whenever backend main is advanced; refresh the backend SHA, edge-operation report, OpenAPI route inventory, fixtures and generated files in the same reviewed change. A doc that says 27 operations while source has 42 is a useful illustration of why the docs themselves need verification gates.

## 7.3 Read models, lists and dashboard performance

The current application list contract has a cap of 100 and lacks server-side filters/cursor/total. Do not build a national-scale officer experience on top of a capped list and assume client-side filters are complete. Add:

- cursor-based pagination and supported filters/search to the officer list;
- an agency/campaign scoped campaign-admin list for all lifecycle states;
- applicant-safe status history and per-gate progress projections;
- venue roster by campaign/day/venue;
- dashboard aggregation projection with explicit freshness and event-time semantics;
- per-applicant notification delivery read model;
- field device fleet and per-record sync/conflict views; and
- a permissioned DPO request queue edge adapter.

Prefer event-driven materialised projections where the system already uses Kafka and an application-state projection. Every projection needs replay-safe idempotency, reconciliation against source-of-truth state, a way to handle late/reordered events, and a visible freshness timestamp.

## 7.4 Offline command architecture

The correct field model is **a durable command/evidence log**, not “cache the API and try again later”. Each captured record should carry a stable record ID, application/slot reference, agency/campaign/policy version, device ID, officer principal, timestamp and timezone/clock confidence, payload version, signature and replay identity. Use a documented immutable/correction relationship so an accepted signed score is not silently overwritten.

Recommended queue states: `LOCAL_ONLY`, `QUEUED`, `SENDING`, `ACCEPTED`, `DUPLICATE_REPLAY`, `REJECTED_VALIDATION`, `STALE_CONFLICT`, `NEEDS_SUPERVISOR`, and `RESOLVED`. These are **client sync states**, not application lifecycle statuses. Map them to actual backend response unions before implementation; do not add pretend backend statuses.

Security questions to settle before offline capture:

- Which minimum candidate data is downloaded and how long it remains on the device?
- What local encryption protects at rest, where its key lives, and what device compromise it does/does not mitigate?
- How does officer logout/switch and device revocation lock, erase or orphan the queue?
- What happens when an invitation key rotates while the tablet is offline?
- What is the maximum offline validity window, and how does the server treat records made after a revocation or policy update?
- Which records may be accepted automatically, and which conflicts require a second authorised human?

## 7.5 Shared frontend foundations and design-system licensing

Keep the current vertical feature-slice structure and a shared design-system architecture. Every new route should have a surface manifest declaring audience, goal, real API operations, states, chosen design-system components, accessibility constraints and proof tests. The three workspaces can share foundations without forcing their information architecture to be identical.

**Licensing gate:** the adversarial review identifies a material question about using Atlassian Design System (ADS) in a national portal that may not interoperate with Atlassian products, and notes a vendored Atlassian mirror archive. Do not assume the existing dependency is licensed for this use. Legal/engineering must obtain written clarification before further dependency expansion. If the licence does not clearly permit the intended use, select an appropriately licensed open design system and migrate deliberately. Do not treat this unresolved issue as permission to continue distributing restricted assets.

Until the decision is resolved, keep component-library-specific code behind a coherent shared UI foundation where practical; preserve semantic tokens, design decisions, accessibility patterns and surface manifests independently from the library choice. Use the legally approved components/tokens after the gate is cleared.

Use role- and task-specific density:

- Applicant portal: progressive disclosure, clear one-step-at-a-time guidance, resilient draft recovery, concise explanations and mobile-first form controls.
- Tablet: large touch targets, high-contrast daylight-ready content, minimal navigation, strong current-station context, explicit offline/sync state and quick candidate lookup.
- Administration: dense tables and operational queues with stable filters, counts, drill-down, visible timestamps, exception ordering, keyboard-friendly bulk actions and auditable confirmation.

The target baseline should align with [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and be tested manually as well as automatically. Status must never be communicated only by colour; live feedback must be announced without unexpected focus movement; dialogs, camera access and QR verification must work with keyboard/screen-reader and touch input. The current Kinyarwanda/English/French bundles are a foundation, not proof that every new feature is fully translated.

---

# 8. Security, privacy, fairness and resilience requirements

1. **Agency isolation:** derive agency from the verified officer principal; enforce in service permissions and forced database RLS. There is no cross-agency record access by ordinary officers. Any national metrics service must be purpose-built, aggregate-only where approved, and explicitly authorised.
2. **Applicant ownership:** citizen read/write targets come from the session subject, never an `applicantId` supplied to select another person. Apply object-level access checks on every read/download/mutation, as emphasised by OWASP API1:2023 ([Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/)).
3. **Credential discipline:** no NID, nationalIdHash, OTP, applicant session token, officer/system JWT, signing private key or secret in browser persistence, URLs, analytics or logs. Use server-issued/opaque session handling, CSRF for unsafe cookie-backed operations, response allowlists and no-store on sensitive invitation/status reads.
4. **Anti-enumeration:** unknown identity, wrong identity factor, invalid/disabled account and OTP outcomes must not become a citizen-directory oracle. Do not put debugging detail in citizen-facing status copy.
5. **Sensitive evidence:** minimise identity fields, never store raw biometrics unless a separately approved lawful architecture demands it, and avoid showing raw criminal-clearance details or forensic score/flags to applicants. Use mask-by-default and purpose-of-access audit for staff PII reveals.
6. **Human review:** late adverse vetting/document evidence after slot assignment routes to adjudication. Medical and selection decisions remain authorised human decisions where specified. Any later AI assist must be transparent, validated, reviewable and non-authoritative by default.
7. **Data protection and retention:** align notices, lawful basis, data-subject rights, processing purpose, accuracy, retention and destruction with Rwanda Law N° 058/2021 and DPO guidance. Retention must follow documented purposes/legal grounds, and deletion must be proven rather than merely set to a UI flag ([DPO controller/processor obligations](https://dpo.gov.rw/dpp-law/obligations-of-the-data-controller-and-the-data-processor), [retention guidance](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data)).
8. **Role governance:** the eight-role permission table is a provisional default. Agency sign-off must settle which posts may administer campaigns, perform medical reviews, adjudicate, sign final decisions, accept candidates, resolve field conflicts and decide erasure requests. Existing accounts need deliberate re-provisioning; role lifecycle APIs remain an open capability.
9. **Device trust:** secure device key enrolment, rotation, revocation, safe local data handling, session timeouts, app updates, and incident response. “Remote revoke” cannot be instantaneous while a device is offline; UI and operating procedures must state the residual risk honestly.
10. **Upstream truth:** repository implementations do not prove current NIDA/NESA/HEC/RIB production availability or SMS delivery. Handle timeout, partial failure, retry, delayed result, manual review, outbox/dead-letter and recovery paths as explicit product states.

External design and reliability references: [GOV.UK Service Standard—solve the whole user problem](https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem); [joined-up channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels); [Rwanda DPO data-subject rights](https://dpo.gov.rw/dpp-law/rights-of-the-data-subject); [MDN offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation); [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

---

# 9. Consolidated functional and non-functional requirements

The requirements below are proposed acceptance-level statements derived from the two research sources. Assign identifiers to these in the official SRS before implementation.

## 9.1 Platform/cross-cutting

- **PLAT-01:** The browser calls only approved `/edge/v1/**` operations through the typed client.
- **PLAT-02:** The frontend operation registry method/path/session/retry/composition remains reconciled to the pinned backend commit; drift is a failing build condition.
- **PLAT-03:** Each human action is enforced by operation-level permission and agency scope in the service; frontend visibility is only a usability layer.
- **PLAT-04:** Application status transitions are specific typed commands; no generic status-update endpoint is introduced.
- **PLAT-05:** Important mutations, policy changes, decisions, document sightings, field conflicts, device changes, exports and privacy decisions are attributable and auditable.
- **PLAT-06:** Asynchronous events/outbox consumers are idempotent, replay-safe and observable; the UI differentiates pending work from committed work.
- **PLAT-07:** Each route supports loading, empty, filtered-empty, forbidden, not-found, partial-data, stale-data, validation-failure, upstream-failure, conflict and success states as applicable.
- **PLAT-08:** All supported locales remain key/placeholder-parity clean; there are no untranslated fallback strings on critical recruitment screens.

## 9.2 Applicant

- **APP-01:** Applicant can browse published campaigns and inspect a shareable public-detail page.
- **APP-02:** Applicant onboarding uses approved identity verification and OTP; errors remain non-enumerating and expiry/lockout is understandable.
- **APP-03:** Filing binds to the selected campaign code and correct category policy; the server—not the client—derives agency and applicant identity.
- **APP-04:** Submission retries are idempotent and duplicate intentions do not create duplicate applications or consume duplicate slots.
- **APP-05:** Applicant can upload an allowed document and sees “received” separately from any verified/cleared outcome.
- **APP-06:** Applicant sees a six-stage plain-language progress projection backed by real status/per-gate data, with holds and withdrawal/closure reason semantics handled explicitly.
- **APP-07:** Exam Pass is available only when the signed invitation is ready; the rendered credential is exactly the signed payload and can be downloaded/printed.
- **APP-08:** Applicant can list own applications across agencies, withdraw according to policy, and file/view an erasure request without being told that intake equals execution.
- **APP-09:** All notification and outcome claims are grounded in delivery/read-model evidence; unsent notices are not presented as delivered.

## 9.3 Tablet

- **TAB-01:** Only authorised station workflows are shown for the verified officer role; every write is re-authorised on the server.
- **TAB-02:** A signed QR is verified offline against approved public keys, venue/date/expiry and the candidate's identity procedure; failure reason is precise and safe.
- **TAB-03:** Venue document sighting is recorded once, with actor/time and only for relevant paper-required items.
- **TAB-04:** Physical/medical records use approved versioned standards, correct units, provenance and agency-specific medical semantics.
- **TAB-05:** Every offline capture has a stable ID and device signature; local storage protects minimum necessary data and survives process/device restart.
- **TAB-06:** Replay is idempotent; each record has a clear server acknowledgement/result; conflict resolutions are permitted, reasoned, attributable and append-only.
- **TAB-07:** The app remains honest about what is local-only versus accepted, rejected, conflicted or synchronised.
- **TAB-08:** Venue closeout reconciles expected, arrived, tested, medical, no-show, pending sync and conflict counts.

## 9.4 Administration

- **ADM-01:** Campaign creation follows draft → policy version → sessions/coverage → publish.
- **ADM-02:** Each published campaign has an immutable, fingerprinted category policy version, approved date windows, complete required-document rules and documented ownership.
- **ADM-03:** Session planning rejects invalid chronology, incomplete coverage and over-capacity assignments unless approved, explicit exception rules allow otherwise.
- **ADM-04:** Campaign lifecycle commands show their impact before closing/cancelling/completing and preserve audit/appeal/notification implications.
- **ADM-05:** Administration lists all campaign states with agency-scoped filtering and pagination.
- **ADM-06:** Roster and device assignment check station permission and equipment readiness; device status/revocation is visible.
- **ADM-07:** Operational dashboard metrics have formula, denominator, time basis, freshness timestamp, source, filters, drill-down and known limitations documented.
- **ADM-08:** Specialist queues show age, assigned role, last action, required evidence and permitted transition; no queue can be cleared by an unauthorised role.
- **ADM-09:** Audit explorer provides authorised causal trace by correlation ID/entity/action without exposing secrets or unmasked data by default.
- **ADM-10:** Admin exports are purpose-limited, permissioned, minimised and audited.

## 9.5 Proposed non-functional targets to ratify

These are initial targets to confirm with owners and measure under representative Rwandan network/device conditions; they are not claims about current performance.

| Dimension                                        | Proposed target / proof                                                                                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile performance                               | Core applicant pages remain usable on mid-range Android and unstable 3G; set a measured p75/p95 budget per route after baseline.                                                                                                                   |
| Applicant data durability                        | Local draft survives refresh/tab close where safe; draft schema is versioned; credentials/NID/session tokens never persist in draft storage.                                                                                                       |
| Filing integrity                                 | 100% of injected response-loss/retry scenarios produce exactly one application for the same intent; key reuse with different payload gives the documented conflict.                                                                                |
| Authorisation                                    | Negative tests for cross-agency reads/writes, wrong session kind, insufficient role, revoked session and guessed object IDs fail closed.                                                                                                           |
| Offline field durability                         | In test lab, capture N records in airplane mode, restart the app/device, reconnect, and prove all records are accepted/rejected/conflicted exactly once with no silent loss. Define the tested N and retention window from expected event volume.  |
| Sync observability                               | Each record's local/server state is independently visible; 0 unaccounted items before venue closeout.                                                                                                                                              |
| Accessibility                                    | WCAG 2.2 AA target with automated checks plus manual keyboard, screen reader, touch target and low-vision review.                                                                                                                                  |
| Availability/recovery                            | Set service-specific SLOs, RPO/RTO and recovery drills for edge, PostgreSQL, Kafka/outbox, object store, OTP/SMS provider and external registries before production.                                                                               |
| Audit completeness                               | 100% of privileged state changes have actor, agency, permission/action, target, timestamp, correlation ID, outcome and reason where required; no sensitive payloads in logs.                                                                       |
| Data retention                                   | Every personal-data class has owner, purpose, lawful basis, retention period, destruction rule and evidence of deletion/hold exception.                                                                                                            |
| Portal availability in registration windows      | **Proposed:** 99.9% of requests non-5xx; ratify and define exclusions/error-budget policy.                                                                                                                                                         |
| Portal availability outside registration windows | **Proposed:** 99.5% of requests non-5xx; ratify with service owner.                                                                                                                                                                                |
| Filing edge latency                              | **Proposed:** 95% under 3 seconds excluding asynchronous upstream registry processing.                                                                                                                                                             |
| OTP delivery                                     | **Proposed:** 95% within 60 seconds, measured separately by provider/operator; not a guarantee the platform alone can make.                                                                                                                        |
| Eligibility completion                           | **Proposed:** 95% within 24 hours excluding declared registry outages, only after written registry budgets and queue semantics are agreed.                                                                                                         |
| Gate verification                                | **Proposed:** 95% under 3 seconds without network using approved signed-pass verification and cached public keys.                                                                                                                                  |
| Field-record acknowledgement                     | **Proposed:** 99% within 15 minutes after connectivity returns, measured per record.                                                                                                                                                               |
| Recovery point/time                              | **Proposed:** application data RPO 5 minutes; audit evidence target RPO 0 only if synchronous durable audit writes are designed and proven. RTO 4 hours during a campaign window and 24 hours otherwise, subject to cost/hosting/legal validation. |
| Load proof                                       | **Proposed:** spike test at 3× the approved high scenario, 24-hour soak, and controlled database-primary, event-relay and registry-failure drills. Replace scenario assumptions with owner data before sizing.                                     |

---

# 10. Operational KPIs and dashboard definitions

Every metric needs a named owner and exact definition, not just a label on a chart.

| KPI                         | Suggested definition                                                                                                           | Why it matters                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Application completion rate | Successful unique applications / application attempts started in a cohort.                                                     | Detects form, identity and network friction.                        |
| Duplicate filing rate       | Duplicate intents blocked or replayed / all filing attempts.                                                                   | Tests idempotency and applicant trust.                              |
| Eligibility turnaround      | p50/p95 elapsed time from submission to each age/academic/criminal verdict.                                                    | Distinguishes government dependency latency from local processing.  |
| Manual-review queue age     | p50/p95 time from entering amber/adjudication/medical queue to decision.                                                       | Prevents silent long-lived holds.                                   |
| Invitation readiness        | Time from all eligibility gates passing to persisted/visible signed invitation.                                                | Measures scheduling/outbox reliability.                             |
| Slot capacity utilisation   | Reservations / approved capacity per session, with remaining seats and unbounded flag.                                         | Prevents overbooking and shows geographic gaps.                     |
| Attendance rate             | Valid check-ins / invited candidates for that event.                                                                           | Planning and no-show insights.                                      |
| Field throughput            | Completed assessments per station/hour with data-quality exception counts.                                                     | Identifies bottlenecks without rewarding inaccurate capture.        |
| Offline reconciliation      | Records accepted, rejected, conflicted and unresolved; denominator all device-created records.                                 | Must sum exactly to local capture ledger before closeout.           |
| Notification completion     | Counts separately for queued, provider accepted, delivered (if proven), failed and undeliverable.                              | Avoids treating attempted send as successful communication.         |
| Decision turnaround         | Time in final-decision queue to signed decision.                                                                               | Measures process responsiveness.                                    |
| Correction/appeal rate      | Approved correction/appeal requests by stage/category; use only with lawful, careful interpretation.                           | Detects policy/process errors without presuming applicant fault.    |
| Platform reliability        | Availability, error rates, outbox lag/dead letters, DB pool saturation, upstream timeout rate.                                 | Distinguishes technical outages from recruitment outcomes.          |
| Inclusion                   | Completion/abandonment and support requests by locale, device class, channel and district where lawful and privacy-preserving. | Finds exclusion caused by bandwidth/language/assisted-channel gaps. |

Do not use raw score rankings, criminal details or sensitive demographic slices in general command dashboards. Any fairness analytics need an approved lawful purpose, minimum group sizes, access control and a clear response plan for adverse findings.

---

# 11. Unified backend and product backlog

The consolidated list below preserves Claude's B-1–B-13 identifiers while adjusting them to the latest source snapshot.

| ID   | Backend ask                                                                                                                                                                                                                      | Unlocks                                                                                                               | Suggested priority                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| B-1  | Agency-scoped dashboard projection with counts by canonical status/category/campaign/day/channel, gate latency, lane shares and slot fill.                                                                                       | Full command dashboard, capacity forecasting and campaign summaries.                                                  | **P1 after contract truth**                                                                           |
| B-2  | Applicant-safe status history + per-gate progress projection.                                                                                                                                                                    | Useful citizen tracker and next-step explanations.                                                                    | **P1**                                                                                                |
| B-3  | Verified biometric check-in browser edge/API, with reviewed controller evidence and privacy/retention contract.                                                                                                                  | Gate biometric matching.                                                                                              | **P1/P2 after security review**                                                                       |
| B-4  | Fleet list/assign/revoke/last-seen APIs and audited device lifecycle.                                                                                                                                                            | Device kits, lost-device response, field-health dashboard.                                                            | **P1 before field scale**                                                                             |
| B-5  | Venue/day roster read and safe pre-download manifest.                                                                                                                                                                            | Offline gate roster, run sheets, expected-versus-arrived counts.                                                      | **P1 before offline venue pilot**                                                                     |
| B-6  | Campaign admin all-state list + session read with occupancy/capacity values.                                                                                                                                                     | Campaign administration and capacity controls.                                                                        | **P1**                                                                                                |
| B-7  | Public, curated campaign-policy summary.                                                                                                                                                                                         | Eligibility pre-check and richer campaign details.                                                                    | **P2**                                                                                                |
| B-8  | Applicant-scoped notification log and delivery-status read.                                                                                                                                                                      | Notice inbox, support operations, lost-SMS recovery.                                                                  | **P2**                                                                                                |
| B-9  | Officer lifecycle and roster/station assignment operations in IAM/admin boundary.                                                                                                                                                | Staff assignment and role administration.                                                                             | **P2 after role ratification**                                                                        |
| B-10 | Authorised audit read API with correlation-chain support and sensitive-field filtering.                                                                                                                                          | Audit explorer, purpose-of-access review.                                                                             | **P2**                                                                                                |
| B-11 | Citizen-safe decision reason category and signed outcome/next-steps artefact.                                                                                                                                                    | Outcome letter and next-step workflow.                                                                                | **P2 after disclosure decision**                                                                      |
| B-12 | Split the work: (a) operator-initiated venue/session relocation and superseding invitation/reservation; (b) applicant-requested rescheduling; (c) amber re-upload protocol; (d) consent-based campaign alerts; (e) USSD gateway. | Exam-day continuity is P1; later citizen rescheduling and optional channels follow approved policy and API contracts. | **P1 for operator relocation/rescheduling; P2/P3 for the remaining separately governed capabilities** |
| B-13 | DPO queue/decline edge operations wired to existing service-level `erasure.queue.read` / `erasure.decide` permissions.                                                                                                           | Real DPO portal.                                                                                                      | **P1/P2; least privilege is already enforced at service but browser operations are missing**          |

Additional frontend/product tasks are not replaceable by these backend asks:

- **FE-1:** refresh obsolete cross-repository reconciliation inventory/SHA and source comments after PR #24; add a gate for evidence-doc SHA/count parity where practical.
- **FE-2:** finish applicant E2E scenarios and update stale `test.fixme` claims about operations/routes that have since been added.
- **FE-3:** create Campaign Studio screens over current campaign client operations.
- **FE-4:** promote policy-aware applicant checklist; upload is not verification.
- **FE-5:** build field station screens; replace check-in/conflict/walk-in/invitation placeholder routes.
- **FE-6:** implement durable field command/evidence queue on the approved managed-device platform; keep `OFFLINE_CAPTURE_CAN_SYNC=false` until restart/eviction, replay, conflict and closeout proof passes. IndexedDB alone is not the national durability strategy.
- **FE-7:** complete the admin dashboard, queues, roster/device screens, and metric definition panel.
- **FE-8:** implement list filters/pagination against extended backend read contract; do not present a capped list as a complete national/agency dataset.
- **FE-9:** update stale `ConnectionStatus`, applicant home page and citizen E2E comments so future contributors are not misled about the live boundary.
- **FE-10:** keep each important route governed by a surface manifest and test the declared loading/empty/forbidden/not-found/partial/pending/conflict/success states.

---

# 12. Owner decisions that must not be silently invented

| Decision                                                                                                                                    | Current evidence                                                                                       | Required decision owner                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Ratify the 8-role permission map and legacy account migration.                                                                              | Backend ADR-031 makes permission checks authoritative but labels role defaults provisional.            | RDF/RNP/RCS leadership, recruitment operations, security.        |
| Which roles can create/publish/cancel campaigns, and is independent approval required?                                                      | Campaign permissions exist; publication control is backend-owned.                                      | Each agency's recruitment process owner.                         |
| Which role owns fleet administration versus device enrolment?                                                                               | `screening_officer` / `field_supervisor` permissions cover enrolment; no complete fleet admin API.     | Operations + security.                                           |
| Can an acceptor differ from the final decision maker? May any actor override separation of duties?                                          | Default separation-of-duties rules exist; acceptance separation is configurable and not final policy.  | Agency recruitment leadership.                                   |
| Can applicants request rescheduling? What happens to capacity and old QR credentials?                                                       | No superseding reservation protocol.                                                                   | Recruitment operations.                                          |
| Which physical measurements/tests and pass thresholds apply by agency/category, including gender/category exceptions if legally applicable? | Types exist; final standards are not fully a campaign policy contract.                                 | Approved medical/physical-test authority and legal/policy owner. |
| What rejection reason is safe to disclose, and is an appeal/correction channel mandatory?                                                   | Applicant-facing outcome reason projection/letter issuer missing.                                      | HR/legal/DPO and agencies.                                       |
| Is campaign-opening SMS opt-in allowed, and what lawful basis applies?                                                                      | Existing operational notices are not a consent-based alert-subscription system.                        | DPO/legal/agency owner.                                          |
| Is there a human need for national cross-agency metrics? What is the permitted aggregation level?                                           | Ordinary agency RLS blocks cross-agency records.                                                       | National governance + security + DPO.                            |
| What is the offline validity/revocation policy for field devices, cached manifests and signing keys?                                        | Signed QR/offline verification design exists; HSM/KMS/key-rotation and offline revocation risk remain. | Security, field operations and policy owners.                    |
| Which citizen channels are committed to launch (web, assisted kiosk, USSD), and who operates each?                                          | Channel names exist; full USSD gateway is not evidenced.                                               | Service owner and channel partners.                              |

---

# 13. Dependency-aware engineering delivery plan

This is an implementation order, not a wish list. Each wave has an exit gate, and later feature volume must not overtake the platform and verification foundations.

## Wave 0 — Evidence, legal, identity, licence and implementation preflight

1. Treat `bd939f61…` and `cd27d111…` as source-report claims until a tagged release publishes independently reproducible CI artefacts. Freeze the exact backend/frontend SHAs for the increment.
2. Refresh `cross-repo-contract-reconciliation-2026-10-04.md`; generate a contract diff covering schemas, session type, permissions, errors, idempotency/retry semantics and method/path, not just the reported 42 matching pairs.
3. Clear the ADS licence in writing or select an appropriately licensed alternative before further dependency expansion.
4. Confirm data-flow inventory, in-country hosting/backup/DR options, transfer authorisations, DPO/legal deliverables and encryption-key custody before real personal data or national pilot data is used.
5. Ratify identity assurance and supervised fallback, the pilot device fleet, manual-photo baseline, paper procedures, operator relocation authority, registry budgets, provisional SLO/RPO/RTO and named owners. These are critical-path requirements, not late-wave polish.
6. Correct stale comments and tests; treat each old mismatch as a regression test or remove the false assertion deliberately with evidence.
7. Run frontend repo-owned verification gates: contract-drift, surface verification, typecheck, lint, unit tests, build, accessibility/Storybook, security scan, bundle-size checks and relevant E2E. Record actual outputs and current SHAs; do not infer a green gate from docs.
8. Confirm backend build/selfchecks/DB-dependent proofs on the same SHA. Keep unavailable external integrations labelled as mocks/test doubles until real connectivity is independently proved.
9. Ratify or explicitly track all blocking authority/policy decisions (roles, medical/physical standards, key management, device ownership and production delivery channels).

**Exit gate:** evidence register and all contracts are current; the required baseline gates are green; every claim of “ready” maps to code + test evidence. No broad feature wave proceeds over a red required check.

## Wave 1 — Prove the flagship officer application workspace and minimum pilot continuity

Use `/applications` and `/applications/:id` as the reusable reference surface. Follow this loop:

**surface manifest → approved design-system/state planning → implementation audit → parallel verification → repair → rerun gates.**

Confirm actual search/filters and list completeness, detail/history, partial-data semantics, operation-permission outcomes, medical/final/accept/adjudicate action conditions, confirmation dialog, conflict response, focus/live announcements and locale parity. Validate every declared manifest state and confirm the actions are backed by the current contract. Do not use the first successful render as acceptance.

**Exit gate:** manifest is truthful, all required states tested, no fake statuses/fictional operations, current contract pinned, a real E2E action works against the edge harness, accessibility checks pass and defects are repaired rather than waived. In parallel, the pilot has an approved paper run-sheet/score-sheet procedure, staffed assisted desk/pass printing, a rehearsed venue-relocation path and named incident/escalation owners. The pilot must not depend on unproven offline sync.

## Wave 2 — Complete one thin vertical recruitment pilot across all three workspaces

Build the smallest genuinely complete process rather than six broad slices:

- Admin: a minimal Campaign Studio that creates draft, policy version and session, then passes preflight/publish.
- Applicant: campaign choice → valid onboarding → campaign-bound submission → document upload/checklist truth → status and exam QR `PENDING` → eventual `READY` from the signed invitation.
- Tablet: online gate invitation verification, venue paper sighting, one real physical-record capture flow and medical mode for one approved agency/process; explicitly represent offline sync as unavailable until its durable queue is proved.
- Backend: use existing event/outbox, policy binding, idempotency, reservation integrity, role permissions and audit; no manual database patch as the normal path.

**Exit gate:** a single synthetic candidate can be traced from campaign to final state with correlated events; retries cannot duplicate the application or slot; gate outcomes and notification states are honest; audit trail is intact. For the first tablet pilot, declare connectivity assumptions explicitly rather than claiming offline capture before proof.

## Wave 3 — Full applicant experience and Campaign Studio

Expand campaign catalogue/detail, curated eligibility pre-check, policy-aware document checklist, detailed citizen-safe tracker, privacy centre, accessible/trilingual guidance and post-application recovery. Complete Campaign Studio policy version diff, district/session grid, capacity indicators, pre-publish preview and lifecycle controls. Fix application read search/pagination limitations and build admin all-state campaign reads.

**Exit gate:** a real agency operator can administer a complete campaign through the UI, and citizens can complete/understand the supported digital journey without hidden manual intervention for an advertised capability.

## Wave 4 — Field operations and offline reliability

Deliver station home, offline signed invitation verifier, candidate roster, document sighting, physical heat/timing, measurement capture, agency-specific medical form, device management, encrypted durable capture queue, idempotent replay, record-level ack and explicit conflict resolution. Add tests for airplane mode, browser/device restart, storage exhaustion, stale roster, invalid signature, clock drift, key rotation, duplicate sync, server conflict, revoked device reconnect and app update mid-event.

**Exit gate:** `OFFLINE_CAPTURE_CAN_SYNC` flips only in the same reviewed change that adds implementation and executable proof; the test demonstrates no silent loss/duplication and end-of-day reconciliation is exact.

## Wave 5 — Administration operations and governance

Add staffing/station rosters, device kit assignment/revoke, venue run sheets, dashboard projections, queue SLA ageing, applicant 360, notification delivery view, DPO queue edge operations, audit explorer, officer lifecycle/role assignment, controlled exports and retention/closeout workflow. Ratify roles and decision protocol before enabling privileged buttons for production accounts.

**Exit gate:** users can answer, for a real campaign: what is happening, where the bottleneck is, whose action is required, which records are still unaccounted for, and what evidence supports closure.

## Wave 6 — Reach, improvement and carefully governed automation

Add applicant-requested rescheduling, consent-based campaign alerts, broader USSD self-service, outcome letters and appeal/correction routes only after owner decisions and APIs exist. (System-initiated venue relocation/rescheduling and assisted access are earlier operational requirements, not Wave 6 items.) Improve capacity forecasting and fairness analytics from measured baselines. Any AI helper should begin read-only, policy-grounded and reviewable; it must not issue or override eligibility, medical, adjudication, final hiring or access decisions.

---

# 14. Release gates and definition of done

A feature is done only when all applicable gates are satisfied:

1. **Contract:** operation exists at pinned backend; request/response and permission metadata match; generated schema and fixtures are updated.
2. **Domain:** state transitions and immutable/history/capacity/idempotency invariants are enforced server-side; UI copy uses real values/outcome unions only.
3. **Surface:** manifest names true routes, operations, states, audience, components, accessibility and tests.
4. **Security:** positive and negative tests prove session kind, permission, agency, object ownership, data minimisation, CSRF, and no sensitive persistence/logging.
5. **Functional:** loading/empty/forbidden/not-found/partial/network/upstream/conflict/success states render and recover without duplicate action.
6. **Accessibility/i18n:** the legally approved design system, keyboard, touch, screen reader, colour-independent status, locale/placeholder parity, correct page language and low-bandwidth usability tested.
7. **Offline (where applicable):** durable local write, signature/provenance, replay idempotency, record-level ack, conflict path and end-of-day reconciliation tested after restart.
8. **Operational:** metric definitions, audit, support/rollback, retention, key rotation and incident runbooks updated.
9. **Proof:** local/CI outcomes are reported from the exact commit; `test.fixme` or skipped critical journeys are visible release blockers, not counted as passes.

## Immediate next actions

1. Update the frontend cross-repository contract reconciliation and stale source comments to current `bd939f61…`/`cd27d111…` reality.
2. Run the current repo verification suites and record the actual results; start with contract drift, surface verification, unit tests, typecheck, lint and build before editing more feature code.
3. Turn the officer application workspace into the proven reference surface using its existing manifest.
4. Replace obsolete applicant E2E `test.fixme` claims with real campaign-bound onboarding/submission/upload/QR scenarios and prove them against the current edge.
5. Implement the minimum Campaign Studio screens and validate a complete synthetic journey.
6. Keep field offline sync explicitly disabled until durable queue/replay/conflict proof is green; meanwhile build the field station screens and backend roster/fleet contracts.
7. Get agency owners and DPO/security to ratify roles, medical/physical standards, key lifecycle, disclosure, applicant-requested rescheduling and channel decisions before production rollout; operator-initiated relocation and paper fallback must already work for the pilot.

---

## External reference material carried forward from the product research

These sources inform the design principles; they do not replace Rwanda-specific legal review or source-code evidence.

1. **Rwanda Data Protection & Privacy Office** — [controller and processor obligations](https://dpo.gov.rw/dpp-law/obligations-of-the-data-controller-and-the-data-processor), [processing and quality of personal data](https://dpo.gov.rw/dpp-law/processing-and-quality-of-personal-data), [data-subject rights](https://dpo.gov.rw/dpp-law/rights-of-the-data-subject), [sharing, storage and retention](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data). Apply Law N° 058/2021 through documented purpose, lawful basis, rights, accuracy, retention, access logging and destruction.
2. **OWASP API Security Top 10 2023** — [API1: Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) and [API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/). Every identifier-bearing read/write needs object-level checks, not just authentication.
3. **MDN** — [offline and background operation in PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) and [PWA overview](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps). Service workers are useful foundations; critical offline records still need durable persistence and explicit reconciliation.
4. **W3C** — [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/). Use WCAG 2.2 AA as the proposed target and combine automated testing with real manual checks.
5. **GOV.UK Service Manual** — [solve a whole problem for users](https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem), [join up across channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels), and [make the service simple to use](https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use). Use these as service-design patterns, adapted to Rwanda's law, agencies and operating conditions.

---

# 15. National deployment hardening baseline

This section incorporates the adversarial review's deployment findings into the product baseline. It is binding where it sharpens or corrects an earlier requirement. Values and legal conclusions are proposals requiring ratification, not facts established by this document alone.

## 15.1 Evidence release: replace moving-branch prose with reproducible proof

The two research sources disagree about what could be independently inspected. The product research records specific SHAs and 42 matching method/path pairs; the adversarial review could not independently reach the backend and could not confirm that public repository snapshot. Neither statement should be erased. The unified decision is to treat the reported source heads as _reported evidence snapshots_ until the project emits a tagged, reproducible release evidence bundle.

Every tagged release bundle must include:

- backend and frontend repository URL, immutable commit SHA, tag, build environment and dependency-lock hashes;
- generated operation/contract inventory and machine-readable diff;
- operation ID, method/path, request/response schema, session kind, permission, error model, idempotency scope, retry policy and compatibility version;
- unit, integration, consumer-contract, E2E, accessibility, security and load-test results, with skipped/`test.fixme` tests reported separately;
- SBOM, dependency/licence inventory and release provenance;
- database migration plan, rollback/forward-fix plan, feature-flag state and deployment manifest;
- service/device build versions and campaign-policy compatibility declaration.

A route count or matching method/path pair is a useful static check, not proof of a working journey. The release is blocked when generated contracts drift, permission metadata is missing, or critical tests are skipped without an explicitly approved temporary exception and compensating control.

## 15.2 Identity assurance, sessions and supervised fallback

### Identity principles

- National ID and date of birth are identifiers, not authentication secrets.
- SMS OTP verifies control of a phone channel. It does not by itself prove the applicant's civil identity, prevent SIM swap, or establish a high assurance level.
- The legal identity lookup and its binding to the applicant account must be defined by the approved NIDA/agency integration contract. Do not invent a phone-to-ID match or assume an external registry is available.
- Apply non-enumerating responses to account lookup, OTP send/verify, recovery and session establishment. Rate-limit by relevant dimensions (identity reference, phone, IP/network and device/risk signal) without allowing a single attacker to trivially deny service to a victim.
- Consider SIM change/porting and provider risk signals where lawfully available; define OTP budgets, cooldowns, lockout, alerting and fallback.
- Step-up authentication is required for owner-designated high-risk or irreversible actions. The exact factor and risk threshold require security/DPO approval; never silently treat SMS as phishing-resistant.
- Staff and administrators should use phishing-resistant authentication where feasible, short-lived sessions, least privilege and just-in-time privileged access. Break-glass access is time-limited, justified, alerted and audited.

### Venue identity and biometrics

The baseline gate procedure is manual photo comparison against the approved identity record, plus signed-pass validation and supervised escalation when uncertain. Biometrics may be added only after the relevant API is verified and the agency approves lawful basis, purpose, accuracy thresholds, bias/false-match handling, retention, access, incident response and a non-biometric alternative. A biometric failure must not automatically equal candidate rejection. Raw biometric samples are not stored by default.

### Acceptance tests

- Valid, invalid, expired, replayed and throttled OTP scenarios are tested without account enumeration.
- SIM-change/porting signals are handled according to the ratified risk policy.
- Irreversible action step-up is tested end-to-end.
- Venue staff can complete a supervised manual identity fallback during registry outage or biometric failure.
- Staff disablement/session revocation and privilege changes take effect for subsequent protected operations.

## 15.3 Offline field operating model and evidence integrity

### Architecture decision

The product must distinguish three capabilities:

1. **Offline shell:** assets load while disconnected. This is not permission to write authoritative records offline.
2. **Offline verification:** a signed, minimal Exam Pass can be verified locally against approved cached public keys, manifest/venue/date/expiry constraints and a trustworthy-enough clock.
3. **Offline evidence capture:** a field record can be durably captured, signed, retained, replayed, acknowledged, reconciled and adjudicated without silent loss or duplication.

The third capability is disabled until proven. The target deployment choices are:

- **Pilot:** standardised managed Android devices with persistent storage explicitly granted, device lock/disk encryption, controlled browser/runtime version, a documented storage-eviction/restart drill, spare-device procedure, and a paper fallback. IndexedDB may be a component of this controlled pilot only after evidence demonstrates the required durability.
- **National scale:** prefer a native/wrapped client with an encrypted database and hardware-backed key storage, unless an alternative meets the same tested controls and is approved by security/operations.

A key stored beside the data is not meaningful protection against a compromised device. Define threat model, key custody, local-data lifetime, officer switch/logout behaviour, remote revocation limitations, device retirement wipe, and incident response.

### Per-record command/evidence contract

Every offline record carries, as applicable:

- stable globally unique record ID and idempotency/replay identity;
- application/slot reference and minimum necessary candidate reference;
- campaign and immutable policy version/hash;
- venue/day/station and record type/schema version;
- officer principal, device ID/key ID and enrolment state;
- capture timestamp, timezone, clock confidence and local sequence;
- payload digest/signature and explicit correction/supersession relationship;
- sync status, server acknowledgement/result, retry count and last attempt;
- provenance and conflict references.

Local sync states are client-side operational states, not application lifecycle statuses. A recommended model is `LOCAL_ONLY`, `QUEUED`, `SENDING`, `ACCEPTED`, `DUPLICATE_REPLAY`, `REJECTED_VALIDATION`, `STALE_CONFLICT`, `NEEDS_SUPERVISOR`, `RESOLVED`. Map each to actual server response unions; do not invent server states.

### Sync and reconciliation invariants

- Retrying the same record never creates a second accepted record.
- A lost response can be recovered by querying/replaying the same idempotency identity.
- A changed payload cannot reuse the same idempotency key as if it were the same intent.
- Every record reaches a visible terminal/exception state; `pending` is not silently promoted to `accepted`.
- Conflict resolution preserves both signed inputs and appends a reasoned resolution; it never erases the original evidence.
- Venue closeout reconciles every device-created record against server state; the number of unaccounted records must be zero or a named owner must sign an explicit exception with supporting evidence.
- Outbox consumers are idempotent; events are versioned and partitioned by aggregate/application when per-aggregate order matters. Dead-letter/replay tools and runbooks exist before launch; outbox growth is bounded by pruning/retention policy.

### Exam-day degradation ladder

1. **Normal:** online signed-pass verification and record capture.
2. **Network unavailable:** verify signed passes against approved cached public keys and a current roster manifest; capture only if the approved durable offline mode is enabled. Each record visibly remains local-only until acknowledged.
3. **Single device failure:** use a spare; supervisor enrols/reassigns the replacement, records the old device and revocation action, and verifies queue recovery.
4. **All devices unavailable:** use pre-printed rosters and numbered carbon-copy score sheets; two authorised people enter records later; reconcile against any recoverable device records and retain the paper source.
5. **Venue/session unavailable:** authorised operator relocates or reschedules, invalidates superseded passes, issues replacement invitations and notices, updates capacity and logs the reason.

Each rung must be rehearsed at the pilot venue. Paper records need serials, custody, two-person entry where appropriate, correction rules, storage/retention and a reconciliation owner.

## 15.4 Exam Pass: reconcile `no-store` and offline presentation

Sensitive API reads remain `Cache-Control: no-store` (or the approved equivalent). The candidate may deliberately download or print a signed pass; this is a separate user-initiated export, not permission to cache the API response. The candidate can show the pass without connectivity. An approved SMS short code may support recovery but must not be treated as a substitute for signature validation.

The signed payload should contain only the minimum fields needed for offline validation, such as key ID, invitation/application reference, venue, date and expiry. It must not contain national ID, medical data, criminal data or other unnecessary PII. Public-key rotation needs validity windows and overlap; roster manifests need version/expiry/revocation semantics. A stale/missing key, invalid signature or doubtful device clock fails visibly and routes to a supervised lane; it must never fail open. The pass proves an invitation exists, not that its presenter is the invited person.

## 15.5 Rescheduling, assisted access and fairness

### System-initiated relocation/rescheduling — P1

The operator workflow is required for the first pilot. It must:

- require an authorised role and reason;
- preview affected sessions, applicants, capacity, notifications and already-issued passes;
- lock/version the affected reservation/capacity set and commit atomically;
- preserve an immutable link from old reservation/pass to replacement reservation/pass;
- invalidate old credentials and ensure offline validators learn the revocation within a defined, bounded validity window;
- issue replacement invitation artefacts and notices with delivery state visible;
- prevent overbooking and duplicate active reservations;
- support a venue-down fallback and end-of-day reconciliation;
- provide candidate support and a documented fairness/appeal path if the relocation creates material disadvantage.

### Applicant-requested rescheduling — later, policy-gated

Do not assume the citizen has a right to reschedule or that it is forbidden. Recruitment operations and legal/policy owners must decide eligibility, deadlines, approval, available capacity, treatment of missed sessions, fairness and old-pass invalidation. Implement only after that decision is represented as a versioned rule.

### Assisted channel

The pilot includes staffed agent desks that can help citizens recover access, understand status, complete an approved assisted application journey and print/reprint an Exam Pass. Staff must not impersonate the citizen or bypass the approved identity checks. Capture assistance action, purpose and actor; minimise the data shown; give the citizen a receipt and safe next steps. USSD and expanded SMS self-service require separate channel design, partner commitments, consent/legal basis where applicable, threat modelling and test coverage.

## 15.6 Data residency, privacy and legal deployment gates

This document is not legal advice. Before production data is processed, the agency's qualified legal counsel and DPO must validate Law No. 058/2021 and all applicable recruitment/security requirements against the actual architecture and data flows.

Required artefacts include:

- data inventory/classification and data-flow map, including registries, SMS providers, analytics, support tools, backups, logs and crash reporting;
- controller/processor roles, purposes and lawful basis for each processing activity;
- controller/processor registration and other approvals as applicable;
- privacy notices covering purposes, recipients, mandatory/optional fields, rights, retention and automated-decision information where required;
- data protection impact assessment where required, records of processing and data-subject request procedure;
- data residency/hosting decision for production, DR, backup, logs, object storage and vendor support;
- transfer authorisation and contractual controls for any data leaving Rwanda, if applicable;
- retention schedule by data class, legal holds, deletion/destruction evidence and audit retention;
- breach detection, containment, evidence preservation, decision authority and notification procedure, including the legally applicable notification clock;
- approved policy for sensitive medical, criminal, biometric, identity and cross-agency data.

**Proposed hosting target:** two qualified sites within Rwanda, active-passive or another tested topology, with documented replication lag and failover. If in-country dual-site hosting is unavailable, do not assume offshore backup is permissible: obtain platform-specific authorisation, document the transfer and recovery design, and keep encryption-key custody in the approved jurisdiction as required by counsel/DPO.

Data residency must be evaluated across the whole system—not only the primary database. Include replicas, snapshots, object storage, telemetry, vendor tickets, backups, exported reports and developer/support access.

## 15.7 Database isolation, API security and privileged access

- Test PostgreSQL row-level security as a non-superuser/non-`BYPASSRLS` role for every tenant-scoped table. Check table-owner bypass, `FORCE ROW LEVEL SECURITY`, `SECURITY DEFINER` functions/views and pooled connection context.
- Establish agency context with transaction-scoped `SET LOCAL` or an equivalent safe mechanism; prove it cannot leak across pooled requests.
- Every object read/write requires server-side object-level authorisation, not only route authentication or UI visibility.
- Test cross-agency reads/writes, guessed IDs, wrong session kinds, revoked sessions, insufficient role and break-glass access.
- Keep privileged roles least-privileged, time-limited and monitored. No generic “superadmin” shortcut. Separate campaign publication, medical review, adjudication, final decision, acceptance, conflict resolution, DPO decision and fleet administration according to approved separation-of-duties policy.
- Consider per-agency encryption-key separation where the approved architecture supports it; this does not replace RLS or service-level authorisation.
- Use an independent security assessment against the proposed OWASP ASVS Level 2 baseline, with Level 3 review for identity, signing and field-sync components if ratified by security. These are proposed assurance targets, not a certification claim.

## 15.8 Capacity, bottlenecks and service objectives

The adversarial capacity model demonstrates that registry budgets and OTP delivery can constrain the service more than raw filing throughput. The figures below are **illustrative calculations from source assumptions**, not measured forecasts. They must be replaced with agency campaign forecasts, provider commitments and load-test results before sizing.

| Scenario | Applicants | Filings in final 48 h (40% assumption) | Peak filings/s (15% of final-48h volume in peak hour) | Peak OTP/s (2.5 sends per filing) | Concurrent uploads (12-second slow-link assumption) | Registry calls (3 per filing) | Drain time at 5 calls/s |
| -------- | ---------: | -------------------------------------: | ----------------------------------------------------: | --------------------------------: | --------------------------------------------------: | ----------------------------: | ----------------------: |
| Low      |     20,000 |                                  8,000 |                                                  0.33 |                               0.8 |                                                  12 |                        60,000 |               3.3 hours |
| Base     |    100,000 |                                 40,000 |                                                   1.7 |                               4.2 |                                                  60 |                       300,000 |              16.7 hours |
| High     |    500,000 |                                200,000 |                                                   8.3 |                              20.8 |                                                 300 |                     1,500,000 |                3.5 days |

Assumptions behind this table: 40% of filings arrive in the final 48 hours; 15% of those arrive in the peak hour; 2.5 OTP sends, 3 registry calls and 3 uploaded files per filing; 12 seconds per upload on a slow mobile link; aggregate registry allowance of 5 calls/second. These assumptions are not requirements. Replace them with signed-off data.

Implications:

- Negotiate written latency, rate budgets, maintenance windows, outage contacts and manual-fallback terms with NIDA, NESA, HEC, RIB and SMS operators.
- Use asynchronous gate queues and show truthful `pending` state. Never translate a rate-limited or unavailable registry into a negative eligibility verdict.
- Apply bounded retries, jitter, circuit breakers and per-provider budgets. Avoid retry storms and uncontrolled fan-out.
- OTP is an abuse/spend bottleneck; define daily budgets, anomaly detection, operator failover and supervised alternatives.
- Gate throughput is also a people/process constraint. For a venue admitting 1,000 candidates over three hours, the mean is roughly one check every 11 seconds; with four lanes and 1.5× peak factor, the proposed gate target is under 3 seconds per signed-pass check, offline.

### Proposed service levels — ratification required

| Service                             | Proposed target                                  | Important qualification                                                     |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Portal during registration windows  | 99.9% non-5xx requests                           | Define exclusions and error-budget release policy.                          |
| Portal outside registration windows | 99.5% non-5xx requests                           | Confirm cost/service trade-off.                                             |
| Filing edge latency                 | 95% under 3 seconds                              | Excludes asynchronous registry completion.                                  |
| OTP delivery                        | 95% within 60 seconds                            | Measure per operator; platform cannot guarantee carrier delivery.           |
| Eligibility result                  | 95% within 24 hours                              | Excludes declared registry outages and depends on written call budgets.     |
| Gate verification                   | 95% under 3 seconds offline                      | Requires tested key cache, device performance and safe clock behaviour.     |
| Field record acknowledgement        | 99% within 15 minutes after connectivity returns | Measure per record, not per device.                                         |
| Application-data RPO                | 5 minutes                                        | Confirm against recovery architecture and business impact.                  |
| Audit-evidence RPO                  | Zero proposed                                    | Only credible with synchronous durable audit semantics and tested recovery. |
| RTO in campaign window              | 4 hours proposed                                 | Confirm business impact and tested recovery.                                |
| RTO outside campaign window         | 24 hours proposed                                | Confirm service-owner approval.                                             |

Before go-live, perform a spike test at 3× the approved high scenario, a 24-hour soak, and controlled failure drills for the database primary, event relay and each critical registry/provider. Publish results with the tagged release. Do not call the system load-proven based on calculations alone.

## 15.9 Disaster recovery, operational command and incident readiness

A backup is not proven until a restore is completed and checked. Required drills include point-in-time database restore, event/outbox replay, object-store recovery, key restoration/rotation and application-level reconciliation. Compare record counts, key aggregates and checksums; record the measured RPO/RTO.

Required runbooks and first-response ownership:

| Failure                              | First response                                                                                                                                        | Accountable lead             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Registry slow/down                   | Queue requests, show pending, open supervised manual verification lane, notify integration owner                                                      | Integration lead             |
| OTP provider outage/abuse spike      | Fail over if approved, enforce spend limits, enable assisted-desk fallback, monitor fraud signals                                                     | Platform/security            |
| Database primary loss                | Promote only under runbook, verify recovery point and audit continuity, freeze writes if integrity is uncertain                                       | Platform/data lead           |
| Event backlog/dead-letter growth     | Stop or throttle producers if needed, inspect poison events, replay with deduplication and reconcile projections                                      | Platform/domain lead         |
| Wrong policy/status applied at scale | Stop affected transitions, snapshot evidence, recompute from immutable inputs, notify accountable owners and affected people under approved procedure | Domain lead                  |
| Venue unusable                       | Invoke P1 relocation/rescheduling, invalidate old passes, issue replacement notices and reconcile capacity                                            | Field operations             |
| Scoring/threshold defect             | Quarantine affected records, recompute from raw signed measurements under approved policy, issue correction procedure                                 | Domain lead/assessment owner |
| Suspected personal-data breach       | Contain, preserve evidence, activate DPO/legal assessment and applicable notification timeline                                                        | DPO/security                 |
| Signing-key compromise               | Stop issuance if needed, rotate keys, publish revocation, refresh validators, reissue affected passes and reconcile admissions                        | Security/key owner           |
| Device lost/stolen                   | Disable staff/device access, revoke key, assess disconnected-window exposure, preserve audit and account for local queue                              | Field operations/security    |

Operational minimums:

- Named control room during registration windows and exam days, with severity levels, escalation matrix, on-call rota and decision authority.
- Incident message templates in Kinyarwanda, English and French; citizen-facing status/outage notice and an SMS/assisted alternative.
- Change freeze proposed at seven days before registration opens and before each exam day, with emergency-change authority and tested rollback.
- Feature flags, canary releases, staged rollout and a visible version-skew dashboard.
- Every service instance and managed field device reports build version, policy version/hash, key version where applicable, and compatibility state. A release is not operationally complete until incompatible version skew is zero or an explicitly approved bounded exception exists.
- Hypercare after launch, incident review within one week as a proposed target, and corrective actions with owners/dates.

## 15.10 Pilot district and national expansion model

National rollout must be earned by evidence, not assumed from a successful development environment.

1. Select a pilot district/venue with agency approval and representative connectivity, staffing and candidate volume.
2. Train administrators, gate staff, paper-document officers, physical-test staff, medical staff, supervisors, support/assisted-desk staff and control-room operators.
3. Rehearse normal operation, registry outage, OTP outage, device failure, all-device failure, venue relocation, signing-key incident, candidate dispute and end-of-day reconciliation.
4. Run a controlled pilot with synthetic/test data first where appropriate, then a legally authorised limited live cohort.
5. Close the pilot only when application outcomes, notifications, reservations, pass validity, field records, paper records, conflicts and audit evidence reconcile exactly or have individually approved exceptions.
6. Hold a formal go/no-go review; no team may waive a critical gate unilaterally. Residual risk acceptance must be written and owned by an authorised person.
7. Expand by district/agency/cohort using measured operational data, incident learnings and a repeatable rollout checklist. Preserve a rollback/stop mechanism between stages.

## 15.11 Nine mandatory go-live gates

A production launch requires evidence for all applicable gates. A green screen, successful build or static source inspection is not enough.

| Gate                         | Required evidence                                                                                                                                        | Stop condition                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| G1 — Release and contracts   | Tagged immutable SHAs; CI artefacts; schema/permission/error/idempotency contract diff; critical contract tests pass                                     | Unreproducible baseline, unresolved contract drift, or skipped critical tests                 |
| G2 — Domain integrity        | Duplicate-submit/replay tests; capacity/concurrency tests; immutable policy binding; legal transitions; outbox/dedupe/reconciliation proof               | Duplicate applications/slots, silent transition, policy ambiguity or unreconciled events      |
| G3 — Identity and access     | Approved identity flow; OTP abuse controls; step-up where required; object ownership/agency isolation; staff MFA/session revocation; supervised fallback | Identifier treated as secret, unauthorised access, or no workable failure route               |
| G4 — Privacy/legal/residency | DPO/legal approvals, data-flow map, required registrations/impact assessments, retention and transfer/hosting decisions                                  | Unapproved processing, unclear data location/transfer authority or missing accountable owner  |
| G5 — Exam continuity         | Signed pass download/print; offline verification; paper fallback; assisted desk; operator relocation; invalidation/reissue and reconciliation            | No viable exam-day fallback or old and replacement passes can both be accepted outside policy |
| G6 — Reliability/recovery    | Ratified SLOs/RPO/RTO; load/soak/failure drills; restore proof; registry budgets; monitoring and runbooks                                                | Recovery not demonstrated or upstream failure becomes false rejection/silent loss             |
| G7 — Field integrity         | Approved device fleet; device/policy attestation; durable capture; signed provenance; idempotent replay; conflicts resolved; exact closeout              | Offline sync unproven, version skew unexplained, or any record unaccounted for                |
| G8 — Operational readiness   | Pilot completed; staff trained; control room/on-call active; multilingual scripts; support, rollback, hypercare and change freeze ready                  | No operational owner, untrained staff or unrehearsed critical procedure                       |
| G9 — Release authorisation   | Gate evidence reviewed; critical blockers closed; residual risks and exceptions explicitly accepted by authorised owners                                 | Unowned residual risk or unauthorised waiver                                                  |

## 15.12 Unified conflict and decision register

This register replaces silent averaging of the two documents. The source-specific disagreement register remains useful provenance, but the following decisions govern implementation.

| Topic                                | Source tension                                                                                                   | Unified decision                                                                                                                | Proof / owner                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Repository SHAs and 42/42 operations | Product report observed matching paths; adversarial review could not independently inspect the same repositories | Retain as reported snapshot evidence; require tagged CI artefacts and fresh contract diff before relying on it                  | Engineering/CI; G1                         |
| Path equality                        | Static method/path match presented as contract alignment                                                         | Compare schemas, permissions, sessions, errors, idempotency, retries and versioning; run consumer contract tests                | Frontend/backend leads; G1                 |
| Readiness                            | Original ladder ends at E2E                                                                                      | Add load-proven and operationally-ready rungs                                                                                   | QA/SRE; G6/G8                              |
| Identity                             | ID + DOB + OTP could be mistaken for proof                                                                       | OTP verifies contact only; approved identity path and supervised venue verification remain necessary                            | Security/DPO/identity owner; G3            |
| Biometrics                           | Existing service concepts could invite a biometric-first gate                                                    | Optional only after contract/legal/accuracy review; manual photo comparison and supervised fallback are baseline                | Security/field ops/DPO; G3/G5              |
| Idempotency                          | Conflict behaviour named but not fully specified                                                                 | Publish scope, fingerprint, expiry, in-flight semantics and response model; test same-key/same-body and same-key/different-body | API/domain owners; G1/G2                   |
| RLS                                  | RLS described as isolation                                                                                       | Test bypass roles, table owners, `FORCE RLS`, SECURITY DEFINER, pooled context and every tenant table                           | Data/security; G3                          |
| Offline                              | Browser queue described as durable                                                                               | Managed Android pilot only with drills; native encrypted database target for national scale; paper fallback from pilot          | Security/field ops; G5/G7                  |
| Exam Pass                            | `no-store` conflicts with offline presentation                                                                   | Keep API `no-store`; explicit download/print and approved short-code fallback; signed PII-minimal payload                       | Identity/scheduling/security; G5           |
| Rescheduling                         | Applicant reschedule placed late; system relocation insufficiently prioritised                                   | Operator-initiated relocation is P1; applicant-initiated reschedule remains policy-gated later                                  | Recruitment operations; G5                 |
| Assisted channels                    | USSD/kiosk treated as late channel work                                                                          | Staffed assisted access and pass printing at pilot; USSD follows separate decision                                              | Service owner; G8                          |
| ADS licence                          | ADS assumed as default shared foundation                                                                         | Obtain written licence decision or migrate to appropriately licensed alternative; architecture remains library-neutral          | Legal/engineering; Wave 0                  |
| Residency                            | Not on critical path in product roadmap                                                                          | Validate every data flow and backup/DR location before live data; proposed in-country dual site                                 | DPO/legal/platform; G4/G6                  |
| SLO/load                             | Targets were to be defined later                                                                                 | Ratify targets before launch; capacity figures remain assumption-based until measured                                           | Product/platform/integrators; G6           |
| Release integrity                    | Deployment version skew under-specified                                                                          | Attest service/device build and policy version; freeze changes before critical dates; test rollback                             | Release/security/ops; G8/G9                |
| Audit/outbox                         | Outbox and idempotent consumers present as sound design                                                          | Add aggregate partitioning, dedupe, dead-letter/replay runbooks and pruning; restore from evidence                              | Platform/domain; G2/G6                     |
| Human exceptions                     | Biometric/registry failures lacked operational detail                                                            | Every failure has a supervised/manual lane; upstream unavailable is not candidate failure                                       | Operations/agency owners; G3/G5            |
| Fairness/decisions                   | Outcomes/appeals and slot rules remain underdefined                                                              | Ratify auditable slot assignment, disclosure, correction/appeal and medical/physical standards before enabling                  | Agency/legal/DPO; G2/G4                    |
| Cross-agency metrics                 | Dashboard needs compete with agency isolation                                                                    | No general cross-agency candidate access; separately approved aggregate-only projection with small-cell suppression             | Governance/DPO/security; G4                |
| AI assistance                        | Future automation could be interpreted as decision automation                                                    | Begin read-only, policy-grounded, reviewable; no authoritative eligibility/medical/adjudication/final hiring/access decisions   | Product/security/agency; separate approval |

## 15.13 Final go-live checklist

- [ ] Tagged release with immutable source SHAs, build provenance, SBOM, contract diff and test artefacts.
- [ ] Contract tests cover schema, session, permissions, errors, idempotency and retries—not only routes.
- [ ] No critical journey is hidden behind `test.fixme` or skipped tests.
- [ ] ADS licence resolved or approved alternative selected and dependency provenance reviewed.
- [ ] Data flow, hosting, backup, DR, transfer, DPO/legal and retention artefacts approved.
- [ ] Identity, OTP, step-up, staff authentication, session revocation and manual venue fallback tested.
- [ ] PostgreSQL RLS and object-level authorisation tested as non-bypass roles across every tenant boundary.
- [ ] Signing keys are held in approved hardware-backed key management; rotation, revocation and compromise drills pass.
- [ ] Device/policy version skew is zero or a bounded, approved exception is recorded.
- [ ] Registry and OTP budgets/outage contacts are agreed in writing; manual verification is rehearsed.
- [ ] Load spike at 3× approved high scenario, 24-hour soak and critical dependency failure drills pass.
- [ ] Point-in-time restore and reconciliation drill proves record counts/checksums and measured RPO/RTO.
- [ ] Pilot paper fallback, dual-entry reconciliation, device replacement and venue relocation are rehearsed.
- [ ] Assisted desks and staff are trained; Kinyarwanda, English and French scripts exist.
- [ ] Control room, on-call, severity ladder, citizen messaging, rollback, change freeze and hypercare are ready.
- [ ] Every offline record is accounted for; unresolved exceptions have evidence, owner and explicit acceptance.
- [ ] All nine gates have named reviewers and signed evidence; no critical blocker is silently waived.

# 16. Final recommendation and implementation directive

The two sources are now unified into one baseline with a clear authority model: the product research provides the detailed user-facing feature catalogue and current reported repository findings; the adversarial review strengthens or corrects deployment assumptions; this master document records the binding resolution of conflicts. Neither source is treated as infallible, and neither static inspection nor external secondary research is represented as a test run, legal opinion or production certification.

The next work should be executed in this order:

1. **Evidence and gates first:** publish tagged CI contract/build/test artefacts; refresh stale documentation; resolve the design-system licence; start the residency/DPO/legal and identity/device-owner decisions.
2. **Prove one reference surface:** complete the officer application workspace with a truthful surface manifest, real operation contracts, complete states, accessibility and parallel verification.
3. **Prove one whole journey:** campaign draft/policy/session/publish → applicant identity and campaign-bound filing → document/eligibility status → signed invitation → field verification/capture → final outcome, with correlated audit and notification evidence.
4. **Make the first pilot operable:** staffed assisted access, paper fallback, system-initiated relocation, registry outage lanes, device/version controls, control room, training and closeout reconciliation.
5. **Scale only from evidence:** finish applicant/Campaign Studio and field screens, implement durable offline evidence only when proven, build operational read models and governance, then expand by pilot gates.

The governing test is simple: **can the team prove, from a tagged build and auditable evidence, what happened to every candidate and every field record—even when identity checks fail, a registry is down, a venue changes, a device is lost, or the network disappears?** If not, the system is not yet nationally ready.

## Source and reference integrity

This master merges the two source documents listed in the front matter. Repository findings and source commit identifiers are retained as reported findings, not independently re-verified by this document. The product research itself states that its review was static and did not run local builds, E2E tests, database-backed selfchecks, government integrations, production telemetry or a security audit. The adversarial review states that it could not independently inspect the same codebase. Therefore current implementation status must be re-established with a tagged CI evidence bundle.

External sources cited by the source documents include:

- Rwanda Data Protection & Privacy Office: [controller/processor obligations](https://dpo.gov.rw/dpp-law/obligations-of-the-data-controller-and-the-data-processor), [processing and quality](https://dpo.gov.rw/dpp-law/processing-and-quality-of-personal-data), [data-subject rights](https://dpo.gov.rw/dpp-law/rights-of-the-data-subject), [sharing, storage and retention](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data).
- NIST SP 800-63B-4: [authentication guidance](https://pages.nist.gov/800-63-4/sp800-63b.html).
- OWASP API Security: [Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) and [API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/).
- MDN: [storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).
- IETF: [Idempotency-Key draft 07](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html); treat its status as a draft convention, not a final standard.
- W3C: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- GOV.UK Service Manual: [solve the whole problem](https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem), [join up channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels), [operate a reliable service](https://www.gov.uk/service-manual/service-standard/point-14-operate-a-reliable-service).
- Transactional outbox pattern: [microservices.io](https://microservices.io/patterns/data/transactional-outbox).
- Atlassian Design System: [licence](https://atlassian.design/license); confirm applicability with counsel before use.
- Additional incident/capacity context in the adversarial source: [TechCabal on the 2025 JAMB incident](https://techcabal.com/2025/05/16/inside-the-server-glitch-behind-jambs-scrambled-utme-score/), [RURA/SIM registration reporting](https://www.newtimes.co.rw/article/188978/News/new-sim-card-registration-process-to-curb-fraud-rura), [Internet Society Pulse Rwanda](https://pulse.internetsociety.org/reports/rw).

**Limitations:** This document does not claim that the external pages have been re-opened during this merge, that legal interpretations have been validated by Rwandan counsel, or that the proposed SLOs/capacity assumptions reflect measured traffic. Owners must verify these items before treating them as binding policy.