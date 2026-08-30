# `packages/ui` split — migration map

**Author:** Agent 3 (foundation & hygiene) · **Executor: Agent 4**
**Status:** map only. Nothing has been moved out of `packages/ui`.

`packages/ui` is **not in Agent 3's owned paths**, so this document assigns
destinations and does not touch the source. `packages/design-system` has been
created and contains the domain-free layer; removing the moved components from
`packages/ui` is Agent 4's edit, in Agent 4's paths.

---

## The rule that decides every row below

> A component belongs in `@usrp/design-system` if and only if it would still make
> sense in a completely different product.

`ErrorBoundary` would. `BiometricConsent` would not — it encodes a legal consent
flow for a Rwandan security-service recruitment process. That is not a criticism
of the component; it is a statement about where it lives.

Enforced mechanically, not by review: `usrp/no-domain-imports` and
`usrp/no-domain-vocabulary` (ERROR, `packages/eslint-config/rules/index.cjs`)
plus `tooling/repo-hygiene/check-boundaries.mjs` in CI. Both read the same
predicates, so the editor and CI cannot disagree.

---

## 1. Moved to `@usrp/design-system` — done

| Component | Why it qualifies |
|---|---|
| `ErrorBoundary` | React + one ADS `SectionMessage`. Zero domain knowledge. **Changed in the move:** `title` / `fallbackMessage` / `onError` are now props, and `console.error` was removed in favour of the `onError` callback — a library must not decide the host's logging policy, and a boundary that logs raw error text is a PII hazard (see the security note in its source). |
| `RouterLink` | Adapter between `react-router-dom` and the ADS `RouterLinkComponent` contract. Pure plumbing. **Changed in the move:** external-URL detection tightened from `href.startsWith("http")` (which also matches `httpfoo`) to `/^https?:\/\//i`, and external anchors now carry `rel="noreferrer noopener"`. |
| `TouchTarget` **(new)** | Guarantees a 48×48 CSS-px hit area around a smaller visual control. Created here because the 48px floor needs somewhere to live that every feature slice can import. |
| token seam + `createSemanticRoleMap` | `token` re-export plus generic, domain-blind machinery for declaring semantic colour maps. **Throws** if handed a literal colour. |
| `src/a11y/*` **(new)** | The HCI constraints as importable constants: `MIN_TOUCH_TARGET_PX`, `MIN_BODY_TEXT_PX`, contrast floors, `COLOR_MODE`. |

---

## 2. Stays domain — assigned to feature slices

Nine components. Suggested slices; Agent 4 owns the final structure.

| Component | Destination | Reasoning |
|---|---|---|
| `AgencyLogo` | `packages/features/branding` | Hardcodes `RDF` / `RNP` / `RCS` and their full agency names. Note it renders `SIZE_PX = { sm: 24, md: 40, lg: 64 }`; **`sm` and `md` are below the 48px floor.** Fine while purely decorative, a violation the moment it becomes a button — wrap it in `TouchTarget`. |
| `ApplicationStatusBadge` | `packages/features/applications` | Consumes `ApplicationStatus`, the 17-state lifecycle. Definitionally domain. |
| `DashboardMetricCard` | `packages/features/dashboard` | Exists to serve the exception-based officer dashboard. Its meaning is the metric. |
| `WizardLayout` | `packages/features/application-form` | Multi-step application submission flow. Tempting to call generic — it is not: step semantics, validation gating and resumability are application-specific. A genuinely generic stepper would be a thin wrapper over ADS `ProgressTracker` and is not what this is. |
| `DocumentUpload` | `packages/features/documents` | Upload of specific evidence types, tied to backend document handling and the forensics/ClamAV path. |
| `BiometricConsent` | `packages/features/biometrics` | Legal consent capture before biometric verification. Domain, and legally sensitive. Its copy is likely regulated text — it needs a named owner, not just a location. |
| `QrScanner` | `packages/features/scheduling` | Reads USRP invitation keys (`GET /v1/slots/invitation-key`). The scanning mechanism is generic; **what it expects to find is not.** If a generic scanner is ever wanted, split it: a domain-free `QrScanner` that emits a raw string, and a domain `InvitationKeyScanner` that interprets it. Do that only when a second caller exists. |
| `AudioTooltip` | `packages/features/accessibility` | Plays Kinyarwanda audio guidance — an HCI mandate for low-literacy users, and the strongest candidate for eventual promotion. **Blocked today** because it resolves its own audio paths and copy through `@usrp/i18n`. Promote it once the audio source is a prop. |
| `OfflineIndicator` | `packages/features/offline` | **The closest call in the list.** Its `SyncStatus` type is local and it names no domain concept — it fails the boundary on `@usrp/i18n` alone. Recommendation: promote a domain-free `SyncRibbon` to `@usrp/design-system` taking `status` plus `label: string`, and keep a thin `OfflineIndicator` in the feature slice that supplies the translated label. Worth doing: every screen in both apps needs it. |

