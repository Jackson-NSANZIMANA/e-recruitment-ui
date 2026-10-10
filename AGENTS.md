# USRP Frontend — Agent Operating Contract

This file is read first by every coding agent that enters this repository.
It describes **how** to work here, not **what** to build.

## 1. What this is

Unified Security Recruitment Portal — frontend monorepo for RDF, RNP, RCS.
Two deployable PWAs (`apps/applicant-portal`, `apps/officer-console`), one
shared ADS-aligned design foundation, six vertical feature slices, and
one edge-contract boundary. See `docs/architecture/frontend-architecture.md`.

## 2. Immutable security invariants

Any work that violates these must stop and ask for approval:

- The browser calls one origin, `/edge/v1/**`. Never a service port, never
  `/api/*`, never a per-agency BFF URL.
- No `Authorization` header from the browser. Session cookie is `httpOnly`.
- No `nationalIdHash`, raw National ID, upstream JWT, applicant session token,
  password, OTP, client secret, or private key in browser code, bodies, URLs,
  logs, or telemetry.
- No generic status PATCH. Transitions are separate typed POSTs.
- A state-changing write is never automatically retried.
- No applicant-facing document-forensics score, lane, or flag.
- Agency comes from the server-side session, never from a browser request.
- `OFFLINE_CAPTURE_CAN_SYNC` remains `false` until the backend edge promotes
  field-sync routes and the frontend proves encrypted capture + replay +
  conflict UX.

## 3. ADS composition ladder (every UI task)

In order, prefer:

1. An ADS component (`@atlaskit/button`, `@atlaskit/dynamic-table`, ...) with its documented API.
2. The same component's supported customization props.
3. ADS primitives (`@atlaskit/primitives` — `Box`, `Inline`, `Stack`, `Text`) composed with tokens.
4. A token-backed custom component, placed in `@usrp/design-system` or `@usrp/ui` as per §4.

Never:

- Invent a lookalike of an existing ADS component.
- Reach into an ADS component's internals.
- Copy ADS CSS into local styles.

## 4. Package boundary (`features → ui → design-system → @atlaskit`)

| Package | Owns | Must not |
|---|---|---|
| `@usrp/design-system` | Domain-free ADS foundation: tokens, fonts, CSS reset entry, a11y constants, truly generic primitives (`TouchTarget`, `ErrorBoundary`, `RouterLink`) | Import any `@usrp/*` package. Name any domain concept. |
| `@usrp/ui` | USRP product UI: `AgencyLogo`, `ApplicationStatusBadge`, `DashboardMetricCard`, `WizardLayout` | Import a feature slice. |
| `@usrp/features/*` | A vertical: model, API adapter, routes, locales, UI | Import another feature slice. Import `@usrp/testing`. |
| `apps/*` | Composition of features, routing, PWA, auth boot | Contain feature logic. |

Dependency direction is enforced by `tooling/repo-hygiene/check-boundaries.mjs`.
If a lint rule disagrees with the gate, both are wrong.

## 5. Styling rules

- Styles use `@compiled/react` or `@atlaskit/css`. Not Emotion. Not Tailwind. Not CSS Modules in app/feature code.
- Never hardcode a color. Use `token(...)` from `@atlaskit/tokens`. The two PWA manifests are the sole exception.
- Never hardcode `font-family`. Use ADS typography components (`Heading`, `Text`) or `font.family.body` / `.heading` / `.code` tokens.
- Minimum interactive target: 48px (project policy, stronger than WCAG 2.5.5 AAA 44px).
- Minimum body text: 16px.
- Positive polarity only (light bg, dark text) — sunlight-readability for field tablets.

## 6. ADS lookup workflow (before writing UI)

Prefer the terminal CLI; it uses the same structured content as the MCP server:

```bash
pnpm ads search "application status" --json
pnpm ads component DynamicTable
pnpm ads token color.background.danger.bold
pnpm ads docs a11y buttons
pnpm ads lint-rules