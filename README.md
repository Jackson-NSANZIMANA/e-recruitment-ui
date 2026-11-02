# e-recruitment-ui

Unified Security Recruitment Portal (USRP) — frontend monorepo for RDF / RNP /
RCS. This repository contains **three Vite PWAs** and a **dev-only edge
harness**. It does not contain a backend, a database, or a production gateway.

| App | Dev URL | Purpose |
| --- | --- | --- |
| `apps/applicant-portal` | http://localhost:3000 | Citizen PWA (offline-first) |
| `apps/officer-console` | http://localhost:3001 | Officer console |
| `apps/field-station` | http://localhost:3002 | Exam-day field tablet |
| `tooling/edge-dev` (agency) | http://localhost:4021 | Dev stand-in for officer `/edge/v1/**` |
| `tooling/edge-dev` (citizen) | http://localhost:4031 | Dev stand-in for citizen `/edge/v1/**` |

The browser only ever calls one origin, `/edge/v1/**`. In development each Vite
server proxies that path to its edge-dev process. Two edge processes are
**required**: `edgeRoutes()` registers either the citizen routes or the agency
routes, never both — a single agency edge answers the applicant OTP endpoints
with 404. The second edge runs its contract mocks on separate ports
(`EDGE_DEV_MOCK_*_PORT`) so both can boot together.

> **Starting from zero on your own laptop?** Follow
> [`docs/local-setup.md`](docs/local-setup.md) — it covers installing Node 24 and
> pnpm, cloning the repo, the clean reset, and Windows/macOS/Linux
> troubleshooting. This README is the command reference.

---

## 1. Prerequisites

- **Node 24** — pinned by `.node-version` and `engines` (`>=24 <25`). Node 22.22
  also runs the dev stack, but CI and the pinned toolchain use 24.
- **pnpm 9.15.0** — pinned by `packageManager` in `package.json`.
- No Docker, Postgres, Kafka, or G2G services are needed for the local stack:
  `edge-dev --mocks` serves contract fixtures in-process.

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
node --version      # v24.x
pnpm --version      # 9.15.0
```

## 2. Install

```bash
pnpm install --frozen-lockfile
```

If your network blocks the Chromium CDN used by Puppeteer (needed only by the
optional Storybook a11y gate, not by the app), skip that binary download:

```bash
PUPPETEER_SKIP_DOWNLOAD=1 pnpm install --frozen-lockfile
```

## 3. Start everything — one command

```bash
pnpm dev:local
```

This starts all **five** processes in one process group (Ctrl+C stops all of
them):

- agency `edge-dev --mocks` on **4021** → officer-console + field-station
- citizen `edge-dev --mocks` on **4031** → applicant-portal (mocks on 4931–4933)
- applicant-portal **3000**, officer-console **3001**, field-station **3002**

Open <http://localhost:3001> and sign in as an officer:

```
login handle : rdf.officer      (or rnp.officer)
password     : Officer#2026
```

Citizen flow on <http://localhost:3000>: National ID `1199180000000001`, date
of birth `2002-05-14`, phone `0788 123 456`, OTP `123456`. These are fixtures
from `tooling/edge-dev/mocks/contract-mocks.ts`, not real people.

> Both dev edges use the same cookie name. Cookies ignore ports, so on
> `localhost` the citizen and officer sessions share one jar. Use different
> hostnames — e.g. `http://127.0.0.1:3000` for the applicant portal and
> `http://localhost:3001` for the officer console — or separate browser
> profiles. Both host spellings are in the edge's CORS/CSRF allow-list.

Quick health check:

```bash
curl http://localhost:4021/edge/health          # {"status":"ok"} officer edge
curl http://localhost:4031/edge/health          # {"status":"ok"} citizen edge
curl http://localhost:3001/edge/health          # officer edge through the proxy
curl http://localhost:3000/edge/health          # citizen edge through the proxy
curl http://localhost:3000                      # HTML shell
```

### Optional overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `USRP_APPLICANT_PORT` / `USRP_OFFICER_PORT` / `USRP_FIELD_PORT` | `3000` / `3001` / `3002` | App ports, if the defaults are taken |
| `USRP_EDGE_PORT` | `4021` | Agency edge port; Vite proxy target for 3001/3002 |
| `USRP_CITIZEN_EDGE_PORT` | `4031` | Citizen edge port; Vite proxy target for 3000 |
| `USRP_DEV_HOST` | `localhost` (`0.0.0.0` in a sandbox) | Vite bind address |
| `USRP_DEV_ALLOWED_HOST` | unset (`.e2b.app` in a sandbox) | Extra Vite `allowedHosts` entry |
| `CORS_ORIGINS` | localhost/127.0.0.1 on 3000–3002 | Extra exact origins for edge CORS + CSRF pinning |
| `AGENCY`, `EDGE_SESSION_HMAC_KEY`, `EDGE_COOKIE_SECURE` | dev defaults | See `tooling/edge-dev/src/config.ts` |
| `EDGE_DEV_MOCK_*_PORT` | 4911/4901/4906 | Mock upstream ports; see `tooling/edge-dev/PORTS.md` |

