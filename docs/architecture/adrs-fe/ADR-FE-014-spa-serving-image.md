# ADR-FE-014 — The SPA serving image

**Status:** Accepted (2026-10-19, S03). **Backend pair:** ADR-038 (release and
supply chain). **Unblocks:** S07 (deployment), S08 (field-station image is one
matrix line), S11a (`/version.json`).

## Context

The apps built to `dist/` and nothing served them. A production origin needs
more than a file server: the strict headers the platform's security posture
assumes, an SPA fallback that cannot swallow the edge, a cache policy that
does not pin users to an old service worker, and a way to tell which commit
is live.

## Owner decision (asked, answered)

**Static server: Caddy.** Registry GHCR (`ghcr.io/jackson-nsanzimana/usrp-<app>`).

## Decision

1. **One Dockerfile for every app**, `infrastructure/images/spa/Dockerfile`
   with `--build-arg APP=<app>` (a deliberate deviation from the kit's
   `apps/*/Dockerfile`: nothing in it is app-specific). It compiles the app
   from source (`pnpm install --frozen-lockfile --filter @usrp/<app>...`), so
   the image never depends on a CI artefact. Adding the field station is one
   `spa-images` matrix entry, with `permissions: camera=(self), …` and
   `camera: true`.
2. **The public origin is a build input.** `VITE_EDGE_URL` is compiled into the
   bundle (`apps/*/src/env.ts`), so an image is bound to the origin it was
   built for. CI builds with placeholders (`https://portal.usrp.gov.rw`,
   `https://officer.usrp.gov.rw`) until S07 fixes hosting. A same-origin mode
   in `env.ts` (relative `/edge`) would make one image serve every
   environment; that is S02's file, recorded here as a follow-up.
3. **Runtime:** Caddy 2.11 binary on `alpine:3.23`, both by digest,
   `apk upgrade`d; user `65532`; admin API off; no file capability on the
   binary, so it runs under `cap_drop: [ALL]`, `read_only: true`,
   `tmpfs: /tmp`; listens on 8080; `HEALTHCHECK` on `/healthz`.
   **Size budget 80 MB**; measured 69.6 MB (applicant-portal) and 70.0 MB
   (officer-console).
4. **Headers on every response** (proxied edge responses included):
   - `Content-Security-Policy`: `default-src 'self'`, `script-src 'self'`
     (no inline, no eval), `style-src 'self' 'unsafe-inline'` (the design
     system injects theme `<style>` at runtime), `connect-src 'self'
     <VITE_EDGE_URL>`, `img-src 'self' data: blob:`, `font-src 'self'`,
     `worker-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
     `form-action 'self'`, `frame-ancestors 'none'`;
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
     `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`;
   - `Permissions-Policy`: everything denied; `camera=(self)` only for the
     field station (B2);
   - no `Server` banner.
5. **Routing:**
   - `/edge` and `/edge/**`: `USRP_EDGE_MODE=proxy` reverse-proxies to
     `USRP_EDGE_UPSTREAM` (one origin per app, AGENTS.md §2; set
     `EDGE_TRUSTED_PROXY_HOPS=1` on the gateway); `off` (the default) answers
     404. **Never `index.html`.**
   - `/assets/**`: `immutable`, and a missing asset is a 404.
   - any other path with an extension: the file or a 404, never the shell.
   - everything else: the SPA shell, `no-cache`.
   - `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`,
     `version.json`: `no-cache`.
6. **Build stamp** (`infrastructure/images/spa/stamp.mjs`): `/version.json`
   `{ app, build: { sha, ref, time }, edgeOrigin }` and
   `<meta name="usrp-build-sha">` in `index.html`, values validated; source
   maps (`sourcemap: "hidden"`) are deleted, not served.
7. **Supply chain** exactly as ADR-038, in the appended `spa-images` job of
   `ci.yml` (identity `…/e-recruitment-ui/.github/workflows/ci.yml@refs/heads/main`),
   plus the serving-contract test before the scan. `release.yml` promotes the
   signed digests on a `v*` tag; `tooling/ci/release-bundle.mjs` (twin of the
   backend's, same schema) records the pinned `BACKEND_SHA` as the peer.

## Proof

- `tooling/images/verify-spa-image.mjs --image <ref> [--sha <sha>] [--camera]`
  boots the image hardened (read-only, cap-drop ALL, no-new-privileges) twice,
  edge off and edge proxied to a stub, and asserts 43 checks: non-root user,
  every header above, cache policy, deep-route fallback, `/edge*` never the
  shell, `/edgewise` still a client route, missing files 404, no source maps,
  build stamp matches the commit. Runs in CI for each app.
- The live rehearsal journey passed against both images with the edge proxied
  (backend ADR-038, `infrastructure/images/rehearse.sh`), CSP enforced, no CSP
  violation in the console.

## Building locally

```bash
docker build -f infrastructure/images/spa/Dockerfile --build-arg APP=applicant-portal \
  --build-arg VITE_EDGE_URL=http://localhost:3510 --build-arg USRP_BUILD_SHA=$(git rev-parse HEAD) \
  -t usrp-s03/applicant-portal:dev .
node tooling/images/verify-spa-image.mjs --image usrp-s03/applicant-portal:dev --sha $(git rev-parse HEAD)
```
