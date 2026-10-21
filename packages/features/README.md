# `packages/features` — vertical slices

Seven slices. Each is `api/ model/ ui/ routes/` behind exactly one importable file, `src/index.ts`. **No slice may import another slice.**

| Slice | Owns |
|---|---|
| `identity` | NID verify, OTP, applicant session, officer login, consent |
| `applications` | the 19-status lifecycle, officer list/detail, status history, wizard drafts |
| `adjudication` | amber queue, document-forensics signals, the four officer transitions |
| `scheduling` | invitation key, signed QR verification, the citizen slot gap |
| `field-ops` | the Field Station's stations: venue gate, walk-in desk, station model; biometric check-in, device enrolment, offline capture, conflicts (S08) |
| `compliance` | erasure requests, DPO queue, self-withdrawal, retention |
| `campaigns` | campaign lifecycle, the typed campaign-control adapter, public catalogue (S02 scaffold; S05 builds the Studio) |

Boundaries are drawn by **domain, not by service**: `GET /v1/applicants/me/applications` lives on identity-service and belongs to `applications`.

See `docs/architecture/adrs-fe/ADR-FE-001`.
