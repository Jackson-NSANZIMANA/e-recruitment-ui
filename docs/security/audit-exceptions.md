# pnpm audit exceptions

An advisory may be ignored only when **no patched version exists** and the package
is not reachable from shipped code. Each entry is listed in `package.json` under
`pnpm.auditConfig.ignoreGhsas` **and** here. `tooling/security/security-scan.sh`
fails when either side is missing, or when a review date has passed. An expired
exception is a failure, not a warning: re-check upstream, then fix, re-justify
with a new date, or escalate.

| GHSA | Package | Reached via | Shipped to users? | Why it is ignored | Review by |
|---|---|---|---|---|---|
| GHSA-jmr9-qjv8-65gv | extract-zip 2.0.1 | `@atlaskit/ads-cli` → `@atlaskit/ads-mcp` → `puppeteer@13.7.0` (pinned exactly by ads-mcp, latest 1.11.1 included) | No. Developer-only ADS lookup tooling. | No patched release of extract-zip exists. Only exercised when puppeteer downloads its browser at install. | 2027-01-15 |
| GHSA-7pqw-9j4j-h8q3 | extract-zip 2.0.1 | same as above | No | same as above | 2027-01-15 |
| GHSA-vfj7-8cjw-p6xm | braces 3.0.3 | `@atlaskit/eslint-plugin-ui-styling-standard` → `@typescript-eslint/typescript-estree@7` → `globby` → `micromatch` | No. Lint-time only. | No patched release of braces exists. The input is the repo's own glob patterns, not untrusted data. | 2027-01-15 |

Recorded 2026-10-15 during Wave 0 (frontend revamp plan, W0-04). The same change
removed 4 critical and 7 high advisories by upgrading vitest 2→4, vite 5→6,
vite-plugin-pwa 0.20→1.2 and workbox 7.3→7.4, deduplicating `@atlaskit/ads-mcp`,
and adding the scoped overrides `puppeteer>tar-fs` and `puppeteer>ws`.