---

## 3. Also needs a home: the agency and status token maps

`packages/ui/src/tokens/usrp-tokens.ts` currently exports `agencyTokens` and
`statusLozenge`. **Both are domain** — one is keyed by agency, the other imports
`ApplicationStatus` — so neither can live in `@usrp/design-system`.

**The design decision they encode is preserved exactly and is not being
revisited.** Agency identity is expressed as **ADS semantic colour roles**
(`color.background.brand.bold` / `discovery.bold` / `success.bold`), never as a
hand-picked hex, so light, dark and high-contrast themes keep working for free.
What changes is only *where the table lives*.

Move both to `packages/features/branding/src/tokens.ts` and build them with
`createSemanticRoleMap` from `@usrp/design-system/tokens`, which **throws** if
handed a literal colour or `rgb()`/`hsl()` value:

```ts
import { createSemanticRoleMap } from '@usrp/design-system/tokens';
import type { Agency } from '@usrp/shared-types';

export const agencyTokens = createSemanticRoleMap({
  RDF: { background: 'color.background.brand.bold',     text: 'color.text.inverse', borderColor: 'color.border.brand' },
  RNP: { background: 'color.background.discovery.bold', text: 'color.text.inverse', borderColor: 'color.border.discovery' },
  RCS: { background: 'color.background.success.bold',   text: 'color.text.inverse', borderColor: 'color.border.success' },
}) satisfies Record<Agency, unknown>;
```

**One observation to pass upward, not a change I am making.** Mapping RCS to
`color.background.success.bold` means the RCS brand and every success state in
the product render the same green, and mapping RNP to `discovery.bold` puts the
police brand on the same token as "new/discovery" affordances. That is a real
collision: an officer glancing at a status badge on an RCS-branded screen gets
less colour separation than one on an RDF screen. It is a design decision for the
owner, not a lint failure — but it should be a decision, not an accident.

---

## 4. Sequence for Agent 4

1. Switch `apps/*` imports of `ErrorBoundary` / `RouterLink` from `@usrp/ui` to
   `@usrp/design-system`, and add `@usrp/design-system` to both apps' deps.
2. Delete those two from `packages/ui` and drop them from its barrel.
3. Create the feature slices and move the nine domain components, one commit per
   component so a regression bisects cleanly.
4. Move `agencyTokens` / `statusLozenge` to the branding slice.
5. Add `test` to `packages/ui` (or delete the package once empty) and remove its
   entry from `gates.config.json` → `scriptCoverage.exempt`. The anti-hollow gate
   will report the stale exemption for you.
6. Optional, recommended: promote `SyncRibbon` per §2.

**Do not** add `@usrp/design-system` as a dependency of `@usrp/ui` to smooth the
transition. That inverts the layering, and the boundary lint will not save you
from it because the violation would live in `packages/ui`, where the rule does
not apply. Apps depend on both, directly, until `packages/ui` is gone.
