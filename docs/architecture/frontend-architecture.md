# Frontend Architecture — USRP UI

**Status:** Scaffolded 2026-08-06  
**Author:** Principal Software Engineer / SME  
**Repo:** `usrp-ui/` (sibling to `usrp/` backend monorepo)

---

## 1. Overview

`usrp-ui` is a **Turborepo + pnpm** monorepo delivering two React SPAs:

| App | Audience | Port | PWA |
|-----|----------|------|-----|
| `apps/applicant-portal` | Rwandan citizens applying for RDF/RNP/RCS roles | 3000 | ✅ offline-first |
| `apps/officer-console` | Recruitment officers (per-agency) | 3001 | ❌ (always-connected internal tool) |

Six shared packages live under `packages/`:

```
packages/
  shared-types/   — domain types mirroring backend schema (no runtime deps)
  auth/           — AuthProvider, useAuth, RouteGuard, AgencyGuard
  i18n/           — Kinyarwanda / English / French (react-i18next)
  api-client/     — typed fetch wrapper + TanStack Query hooks for the BFFs
  ui/             — USRP component library built on @atlaskit
  eslint-config/  — shared ADS + ui-styling-standard rules
```

---

## 2. Stack decisions

### 2.1 Framework — React 18 SPA (Vite), not SSR

Both apps are SPAs rather than Next.js/Remix server-rendered apps.

**Reasons:**
- The officer console is fully auth-gated — no public pages, no SEO requirement. SSR adds zero value.
- The applicant portal's offline-first mandate (HCI research requirement) is best served by a **Progressive Web App** with a Service Worker. SSR requires a running server to render; a PWA with a Vite-built app shell caches everything to the device and works with zero connectivity. A Next.js app cannot render pages offline because it needs a Node.js server.
- The BFF layer (`agency-bff/`) already handles auth, routing, and data aggregation — there is no server-rendering problem to solve at the UI layer.

### 2.2 Build — Vite 5 + @compiled/react

`@compiled/react` is Atlassian's build-time CSS-in-JS engine — it processes `css()` and `xcss()` calls at compile time via `@compiled/babel-plugin`, producing static CSS with no runtime overhead. This is the canonical way to style ADS-based UIs.

- All styling goes through ADS tokens (`token("color.background.neutral")`, etc.) — never raw hex values.
- The ESLint plugin `@atlaskit/eslint-plugin-design-system` enforces this at lint time.

### 2.3 Routing — React Router DOM 6

React Router DOM was chosen over TanStack Router v1 because:
- It is more widely understood and has a stable API.
- The route structure for both apps is simple enough that TanStack Router's type-safety advantages would not meaningfully reduce bugs here.
- Lazy-loading with `React.lazy()` + `Suspense` keeps initial bundle size small.

### 2.4 Server state — TanStack Query v5

All BFF communication goes through `@tanstack/react-query`. Benefits:
- Automatic background refresh when the officer returns to a tab.
- Stale-while-revalidate keeps UI responsive.
- `queryClient.setQueryData()` allows optimistic updates after mutations.
- Query key factories in `@usrp/api-client` give a single source of truth for cache invalidation.

### 2.5 Client state — Zustand (not used yet, reserved)

