# Backend Runtime Baseline — 2026-10-04

## Authoritative repository

`Jackson-NSANZIMANA/e-recruitment`, `main` at
`06d9f9b6b1bc935a20beb8bd87ee8f96bc437aab`.

The frontend agent workspace treats this as the current runtime truth for the
browser-facing edge contract until a later baseline is explicitly approved.

## Officer application contract

The flagship officer application surface consumes these edge operations:

- `GET /edge/v1/applications`
- `GET /edge/v1/applications/by-id?applicationId=...`
- `GET /edge/v1/applications/detail?applicationId=...`
- `GET /edge/v1/applications/status-history?applicationId=...`
- `POST /edge/v1/applications/medical-review`
- `POST /edge/v1/applications/final-decision`
- `POST /edge/v1/applications/accept`
- `POST /edge/v1/applications/adjudicate`

The edge is the only browser boundary. Agency is derived from the verified
officer session and RLS; the browser must not send an agency selector as an
authorization field.

## Read-shape rules

`listApplications` returns a bare array.

`findApplicationById` returns a projected detail object.

`getApplicationDetail` returns `{ application, history }`.

`getApplicationStatusHistory` returns a bare history array.

The edge response projections are allowlists, not pass-throughs. The frontend
must therefore consume the public edge shape rather than importing service
internals.

## Transition rules

Transitions are separate POST operations; there is no generic status PATCH.
Mutation responses are transition receipts, not application records. After a
successful transition, invalidate/refetch the authoritative detail/list state.

The current human decision gates are:

`PHYSICAL_TEST_COMPLETE | WALK_IN_PHYSICAL_TEST`
→ medical review

`MEDICAL_REVIEW` → final decision

`FINAL_SHORTLIST` → accept

`DOCUMENT_REVIEW_AMBER | ADJUDICATION_REVIEW` → adjudication

## Browser capability gap

`POST /v1/documents/upload` exists in `document-forensics-service` but is not
currently exposed through the edge browser boundary. The frontend must not
pretend that a citizen-facing upload workflow is executable until a reviewed
edge operation exists.

## Contract provenance warning

The existing frontend generated contract bundle and CI provenance contain older
backend SHA values. They must not be silently rewritten to the runtime SHA here.
A full contract-regeneration/reconciliation step is required before changing
those historical/generated provenance fields.
