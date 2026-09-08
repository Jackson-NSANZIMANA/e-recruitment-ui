# The authoritative USRP port map

**Generated from `tooling/edge-dev/src/ports.ts`.** Regenerate with
`pnpm --filter @usrp/edge-dev ports`. Do not hand-edit this file; edit the
source, which `assertNoPortCollisions()` checks at every edge-dev boot.

## The collision this file exists to fix

`docs/architecture/frontend-architecture.md` §7 tells every developer:

```
# apps/officer-console/.env.local
VITE_BFF_URL=http://localhost:4001/api/v1
```

The backend's `.env.example` sets `PORT_IDENTITY_SERVICE=4001`.

So the officer console's "BFF" was **identity-service**, which serves no officer
route at all. Every officer request in that configuration reaches a live,
healthy, completely wrong service and 404s. The applicant portal's `4000` fails
more quietly: nothing in the platform binds it, so the connection is simply
refused.

Correct targets: **officer-console → 4021** (agency-bff RDF), **applicant-portal
→ 4020** (citizen-bff). Both are already named in the backend's `.env.example`
as `PORT_AGENCY_BFF` and `PORT_CITIZEN_BFF`.

## The map

| Port | Process | Env var | Provenance | Note |
|---|---|---|---|---|
| 3000 | applicant-portal | — | env-canon | In CORS_ORIGINS. Talks to citizen-bff (4020) — NOT 4000, which nothing binds. |
| 3001 | officer-console | — | env-canon | In CORS_ORIGINS. Talks to agency-bff (4021/4022/4023). |
| 3100 | nida-mock | NIDA_BASE_URL | env-canon | Identity registry. |
| 3101 | nesa-mock | NESA_BASE_URL | env-canon | Secondary education results. |
| 3102 | rib-mock | RIB_BASE_URL | env-canon | Criminal record. |
| 3103 | hec-mock | HEC_BASE_URL | env-canon | Higher-education council. |
| 4001 | identity-service | PORT_IDENTITY_SERVICE | env-canon | The port frontend-architecture.md §7 wrongly gave the officer console. |
| 4002 | eligibility-service | PORT_ELIGIBILITY_SERVICE | env-canon | System-token only. Never browser-reachable. |
| 4003 | biometric-service | PORT_BIOMETRIC_SERVICE | env-canon | Officer-token. Registers no readiness probe (GET /ready always 200). |
| 4004 | document-forensics-service | PORT_DOCUMENT_FORENSICS_SERVICE | env-canon | System-token only. |
| 4005 | background-vetting-service | PORT_BACKGROUND_VETTING_SERVICE | env-canon | No business HTTP route; probes only. |
| 4006 | application-service | PORT_APPLICATION_SERVICE | env-canon | Officer reads, the FOUR officer transitions, and walk-in. |
| 4007 | scheduling-service | PORT_SCHEDULING_SERVICE | env-canon | Only GET /v1/slots/invitation-key is unauthenticated. |
| 4008 | notification-service | PORT_NOTIFICATION_SERVICE | env-canon | No business HTTP route; probes only. |
| 4009 | field-sync-service | PORT_FIELD_SYNC_SERVICE | env-canon | Officer-token; field tablets. |
| 4010 | audit-service | PORT_AUDIT_SERVICE | env-canon | No business HTTP route; probes only. |
| 4011 | iam-service | PORT_IAM_SERVICE | env-canon | Officer login + service-token issuance. Sole private-key holder. |
| 4020 | citizen-bff | PORT_CITIZEN_BFF | env-canon | ONE cross-agency deployment: a citizen inherently spans agencies (ADR-014/018). |
| 4021 | agency-bff (RDF) | PORT_AGENCY_BFF | env-canon | AGENCY=RDF. The officer console targets THIS, not 4001. |
| 4022 | agency-bff (RNP) | PORT_AGENCY_BFF | ui-convention | Same codebase, AGENCY=RNP. Dev-only allocation; backend names one variable. |
| 4023 | agency-bff (RCS) | PORT_AGENCY_BFF | ui-convention | Same codebase, AGENCY=RCS. Dev-only allocation. |
| 4024 | admin-bff | PORT_ADMIN_BFF | env-canon | Named and reserved; this contract specifies no route for it yet. |
| 4911 | edge-dev mock iam-service | EDGE_DEV_MOCK_IAM_PORT | ui-convention | Mirrors 4011 in the 49xx band. |
| 4901 | edge-dev mock identity-service | EDGE_DEV_MOCK_IDENTITY_PORT | ui-convention | Mirrors 4001. |
| 4906 | edge-dev mock application-service | EDGE_DEV_MOCK_APPLICATION_PORT | ui-convention | Mirrors 4006. |

## Provenance

- **env-canon** — the name and number come from the backend's committed
  `.env.example`, which `scripts/verify-dev-boot.sh` boots the whole platform
  from on every gate run. Do not change these here.
- **ui-convention** — this repo is the source; no backend variable names it.
  Only four entries: the RNP/RCS agency-bff dev ports (the backend names one
  `PORT_AGENCY_BFF` because agency-bff is one codebase with three deployments)
  and the three edge-dev mock ports.

## Why the mocks live in the 49xx band

A mock that binds a real service's port is indistinguishable from that service
being up. That is the worst possible behaviour for a stand-in: it converts "the
stack is not running" into "the stack is running and returning fixtures", and the
first person to notice is whoever trusts the result.

## The rule the backend already learned

Eleven services once resolved a bare `PORT` defaulting to 3000. The first bound
the socket and the other ten died on `EADDRINUSE` — and nobody had ever seen it,
because environment failures killed the processes before any reached `listen()`
(`docs/architecture/dev-boot-and-env-contract.md`). The fix was to DERIVE a
scoped name per service. The lesson generalises: **a surface no proof executes
will drift**, so this map is data a program asserts over, not a table a human
maintains.
