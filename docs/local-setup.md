# Run the USRP frontend on your own machine — from zero

This is the clean-slate path. No Docker, no backend checkout, no database. You
get all three PWAs running against an in-process mock edge with fixture data.

> **The mock edge covers sign-in and the core application routes only.** Newer
> areas (Campaign Studio, gate, field sync, officer administration) have no mock
> route yet, so their calls return 404 here. See
> [section 8](#8-what-this-is-and-is-not).

> **TL;DR**
>
> ```bash
> git clone https://github.com/Jackson-NSANZIMANA/e-recruitment-ui.git
> cd e-recruitment-ui
> corepack enable && corepack prepare pnpm@9.15.0 --activate
> pnpm install --frozen-lockfile
> pnpm dev:local
> ```
>
> Then open <http://localhost:3001> and sign in with
> `rdf.officer` / `Officer#2026`.

---

## 1. What you need

| Requirement | Version / detail |
| --- | --- |
| Git | any recent version |
| Node.js | **24** (pinned by `.node-version` and `engines: >=24 <25`). Node 22.6+ also runs dev, with a harmless engine warning. |
| pnpm | **9.15.0** (pinned by `packageManager`). Shipped via `corepack`, no global install needed. |
| RAM / disk | ~2 GB free for `node_modules`; a production build wants ~4 GB. |
| Free TCP ports | `3000`, `3001`, `3002`, `4021`, `4031`, plus internal mock ports `4901`, `4906`, `4911`, `4931`–`4933`. |

### Install Node 24

Pick whichever matches your machine, then verify with `node -v` → `v24.x`.

**macOS / Linux (nvm):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# close and reopen the terminal (or: source ~/.bashrc / ~/.zshrc)
nvm install 24
nvm use 24
```

**macOS (Homebrew):** `brew install node@24` (follow the caveats to put it first
on your `PATH`), or `brew install fnm && fnm install 24 && fnm use 24`.

**Windows:** install **Node 24 LTS** from <https://nodejs.org>, or with
nvm-windows: `nvm install 24` then `nvm use 24`. Open a **new** PowerShell /
Terminal window afterwards.

> Already on Node 18/20? `pnpm dev:local` will stop immediately with a clear
> message — the dev edge uses `node --experimental-strip-types`, which needs
> Node ≥ 22.6.

## 2. Get the code

```bash
git clone https://github.com/Jackson-NSANZIMANA/e-recruitment-ui.git
cd e-recruitment-ui
```

If you already have a clone, update it:

```bash
git checkout main
git pull --ff-only
```

## 3. Install dependencies

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
node -v      # v24.x
pnpm -v      # 9.15.0
pnpm install --frozen-lockfile
```

If `corepack enable` is blocked by your organisation's setup:
`npm i -g pnpm@9.15.0`.

If the install fails while Puppeteer downloads Chromium (corporate proxy,
offline, or a blocked CDN), skip that optional binary — it is only used by the
Storybook accessibility gate, never by the running app:

```bash
PUPPETEER_SKIP_DOWNLOAD=1 pnpm install --frozen-lockfile
```

The install creates `node_modules` at the root and in each workspace package.
Do not commit them; they are already gitignored.

## 4. Start everything

```bash
pnpm dev:local
```

Leave this terminal open. It starts **five** processes and prefixes every log
line with its name:

| Process | Port | Serves |
| --- | --- | --- |
| agency `edge-dev --mocks` | 4021 | officer + field API (`/edge/v1/**`) |
| citizen `edge-dev --mocks` | 4031 | citizen API (`/edge/v1/**`) |
| applicant-portal | 3000 | citizen PWA |
| officer-console | 3001 | officer console |
| field-station | 3002 | exam-day tablet |

Two edges are required: the dev harness registers either the citizen routes or
the agency routes, never both. Each Vite server proxies `/edge` to its own edge.

**Stop everything:** `Ctrl+C` in that terminal. The launcher kills all five
children. To be sure, check no process still holds ports 3000–3002.

## 5. Use it

| App | URL |
| --- | --- |
| Applicant portal | <http://localhost:3000> |
| Officer console | <http://localhost:3001> |
| Field station | <http://localhost:3002> |

**Officer login:** `rdf.officer` / `Officer#2026` (also `rnp.officer`).
**Citizen flow:** National ID `1199180000000001`, date of birth `2002-05-14`,
phone `0788 123 456`, OTP `123456`. All are fixtures in
`tooling/edge-dev/mocks/contract-mocks.ts`, not real people.

> Sessions share one cookie name, and cookies ignore ports. To use the citizen
> and officer apps side by side in one browser, give them different hostnames:
> <http://127.0.0.1:3000> for the applicant portal and <http://localhost:3001>
> for the officer console. Both spellings are in the edge's CORS/CSRF allow-list.
> Otherwise, use two browser profiles.

Health checks:

```bash
curl http://localhost:4021/edge/health    # agency edge
curl http://localhost:4031/edge/health    # citizen edge
curl http://localhost:3001/edge/health    # through the officer proxy
curl http://localhost:3000/edge/health    # through the applicant proxy
```

## 6. Clean reset (if you want to start over)

Stop the stack first, then wipe the install and rebuild it:

```bash
# macOS / Linux
pnpm clean                 # turbo clean + rm -rf node_modules
pnpm install --frozen-lockfile

# Windows PowerShell (the root script's `rm -rf` is POSIX-only)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Get-ChildItem -Path apps,packages,tooling -Filter node_modules -Recurse -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
pnpm install --frozen-lockfile
```

There is no database, cache, or `.env` to clear — the mock edges keep sessions
in memory, so restarting simply logs everyone out.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `pnpm: command not found` | `corepack enable`, then **open a new terminal**. Or `npm i -g pnpm@9.15.0`. |
| `WARN Unsupported engine` | Informational on Node 22. Use Node 24 to match CI. |
| `dev:local: dependencies are missing` | Run `pnpm install --frozen-lockfile` from the repo root. |
| `These ports are already in use: :3000 …` | The launcher checks first and tells you which. Free that port, or override it: `USRP_APPLICANT_PORT=3010 pnpm dev:local`. On PowerShell: `$env:USRP_APPLICANT_PORT="3010"; pnpm dev:local`. Same pattern for `USRP_OFFICER_PORT`, `USRP_FIELD_PORT`, `USRP_EDGE_PORT`, `USRP_CITIZEN_EDGE_PORT`. |
| Blank page, or `/src/main.tsx` returns 500 `Cannot find package '@compiled/babel-plugin'` | You launched Vite by some other route. Use `pnpm dev:local` (it sets pnpm's `NODE_PATH` explicitly) or `pnpm --filter <app> exec vite`. |
| Applicant login / OTP endpoints return 404 | Only one edge is running. `pnpm dev:local` starts both the citizen and agency edges. |
| `403 ORIGIN_NOT_ALLOWED` / CORS errors | You opened the app on a LAN IP or tunnelled host instead of `localhost`. Add it explicitly, e.g. `CORS_ORIGINS=http://192.168.1.20:3001 USRP_DEV_ALLOWED_HOST=192.168.1.20 pnpm dev:local` (with `USRP_DEV_HOST=0.0.0.0` if the browser is on another device). |
| `EADDRINUSE` on 4901/4906/4911/4931–4933 | Another process owns an internal mock port. Stop it; these are the dev harness's in-process fixtures. |
| `turbo: Unable to find package manager binary` | Affects `pnpm build` / `pnpm dev`, not `dev:local`. `corepack enable` puts `pnpm` on `PATH`. |
| Production build killed (exit 137) | Three Rollup bundles at once can OOM. Use `VITE_EDGE_URL=https://your-edge.example pnpm build --concurrency=1`. |
| Windows: `EDGE_DEV_PORT=4031 node …` fails | Those inline env assignments in the README's manual section are bash syntax. On Windows just use `pnpm dev:local`, which is cross-platform. |

## 8. What this is and is not

`tooling/edge-dev` is a **dev/proof harness**: 22 agency routes and 13 citizen
routes backed by in-memory fixtures, an in-memory session store, no TLS, no rate
limiting, no durable data. It is not the production gateway.

It has not kept up with the UI. Sign-in, sessions and the core application routes
work; campaigns, gate, field sync, officer administration and the newer applicant
routes have no mock route, so those calls return 404 in this stack.

A real end-to-end
run (campaigns, SMS, Kafka, Postgres RLS) needs the sibling backend repository
`Jackson-NSANZIMANA/e-recruitment`; see `README.md` §7 and
`docs/architecture/edge-contract.md`.

For the full command reference, environment overrides, production builds and
verification gates, see the root [`README.md`](../README.md).
