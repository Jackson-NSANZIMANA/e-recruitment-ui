# ADR-FE-020 — National identity layer: the Government of Rwanda's own visual grammar

**Status:** Accepted · 2026-10-26
**Owner direction (2026-10-26):** build USRP as a Government of Rwanda product. Use the official flag, the coat of arms, the Government identity and the RDF, RNP and RCS emblems. The tone is official, serious and genuine, not gamified: a person should approach it the way they approach a passport.

## Context

Before this ADR the three apps looked like an Atlassian product. Five specific problems:

- The officer console's top bar showed Atlassian's own product mark (`@atlaskit/logo` `AdminIcon`).
- `theme_color` was Atlassian blue (#0052CC).
- The PWA icons were 411-byte placeholders.
- The applicant portal had no shell at all, so no page named the state.
- No app had a language switcher, although the platform is trilingual.

Separately, `agencyTokens` mapped RCS to `color.background.success.bold`, so every RCS badge read as "approved".

The mission sets the bar. USRP exists to stop forged certificates, paid "fixers" and impersonation in recruitment for three security organs (handbook §1; vision KPIs: 0% forgery bypass, vetting from 45 days to under 5). A system that fights forgery has to look unforgeable itself, and an applicant has to be able to tell it from a scam in one glance.

## Research the decision rests on

1. **RISA, Government of Rwanda Websites Guideline** (guidelines.risa.gov.rw, Branding Elements, Typography, Layout, UI Elements). It is the binding GoR digital standard. Retrieved 2026-10-26.
   - Palette: flag Blue #00A1DE (Pantone 3005), Yellow #FAD201 (109), Green #20603D (3415) and Gold #E5BE01 (130). The interface colour is **Primary Blue #003F82**, at 10.32:1 on white (WCAG AAA).
   - Lockup: coat of arms plus "Republic of Rwanda" in Inter Bold. The gap is ⅓ of the symbol height, the text ½ of it, letter-spacing −2%, and the clear space ⅓ of the symbol height.
   - Typeface: **Inter**.
   - Patterns: Imigongo, "as subtle background textures or decorative borders … should not overpower the content".
   - Header: logo top-left, language switcher, sticky.
   - Footer: about, legal, contact, copyright.
2. **The Rwandan e-passport** (EAC, ICAO 9303, issued since 2019). It carries the national emblem and flag, Imigongo art and hidden security images.
3. **Security-printing anatomy** (ICAO 9303 and passport printers):
   - guilloche generated from secret parameters;
   - microprinting;
   - watermark;
   - serial numbers from a numbering press;
   - a machine-readable zone with 7-3-1 check digits.
4. **USWDS official-site banner.** Its research found that users judge authenticity by the .gov domain, HTTPS and the banner together. The wording must never vary, so that people learn it.
5. **Recruitment fraud.** RIB has arrested fake recruiters who charged "application" fees, and the KDF and SANDF publish warnings about paid-recruitment scams.
6. **The legal frame.** The flag is regulated by Law N° 34/2008, amended by Law N° 42/2018, which creates the offence of unlawful use of the national flag and emblems of sovereignty. Personal data is governed by Law N° 058/2021.

**Typeface finding.** Atlassian Sans, the ADS face this repo already self-hosts, is derived from Inter: its notice reads "Copyright 2016 The Inter Project Authors". So the product already meets RISA's typeface recommendation, and the AGENTS.md rule never to hardcode `font-family` stands unchanged.

## Decision

A **national identity layer**: `packages/ui/src/national` for the national pieces, `packages/design-system/src/security-print` plus `SecurityPattern` and `Microtext` for the domain-free security-print primitives. It changes how USRP identifies itself, not how it behaves.

1. **Theme.** Every app passes `NATIONAL_THEME` to `AppProvider`: the stock ADS light theme with `UNSAFE_themeOptions.brandColor` set to GoR Primary Blue. ADS derives the whole brand, link, focus and primary-button ramp from it and runs its own contrast checks. No component styles change. Positive polarity stays pinned (AGENTS.md §5).
2. **Statutory colours are the only raw colours.** They live in one file, `identity.ts`, with each line marked and justified. They are used only where a national symbol is drawn: the flag ribbon, the theme seed and the PWA manifest. Text, status and chrome stay on ADS semantic tokens. RISA's own status colours (#27AE60, #FF6161) fail AA as text on white and are deliberately not adopted.
3. **Emblems are drawn exactly as issued.** Proportional scaling only; no redrawing, recolouring or cropping. Every file is traced in `assets/PROVENANCE.md`: source, processing and SHA-256. The coat of arms is the gov.rw SVG, sanitised (no scripts, handlers, external references, `<image>`, `<use>` or `<foreignObject>`). Agency emblems are web renditions of the owner-supplied masters in `apps/assets/logo&graphics`. The emblem SVG is the one path in `gates.config.json` `hexScan.allowPaths`, listed by exact path.
4. **Three audiences, one grammar:**
   - **Citizens** (`NationalFrame audience="public"`): the official-site banner (".gov.rw · HTTPS · recruitment is free, report fixers to RIB 166"), then the national lockup and language switch, then a statutory footer naming the data-protection law and the RIB line.
   - **Staff** (officer console, field station, and their sign-in screens): the restricted handling marking in place of the banner, the lockup with the agency's emblem, and a faint watermark of marking, agency and minute over every console screen.
   - **Official documents** (`OfficialDocument`; first use, the exam pass): the passport data-page anatomy.
     - The state named in Kinyarwanda, English and French between the coat of arms and the agency emblem.
     - Microprinted rules.
     - Guilloche line-work seeded by the document serial, so every pass draws differently.
     - The coat of arms as a watermark.
     - The serial number in the code face.
     - An ICAO 9303 check-digit verification line.
5. **No gamification.** No points, badges, streaks, leaderboards or progress games. Seriousness comes from authority and consequence, not from decoration or threat.
6. **Agency accents are non-semantic** (`color.*.accent.*`): RDF green, RNP blue, RCS grey, taken from each emblem.

## What this does not claim

- **The security-print features are recognition aids, not integrity controls.** The signed QR (ADR-033) is the control. The guilloche is seeded, not secret. The check digits catch typing errors, not forgery; a change of exactly 10 in a character's value, such as `<`↔`A`, is the scheme's known blind spot.
- **The watermark does not name the officer.** The edge forbids `officerId` in browser payloads. Agency plus minute, matched against the audit trail, is what it supports. Naming the officer is an edge-contract decision.
- **The handling marking says "actions are audited", not "every view is recorded".** That is all the backend's audit writer can be shown to do today.

## Consequences and proofs

| Proof | What it holds |
|---|---|
| `packages/ui/test/national.test.ts` | Statutory colours equal the RISA values. Primary Blue clears AAA, with its computed 10.32:1 matching RISA's figure. The ribbon keeps the flag's proportions. |
| `packages/design-system/test/security-print.test.mjs` | Check digits match the ICAO 9303 specimen (L898902C3 → 6). Single-step alterations are caught. Guilloche is deterministic per seed. |
| `check-boundaries.mjs` + `usrp/no-raw-hex` | No raw colour outside `identity.ts` (per line, justified) and the one listed emblem file. |
| Storybook `National/Identity` + axe | Every national component renders accessibly (WCAG 2.1 AA tags). |
| `packages/i18n` parity test | The `national.*` strings exist in rw, en and fr. |

## Open items for the owner

1. **Written clearance** for the national emblem and for each agency's emblem, filed with `PROVENANCE.md` before production (S07).
2. **Vector masters** of the RDF, RNP and RCS emblems from each agency. Today's masters are raster.
3. **Kinyarwanda review** of the `national.*` strings by a qualified reviewer before production.
4. **Officer identity in the watermark**: needs an edge-contract change (ADR-016 and ADR-018 scope).
5. **Privacy notice and accessibility statement pages**: the footer links to them once they are published. It links to nothing that does not exist.
