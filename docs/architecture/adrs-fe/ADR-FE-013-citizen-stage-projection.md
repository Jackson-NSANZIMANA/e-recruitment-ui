# ADR-FE-013 — The citizen stage is a projection over the canonical status enum

**Status:** Accepted · 2026-10-18 (S02, decision) · S10b implements

## Context

Citizens need a short, honest tracker ("where am I?"), not the officer's lifecycle. Inventing a second status vocabulary would drift from the backend's `APPLICATION_STATUSES` (`@usrp/contracts`), which is generated from the backend at a pinned SHA.

## Decision

1. The citizen stage is **one pure function**, `toCitizenStage(status)`, in `packages/features/applications/src/model`, mapping every value of the canonical enum. There is no citizen status stored or sent anywhere.
2. It is **exhaustive by construction**: a `switch` over the enum with a `never` check, and a test that iterates `APPLICATION_STATUSES` so a new backend status fails the build until it is mapped.
3. Rules the mapping must keep: `DRAFT` is **not** "submitted"; the walk-in statuses are excluded from the online tracker (a walk-in candidate follows the venue process); terminal outcomes (`ACCEPTED`, `REJECTED`, `WITHDRAWN`) are stated plainly; no forensics or adjudication detail reaches a citizen (AGENTS.md §2).
4. The Exam Pass states (`PENDING`, `READY`, `ON_HOLD`, `ADMITTED`, unavailable) stay the server's `getMyExamInvitation.state`; the projection does not re-derive them.

## Consequences

S10b builds `toCitizenStage` and the tracker on this decision; S02 ships no code for it.
