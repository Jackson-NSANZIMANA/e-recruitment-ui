# Atlassian Design System — upstream references

**This file points at upstream. It deliberately does not mirror it.**

USRP builds on Atlassian Design System (ADS) with `@compiled` build-time
extraction. The repository root previously carried a verbatim copy of Atlassian's
own `llms.txt` as its top-level `llms.txt`, which caused two problems:

1. It occupied the file an agent or a new engineer reads **first** to learn what
   this repository is, and said nothing about USRP.
2. Its relative links (`llms-tokens.txt`, `llms-primitives.txt`,
   `llms-components.txt`, `llms-styling.txt`, `llms-a11y.txt`) resolved against
   this repository, where none of them exist.

A vendored copy of somebody else's living documentation is stale the day it
lands, and it drifts silently because nothing here can gate it. This repository
has already paid that bill once, in the worst possible currency: a **70.45 MiB
vendored ADS mirror** tracked in git, which is why `.gitignore` names archive
extensions explicitly and `check-large-files.mjs` exists as the lock behind that
fence.

So: canonical URLs only.

## Canonical documentation

- Design system: https://atlassian.design
- Component library: https://atlaskit.atlassian.com
- Components: https://atlassian.design/components
- Design tokens: https://atlassian.design/foundations/design-tokens
- Accessibility: https://atlassian.design/foundations/accessibility

## Machine-readable sets (fetch, do not vendor)

- https://atlassian.design/llms.txt
- https://atlassian.design/llms-full.txt
- https://atlassian.design/llms-tokens.txt
- https://atlassian.design/llms-primitives.txt
- https://atlassian.design/llms-components.txt
- https://atlassian.design/llms-styling.txt
- https://atlassian.design/llms-a11y.txt
- https://atlassian.design/llms-content.txt

## ADS MCP server

Tokens, icons, components, primitives and accessibility tooling.

- Remote (HTTP): `https://mcp.atlassian.com/v1/ads/public/mcp`
- Local (stdio): `npx -y @atlaskit/ads-mcp`

`@atlaskit/ads-mcp` is pinned at the repository root as a devDependency.

## What USRP uses, and the local rules that constrain it

| Concern | Package | USRP constraint |
|---|---|---|
| Tokens | `@atlaskit/tokens` | The ONLY source of colour. Zero raw hex; `hexScan` enforces it across `apps/` and `packages/`. |
| Primitives | `@atlaskit/primitives/compiled` | Compiled entrypoint, not the deprecated legacy one. |
| Styling | `@atlaskit/css` + `@compiled/react` | `cssMap` at module scope; the runtime must not appear in a shipped asset (`verify:extraction`). |
| Navigation | `@atlaskit/navigation-system` | Current package, not the deprecated `atlassian-navigation`. |
| Lint | `@atlaskit/eslint-plugin-design-system`, `@atlaskit/eslint-plugin-ui-styling-standard` | Both recommended configs. |

### Where USRP is deliberately stricter than ADS

- **48px minimum interactive target**, not the WCAG 2.1 AA 44px. Outdoor,
  one-handed, sunlight-glare use by applicants queueing, and officers on field
  tablets with gloves. See `packages/design-system/src/a11y/index.ts`.
- **Positive polarity only.** No dark theme ships. Cheap LCD panels at partial
  brightness in direct sun lose dark-mode contrast almost entirely. A dark theme
  request needs a field-readability study attached, not a preference.
- **No domain vocabulary in the design-system layer.** `Agency`,
  `ApplicationStatus`, `nationalId` and the three agency acronyms are forbidden
  identifiers there, enforced by `check-boundaries.mjs`.

### One upstream note worth keeping

Atlassian's internal `@atlaskit/design-system` barrel package and its
`useSimpleForm` hook are **internal abstractions and are not published**.
Publicly, ADS ships atomic packages (`@atlaskit/form`, `@atlaskit/textfield`).
Do not import the barrel or that hook; a generated snippet may suggest either.
