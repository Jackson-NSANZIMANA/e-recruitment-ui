/**
 * Both directions for the build-integrity predicates: each MUST fire on the defect it exists for and
 * MUST stay silent on a correct build. The failing inputs are the real shapes seen in production
 * output (the merged @font-face of @compiled/css 3.1.0, the inlined env object of a computed
 * import.meta.env access).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fontFaceFindings, inlinedEnvKeys, parseFontFaces, reachableAssets } from '../lib/build-integrity.mjs';

const SOURCE = `
@font-face { font-family: "Atlassian Sans"; src: url("./files/AtlassianSans.v3.woff2") format("woff2"); font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: "Atlassian Sans"; src: url("./files/AtlassianSansItalic.v3.woff2") format("woff2"); font-weight: 100 900; font-style: italic; font-display: swap; }
@font-face { font-family: "Atlassian Mono"; src: url("./files/AtlassianMono.v2.woff2") format("woff2"); font-weight: 100 800; font-style: normal; font-display: swap; }
@font-face { font-family: "Atlassian Mono"; src: url("./files/AtlassianMonoItalic.v2.woff2") format("woff2"); font-weight: 100 800; font-style: italic; font-display: swap; }`;
const EMITTED = [
  'assets/AtlassianSans.v3-CnihQLrr.woff2',
  'assets/AtlassianSansItalic.v3-BhxmW93h.woff2',
  'assets/AtlassianMono.v2-N13Bv0UI.woff2',
  'assets/AtlassianMonoItalic.v2-Dfr2gGlf.woff2',
];
const GOOD =
  '._1a{color:red}@font-face{font-family:Atlassian Sans;src:url(/assets/AtlassianSans.v3-CnihQLrr.woff2) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}' +
  '@font-face{font-family:Atlassian Sans;src:url(/assets/AtlassianSansItalic.v3-BhxmW93h.woff2) format("woff2");font-weight:100 900;font-style:italic;font-display:swap}' +
  '@font-face{font-family:Atlassian Mono;src:url(/assets/AtlassianMono.v2-N13Bv0UI.woff2) format("woff2");font-weight:100 800;font-style:normal;font-display:swap}' +
  '@font-face{font-family:Atlassian Mono;src:url(/assets/AtlassianMonoItalic.v2-Dfr2gGlf.woff2) format("woff2");font-weight:100 800;font-style:italic;font-display:swap}';
// Exactly what @compiled/css 3.1.0's merge-duplicate-at-rules made of the four faces.
const MERGED =
  '@font-face{font-family:Atlassian Sans;src:url(/assets/AtlassianSans.v3-CnihQLrr.woff2) format("woff2");font-weight:100 900;font-style:normal;font-display:swap;' +
  'src:url(/assets/AtlassianSansItalic.v3-BhxmW93h.woff2) format("woff2");font-style:italic;font-family:Atlassian Mono;src:url(/assets/AtlassianMono.v2-N13Bv0UI.woff2) format("woff2");' +
  'font-weight:100 800;src:url(/assets/AtlassianMonoItalic.v2-Dfr2gGlf.woff2) format("woff2")}';

describe('fontFaceFindings', () => {
  test('is silent when all four faces survive as their own rules, pointing at emitted files', () => {
    assert.deepEqual(fontFaceFindings(SOURCE, GOOD, EMITTED), []);
  });
  test('fires on the merged rule of @compiled/css 3.1.0', () => {
    const findings = fontFaceFindings(SOURCE, MERGED, EMITTED);
    assert.ok(findings.some((f) => /repeats font-family, src, font-weight, font-style/.test(f)), findings.join('\n'));
    assert.ok(findings.some((f) => /Atlassian Sans \/ normal \/ 100 900: expected exactly one built @font-face, found 0/.test(f)));
  });
  test('fires when a face is missing or duplicated', () => {
    const three = GOOD.replace(/@font-face\{font-family:Atlassian Mono;src:url\(\/assets\/AtlassianMonoItalic[^}]*\}/, '');
    assert.ok(fontFaceFindings(SOURCE, three, EMITTED).some((f) => /Mono \/ italic.*found 0/.test(f)));
    assert.ok(fontFaceFindings(SOURCE, GOOD + GOOD, EMITTED).some((f) => /found 2/.test(f)));
  });
  test('fires when the font file was not emitted or is the wrong file', () => {
    assert.ok(fontFaceFindings(SOURCE, GOOD, EMITTED.slice(1)).some((f) => /was not emitted/.test(f)));
    const swapped = GOOD.replace('AtlassianSans.v3-CnihQLrr', 'AtlassianMono.v2-N13Bv0UI');
    assert.ok(fontFaceFindings(SOURCE, swapped, EMITTED).some((f) => /is not the AtlassianSans\.v3 file/.test(f)));
  });
  test('parses semicolons inside quotes and parentheses as part of a value', () => {
    const [face] = parseFontFaces('@font-face{font-family:"A;B";src:url("x;y.woff2")}');
    assert.equal(face.family, 'A;B');
    assert.deepEqual(face.urls, ['x;y.woff2']);
    assert.deepEqual(face.repeated, []);
  });
});

describe('inlinedEnvKeys', () => {
  test('fires on the env object a computed import.meta.env access inlines', () => {
    const js = 'const e={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,VITE_EDGE_URL:"http://localhost:4930",VITE_SLOT_TRUST_ANCHOR_B64:"x"};';
    assert.deepEqual(inlinedEnvKeys(js).sort(), ['(import.meta.env object)', 'VITE_EDGE_URL', 'VITE_SLOT_TRUST_ANCHOR_B64']);
  });
  test('is silent on statically replaced values', () => {
    assert.deepEqual(inlinedEnvKeys('const edge="http://localhost:4930";const sandbox="1"==="1";'), []);
  });
});

describe('reachableAssets', () => {
  const files = {
    'assets/index-a.js': 'import("./route-b.js");const m=["assets/route-b.js","assets/route-b.css"];',
    'assets/index-a.css': '@font-face{src:url(/assets/Font-x.woff2)}',
    'assets/route-b.js': 'export const b=1;',
    'assets/route-b.css': '.b{}',
    'assets/Font-x.woff2': 'bin',
    'assets/orphan-z.js': 'const e={BASE_URL:"/",MODE:"production"};',
    'assets/orphan-z.css': '@font-face{font-family:X}',
  };
  const read = (p) => files[p] ?? null;
  const html = '<script type="module" src="/assets/index-a.js"></script><link rel="stylesheet" href="/assets/index-a.css">';
  test('follows index.html into scripts, stylesheets and the assets they reference', () => {
    assert.deepEqual(reachableAssets(html, read).sort(), ['assets/Font-x.woff2', 'assets/index-a.css', 'assets/index-a.js', 'assets/route-b.css', 'assets/route-b.js']);
  });
  test('leaves out files no reachable file references (orphans of another build)', () => {
    assert.ok(!reachableAssets(html, read).some((p) => p.includes('orphan')));
  });
});