Zustand is listed as a dependency but not yet instantiated. It is reserved for UI state that genuinely does not belong in the server cache (e.g., the officer's sidebar collapsed/expanded state, in-flight walk-in form transient values).

### 2.6 Forms — React Hook Form 7

Multi-step wizard forms (applicant portal) and action forms (officer transitions, walk-in) use React Hook Form. Validation rules are Zod schemas shared from `@usrp/shared-types`.

### 2.7 i18n — Kinyarwanda / English / French

Locale bundles are **statically imported** (not fetched at runtime) so they are available inside the Service Worker offline cache without a network round-trip. Language preference is stored in `localStorage` under the key `usrp_lang`.

### 2.8 PWA — Workbox via vite-plugin-pwa

The applicant portal implements the "Local-First" pattern from the HCI research:
- The entire app shell (HTML, JS, CSS) is pre-cached via `generateSW`.
- API calls use `NetworkFirst` strategy — fresh data when connected, cached data when offline.
- Audio guidance files use `CacheFirst` — never expire on device.
- Form drafts persist in `localStorage` with `saveDraft()` — if the applicant closes the tab mid-wizard, the draft is restored on next visit.

---

## 3. Backend communication

### 3.1 BFF topology

The USRP backend exposes four BFF services:

| BFF | Consumer |
|-----|----------|
| `rdf-bff` | RDF officers + applicants applying to RDF |
| `rnp-bff` | RNP officers + applicants applying to RNP |
| `rcs-bff` | RCS officers + applicants applying to RCS |
| `superadmin-bff` | USRP system administrators |

The frontend never talks to individual microservices (identity-service, application-service, etc.) directly. All calls go through the agency BFF.

### 3.2 Auth — httpOnly cookie

The JWT is stored in an `httpOnly`, `SameSite=Strict` cookie set by the BFF on `/auth/login`. The browser never exposes the raw JWT to JavaScript. `fetch(..., { credentials: "include" })` sends the cookie automatically.

The `AuthProvider` (in `@usrp/auth`) calls `/auth/me` on mount to read the decoded user from the BFF, which validates the JWT server-side and returns `AuthUser`. This is the only source of truth for auth state in the frontend.

### 3.3 API client

`createApiClient(options)` in `@usrp/api-client` returns `{ get, post, patch, del }` helpers that:
- Always send `credentials: "include"`
- Set `Content-Type: application/json` for bodies
- Throw `ApiError` on 4xx/5xx with typed `{ code, message }` from the BFF
- Throw `NetworkError` on connectivity failure

TanStack Query hooks in `packages/api-client/src/queries/` wrap these helpers.

### 3.4 Development proxy

Vite's `server.proxy` config forwards `/api/**` to the local BFF port, so the dev server and BFF run on separate ports without CORS issues. The proxy is development-only; production uses the same-origin deployment behind a gateway.

---

## 4. Design system usage rules

These rules mirror Atlassian's own enforcement rules and are non-negotiable:

1. **Never use raw CSS colour, spacing, or border-radius values.** Always use `token()` from `@atlaskit/tokens`.
2. **Never style raw HTML elements.** Use ADS Primitives (`Box`, `Stack`, `Inline`, `Text`) as the lowest-level building block.
3. **Component hierarchy:**
   - Level 0: `@atlaskit/primitives` — layout atoms
   - Level 1: `@atlaskit/*` components — interactive elements
   - Level 2: `@usrp/ui` — USRP-specific composites
   - Level 3: app-level route components — page layouts
4. **Agency identity** is expressed via `agencyTokens` in `@usrp/ui/tokens` — each agency maps to an ADS semantic colour role (brand / discovery / success), not a hard-coded hex.
5. **Application status labels** use `statusLozenge` — each state maps to an ADS Lozenge `appearance`. Never pick a Lozenge colour by hand.

---

## 5. HCI requirements — how they map to code

| Research finding | Implementation |
|-----------------|----------------|
| Positive polarity (14:1 contrast for sunlight readability) | `meta[name=color-scheme]=light` in both HTML files; ADS light theme enforced |
| 48×48 px minimum touch targets | ADS `Button` defaults satisfy this; custom buttons use `minWidth/minHeight: 48px` via tokens |
| Anticipatory feedback (NIDA pre-submit validation) | `useNidaVerification` mutation fires on NID field blur; green ✓ shown immediately |
| Procedural Justice (explain why decisions were made) | `ApplicationDetailPage` shows full event history with actor, timestamp, and note |
| One-Thing-Per-Page wizard | `WizardLayout` + step components in `apply/index.tsx` |
| Audio tooltips (Kinyarwanda voice guidance) | `AudioTooltip` component with haptic confirmation |
| Haptic feedback for field officers | `navigator.vibrate()` called on walk-in success and QR-scan confirmation |
| Exception-based dashboard (only show anomalies) | `DashboardMetricCard` with `urgent` prop; `requiresAction` metric in Primary Optical Area |
| F-pattern: critical KPIs top-left | `requiresAction` card rendered first in the `Inline` grid |
| Offline resilience | Service Worker (Workbox NetworkFirst), `localStorage` draft persistence |
| Tiered notifications (Info/Warning/Critical) | ADS `SectionMessage` appearances: `information / warning / error` |
| Kinyarwanda / English / French | `@usrp/i18n` with static locale bundles |
| NIDA single-source-of-truth | Home page asks only for NID, calls `/identity/verify-nida`, pre-fills name |

---

## 6. Security invariants carried into the frontend

These mirror the backend invariants from `role-charter.md`:

1. **JWT in httpOnly cookie** — never in `localStorage` or `sessionStorage` — prevents XSS token theft.
2. **Agency claim is server-authoritative** — `AgencyGuard` is presentational only; data access is enforced by RLS at the DB engine.
3. **No raw NID ever displayed** — the frontend shows only the name returned by NIDA after verification; the NID input field clears after submission.
4. **Consent receipt before biometric capture** — the `BiometricConsent` component (to be wired into the wizard) must be shown before `getUserMedia` is called, per Law N° 058/2021.
5. **All API calls through `api-client`** — no raw `fetch()` calls in route components; all pass through the centralized client that handles auth and error normalization.

---

## 7. Getting started

```bash
cd usrp-ui

# Install all workspace dependencies
pnpm install

# Run both apps in development
pnpm dev

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Build all apps for production
pnpm build
```

Environment variables (per app, in `.env.local`):

```
# apps/officer-console/.env.local
VITE_BFF_URL=http://localhost:4001/api/v1

# apps/applicant-portal/.env.local
VITE_BFF_URL=http://localhost:4000/api/v1
```

---

## 8. What comes next

1. Wire up the **BFF login endpoints** — the backend's `rdf-bff/src/controllers` likely need `/auth/login` and `/auth/me` handlers confirmed.
2. Implement remaining wizard steps: **education credentials**, **academic certificate upload** (document upload with drag-and-drop using `@atlaskit/media-picker`).
3. Add **QR Scanner** component to the officer walk-in flow for field-tablet use.
4. Implement **BiometricConsent** + passive liveness capture (selfie → NIDA verification).
5. Add **Playwright E2E tests** covering the critical paths: officer login → dashboard → walk-in; applicant NID verify → wizard submit.
6. Set up **CI** (`apps/` equivalent of `ci-frontend.yml`) mirroring the backend's CI gating pattern.
