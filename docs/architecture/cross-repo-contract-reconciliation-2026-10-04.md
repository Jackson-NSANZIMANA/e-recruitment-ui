# Cross-repository frontend contract reconciliation

**Status:** current engineering baseline
**Frontend checkout:** `Jackson-NSANZIMANA/e-recruitment-ui`
**Frontend base:** `93d6764ba44ebe906fc2e159c3b9fb296726e386`
**Backend baseline:** `Jackson-NSANZIMANA/e-recruitment@06d9f9b6b1bc935a20beb8bd87ee8f96bc437aab`
**Scope:** browser edge, service OpenAPI, generated client artifacts, officer application workspace

This is the evidence register for the frontend/backend reconciliation. It is intentionally checked in beside the executable gates so a future change has a clear place to update the claim and a command that can reject an unproven claim.

## What was reconciled

| Boundary | Frontend evidence | Backend evidence | Current rule |
|---|---|---|---|
| Browser edge | `packages/api-client/src/paths.ts` | backend `services/edge-gateway/src/domain/edge-operations.ts` | Every backend edge method/path has one frontend operation with matching session, composition, and G2G retry policy. Product aliases are allowed; method and exact path are not. |
| Edge route composition | `packages/api-client/src/transport.ts` and `tooling/edge-dev/src/routes.ts` | backend `services/edge-gateway/src/routes.ts` | Browser code calls the operation ID. It does not construct a service URL, service route, agency path, or arbitrary header. |
| Service routes | `packages/contracts/openapi/*.yaml` and `tooling/contract-drift/route-manifest.json` | backend controller source at the pinned SHA | OpenAPI is verified against the checked-in backend route manifest. System-token routes are not browser reachable. |
| Generated contract | `packages/contracts/src/generated/` | OpenAPI at the pinned SHA | Generated route/types/Zod files are deterministic and must have zero diff after regeneration. |
| Applicant submission | `identity-service.yaml`, `api-client/src/operations/applicant.ts`, `api-client/src/transport.ts` | `POST /v1/applicants/me/applications` | Applicant session owns identity and agency. The caller supplies an idempotency key; the transport emits only the named `idempotency-key` header. |
| Officer workspace | `docs/ui-surfaces/officer.application-workspace.json` | officer application operations in the edge registry | `/applications` and `/applications/:id` own list/detail rendering and must show all declared loading, empty, failure, authorization, mutation, and conflict states. |

## Current contract inventory

- 11 service OpenAPI documents.
- 59 generated service operations.
- 210 generated schemas.
- 27 browser edge operations in the frontend registry, reconciled by gate D to the backend registry.
- 151 structural fixture cases, including applicant submission and a negative national-ID leakage case.
- Backend SHA pinned in OpenAPI and generated artifacts: `06d9f9b6b1bc935a20beb8bd87ee8f96bc437aab`.

The submission contract is deliberately named in OpenAPI rather than expressed as inline schemas. The repository generator rejects inline request/response schemas, so `SubmitApplicationRequest` and `SubmitApplicationResponse` are component references and are included in the generated types and Zod validators.

## Security and transport decisions

1. **One browser boundary.** Both SPAs use the edge origin. Direct calls to identity, application, IAM, G2G, or other service ports are not permitted.
2. **Session-derived authority.** Agency and applicant identity are derived server-side. Frontend functions never accept `agency`, `nationalIdHash`, or an applicant identity as a way to widen authority.
3. **Exact paths.** The operation registry is the only browser path registry. No templated service URL or client-generated path is introduced.
4. **Write safety.** Mutations are not automatically retried. Applicant submission requires a caller-owned idempotency key so a reconnect can replay a filing without creating a second application.
5. **Header minimization.** The API client intentionally has no arbitrary-header escape hatch. `Idempotency-Key` is an explicit typed transport option; CSRF and correlation headers remain transport-owned.
6. **Response minimization.** National ID and `nationalIdHash` are request/internal concepts and are rejected by fixtures if they appear in browser-facing submission responses.
7. **Offline honesty.** Field-sync reachability is now reconciled at the edge, but `OFFLINE_CAPTURE_CAN_SYNC` remains `false`. No UI may claim durable offline capture, replay, or conflict resolution until encrypted local storage, replay ownership, and explicit conflict UX are implemented and proven.

## Executable proof

Run from the repository root:

```bash
# Regenerate, compare, drift-check, fixture-check, and schema-parity-check.
node --experimental-strip-types packages/contracts/scripts/verify.ts

# Direct current-backend manifest/edge reconciliation when a sibling checkout is available.
node --experimental-strip-types tooling/contract-drift/src/cli.ts --backend /path/to/e-recruitment

# Frontend operation-registry self-test and officer surface contract.
node --experimental-strip-types tooling/contract-drift/src/selftest.ts
node --experimental-strip-types tooling/surface-contract/src/cli.ts

# Real-socket security/transport proof.
npm exec --yes pnpm@9.15.0 -- --filter @usrp/edge-dev selfcheck

# Typed package proof.
npm exec --yes pnpm@9.15.0 -- typecheck
```

The current frontend-only drift baseline is **588 assertions, 0 findings**. The current surface contract is **42 assertions, PASS**. The edge development proof is **143 assertions over real sockets, GREEN**. `contracts/scripts/verify.ts` additionally requires a clean generated-artifact diff; run it after the generated files are committed or in CI against the committed tree.

## Change protocol

A backend route or edge operation change is not frontend-ready until the same change updates, in one reviewable unit:

1. the backend SHA pin and source evidence;
2. OpenAPI and named schemas;
3. generated artifacts;
4. the frontend edge registry and typed operation, if browser reachable;
5. fixtures, including negative security fixtures;
6. the affected UI surface manifest and localized state copy;
7. the proof output or an explicit documented blocker.

Do not solve drift by widening the client, adding arbitrary headers, exposing an internal service port, or making a mutation retryable. Those moves hide a contract disagreement instead of reconciling it.
