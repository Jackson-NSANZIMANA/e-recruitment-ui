# ADR-FE-019 — Sandbox presentation and NIDA pre-fill

**Status:** Accepted (banner, pre-fill block) · 2026-10-29 (S12c) · picker and checklist UI: not yet built
**Relates to:** backend ADR-049, ADR-FE-020 (national identity), ADR-035 (rehearsal markers)

## Decisions

1. **A sandbox says so, everywhere.** A build with `VITE_USRP_SANDBOX=1` renders `SandboxBanner` above everything in all three apps: in the national frame (citizen pages and staff sign-in), in the officer console shell, in the field-station shell. Same wording in en, rw and fr; `role="note"`; danger-bold token so it cannot be mistaken for the handling marking. A production build never sets the flag.
2. **Identity is shown, not re-asked.** The apply wizard shows names, sex, date of birth and district read-only, headed "as recorded by NIDA", from the edge operation `getMyIdentity`. It states that a wrong value is corrected with NIDA, not in the form. Fields the platform does not retain (place of birth, nationality) are shown as asked for. A failed read shows a neutral notice and never blocks the application, which NIDA verifies anyway.
3. **Never shown:** photo, signature, parents' names, the full National ID. The edge allowlists the response and a contract fixture rejects a body carrying a photo.
4. **Health questions are never asked in the portal.** They belong to the medical station (DPIA).

## Owner decisions (default taken, owner to confirm)
The identity fields listed above; no health questions in the portal.

## Not yet built
Category picker with per-qualification caps and alternatives in plain language, the clearance-number field and checklist states, NESA PENDING copy, rehearsal markers on passes and prints, axe checks of the new blocks.

## Contract status
`getMyIdentity` is CONTRACT-PENDING: S12c until backend PR #53 merges; then re-pin and run the drift gate.