For a remotely proxied preview (Codespaces, E2B, a container), bind all
interfaces and allow the preview host explicitly:

```bash
USRP_DEV_HOST=0.0.0.0 USRP_DEV_ALLOWED_HOST=.example.dev \
CORS_ORIGINS=https://3001-mybox.example.dev pnpm dev:local
```

## 4. Start it manually (five terminals)

If you prefer to see each log separately:

```bash
# Terminal 1 — agency edge with contract mocks (defaults to port 4021)
node --experimental-strip-types tooling/edge-dev/src/main.ts \
  --deployment=agency --agency=RDF --mocks

# Terminal 2 — citizen edge, own edge port AND own mock upstream ports
EDGE_DEV_PORT=4031 EDGE_DEV_MOCK_IAM_PORT=4931 \
EDGE_DEV_MOCK_IDENTITY_PORT=4932 EDGE_DEV_MOCK_APPLICATION_PORT=4933 \
node --experimental-strip-types tooling/edge-dev/src/main.ts \
  --deployment=citizen --mocks

# Terminals 3–5 — the three PWAs (from the repo root)
VITE_EDGE_URL=http://localhost:4031 pnpm --filter @usrp/applicant-portal exec vite
VITE_EDGE_URL=http://localhost:4021 pnpm --filter @usrp/officer-console  exec vite
VITE_EDGE_URL=http://localhost:4021 pnpm --filter @usrp/field-station    exec vite
```

`VITE_EDGE_URL` selects the **proxy target**, not a browser URL: `src/env.ts`
uses a same-origin empty base path in development, so no `.env` file is needed.
Add `--host 0.0.0.0` to each `vite` command when the browser is not on the same
machine. Note that `pnpm --filter ... exec vite` (or `pnpm run`) matters here —
pnpm's `.bin/vite` wrapper sets the `NODE_PATH` that `@compiled/babel-plugin`
needs; `dev:local` sets it explicitly instead.

> **Do not use root `pnpm dev` as your all-in-one command.** It runs
> `turbo run dev --parallel`, which also starts `@usrp/edge-dev dev` in **real
> services** mode (ports 4011/4001/4006). Without the sibling backend checkout,
> the UIs load but login and all data calls fail. `pnpm dev:local` is the
> standalone stack.

## 5. Production-shaped build and preview

A production build **refuses** without `VITE_EDGE_URL` — `vite.config.ts` checks
it so a blank page never ships silently:

```bash
VITE_EDGE_URL=https://portal.usrp.gov.rw pnpm build
pnpm --filter @usrp/officer-console preview     # serves dist/ on port 3001
```

On a memory-constrained machine (three Vite/Rollup bundles at once can be
OOM-killed), serialise the build: `pnpm build --concurrency=1`.

In production all three PWAs share ONE browser-facing edge origin (copy
`apps/<app>/.env.example` to `.env` or inject the value in CI). In a production
bundle `EDGE_BASE_URL` becomes that absolute origin, so the real edge — not
this dev harness — must allow the PWA origins for credentialed CORS. Never set
it to a microservice port. The browser must not send an `Authorization` header;
the session is an `httpOnly` cookie.

For a complete local run, use `pnpm dev:local` (dev mode) rather than
`preview`: the dev harness is split into two deployments, while a production
edge is a single origin.

## 6. Verification and other commands

```bash
pnpm verify              # rules + hygiene + surfaces + typecheck + lint + unit tests
pnpm verify:full         # adds build, extraction, size, a11y, security
pnpm test:e2e            # Playwright (needs browsers installed)
pnpm storybook           # design-system component workshop (port 6006)
pnpm --filter @usrp/edge-dev selfcheck   # edge proof over real sockets
```

## 7. Honest scope

- `tooling/edge-dev` is a **dev/proof harness**, not the production gateway. It
  implements 22 agency routes and 13 citizen routes with fixtures, an in-memory
  session store, and no rate limiting or TLS. See `tooling/edge-dev/README.md`
  and `docs/architecture/edge-contract.md`.
- The mock edges cover sign-in, sessions and the core application routes only.
  Campaigns, gate, field sync, officer administration and the newer applicant
  routes have no mock route, so those calls return 404 under `pnpm dev:local`.
- A real end-to-end run (real campaigns, SMS OTP, Kafka events, Postgres RLS)
  needs the backend repository `Jackson-NSANZIMANA/e-recruitment` running its
  infra tiers and services, plus `pnpm rehearse` / `pnpm dev:sms` for dev data.
  Then run edge-dev without `--mocks` with the backend `.env` sourced, or point
  the SPA at the real edge gateway via `VITE_EDGE_URL`.
- Architecture, ADRs, and the authoritative port map live in
  `docs/architecture/` and `tooling/edge-dev/PORTS.md`.
