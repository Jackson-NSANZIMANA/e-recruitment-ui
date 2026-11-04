/**
 * Unit tests for the shared gate predicates.
 *
 * Run: node --test tooling/repo-hygiene/test/*.test.mjs
 * Zero dependencies - node:test is built in, which means this suite runs on a
 * clean checkout with no `pnpm install`, and therefore cannot be defeated by a
 * dependency problem in CI.
 *
 * Every rule the repo enforces gets both directions asserted here: it MUST fire
 * on a violation and it MUST stay silent on correct code. A gate only tested in
 * the failing direction is how you ship a rule that flags everything; a gate
 * only tested in the passing direction is how you ship a rule that flags
 * nothing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isForbiddenDomainImport,
  findForbiddenImports,
  findDomainIdentifiers,
  findRawHexColors,
  findUndersizedTouchTargets,
  isAcceptableTouchTarget,
  stripComments,
  findUndersizedBodyText,
  bodyTextSizeOf,
  isBodyTextExemptPath,
  TEXT_SIZE_PX,
  BODY_TEXT_SCAN,
  MIN_TOUCH_TARGET_PX,
  MIN_BODY_TEXT_PX,
} from '../lib/predicates.mjs';

describe('MIN_TOUCH_TARGET_PX', () => {
  test('is 48, above the WCAG 2.1 AA minimum of 44', () => {
    assert.equal(MIN_TOUCH_TARGET_PX, 48);
    assert.ok(MIN_TOUCH_TARGET_PX > 44);
  });
});

describe('isForbiddenDomainImport', () => {
  test('rejects every domain scope and its subpaths', () => {
    assert.ok(isForbiddenDomainImport('@usrp/shared-types'));
    assert.ok(isForbiddenDomainImport('@usrp/contracts/agency'));
    assert.ok(isForbiddenDomainImport('@usrp/api-client'));
    assert.ok(isForbiddenDomainImport('@usrp/auth'));
    assert.ok(isForbiddenDomainImport('@usrp/i18n'));
    assert.ok(isForbiddenDomainImport('@usrp/ui/tokens'));
  });

  test('allows ADS, React and relative imports', () => {
    assert.ok(!isForbiddenDomainImport('@atlaskit/primitives/compiled'));
    assert.ok(!isForbiddenDomainImport('@atlaskit/tokens'));
    assert.ok(!isForbiddenDomainImport('react'));
    assert.ok(!isForbiddenDomainImport('./index.js'));
    assert.ok(!isForbiddenDomainImport('@compiled/react'));
  });

  test('does not match a scope by prefix accident', () => {
    // @usrp/ui is forbidden; @usrp/uikit-experimental is a different package.
    assert.ok(!isForbiddenDomainImport('@usrp/uikit-experimental'));
  });

  test('survives junk input', () => {
    assert.ok(!isForbiddenDomainImport(''));
    assert.ok(!isForbiddenDomainImport(undefined));
    assert.ok(!isForbiddenDomainImport(null));
  });
});

describe('findForbiddenImports', () => {
  test('catches static, re-export, dynamic and require forms', () => {
    const src = [
      "import type { Agency } from '@usrp/shared-types';",
      "export { x } from '@usrp/ui';",
      "const m = await import('@usrp/auth');",
      "const r = require('@usrp/api-client');",
    ].join('\n');
    const hits = findForbiddenImports(src);
    assert.equal(hits.length, 4);
    assert.deepEqual(
      hits.map((h) => h.line),
      [1, 2, 3, 4],
    );
  });

  test('ignores a forbidden name inside a comment', () => {
    assert.equal(findForbiddenImports("// import x from '@usrp/auth';").length, 0);
  });

  test('stays silent on a clean file', () => {
    const src = "import { token } from '@atlaskit/tokens';\nimport React from 'react';";
    assert.equal(findForbiddenImports(src).length, 0);
  });
});

describe('findDomainIdentifiers', () => {
  test('flags domain vocabulary in code', () => {
    const hits = findDomainIdentifiers('const a: Agency = "RDF"; let s = statusLozenge;');
    const names = hits.map((h) => h.identifier);
    assert.ok(names.includes('Agency'));
    assert.ok(names.includes('RDF'));
    assert.ok(names.includes('statusLozenge'));
  });

  test('flags PII vocabulary specifically (brief invariant 2)', () => {
    assert.ok(
      findDomainIdentifiers('props.nationalIdHash').some((h) => h.identifier === 'nationalIdHash'),
    );
    assert.ok(findDomainIdentifiers('const nationalId = x;').some((h) => h.identifier === 'nationalId'));
  });

  test('ignores prose in comments, so documenting a rule is not a violation', () => {
    const doc = [
      '/**',
      ' * The agencyTokens map for RDF / RNP / RCS moved to a feature slice.',
      ' * ApplicationStatus and nationalIdHash never belonged here either.',
      ' */',
      'export const x = 1;',
    ].join('\n');
    assert.equal(findDomainIdentifiers(doc).length, 0);
  });

  test('does not match a domain word embedded in a longer identifier', () => {
    assert.equal(
      findDomainIdentifiers('const AgencyLike = 1; const myRDFX = 2;').filter(
        (h) => h.identifier === 'AgencyLike',
      ).length,
      0,
    );
  });

  test('honours an explicit, greppable exemption', () => {
    assert.equal(findDomainIdentifiers('const a = "RDF"; // hygiene-allow-domain: fixture').length, 0);
  });
});

describe('findRawHexColors', () => {
  test('flags 3, 4, 6 and 8 digit hex', () => {
    assert.equal(findRawHexColors('a #fff').length, 1);
    assert.equal(findRawHexColors('a #ffff').length, 1);
    assert.equal(findRawHexColors('a #0052CC').length, 1);
    assert.equal(findRawHexColors('a #0052CCFF').length, 1);
  });

  test('does NOT flag a URL fragment that happens to look hex', () => {
    assert.equal(findRawHexColors("const u = 'https://x.gov.rw/docs#a1b2c3';").length, 0);
  });

  test('does not flag an ADS token name', () => {
    assert.equal(findRawHexColors("token('color.background.brand.bold')").length, 0);
  });

  test('reports an accurate line number', () => {
    const hits = findRawHexColors('line1\nline2\nconst c = "#ff0000";');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 3);
  });

  test('honours an explicit exemption on the line above', () => {
    const src =
      '// hygiene-allow-hex: PWA manifest theme_color is read by the OS before any CSS exists\ntheme_color: "#0052CC",';
    assert.equal(findRawHexColors(src).length, 0);
  });

  // Regression: packages/contracts/scripts/lint/selftest.ts carried a correct,
  // greppable two-line exemption and the gate went RED anyway, because only one
  // line above was read. The gate's own message asks for a justification; a
  // justification that spans two lines must still exempt.
  test('honours an exemption anywhere in the comment block directly above', () => {
    const src = [
      '// hygiene-allow-hex: intentional dirty fixture. This literal is data fed',
      '// to the rule to prove it goes RED; it is never shipped or generated.',
      'const c = "#ff5630";',
    ].join('\n');
    assert.equal(findRawHexColors(src).length, 0);
  });

  test('honours an exemption inside a block comment above', () => {
    const src = '/*\n * hygiene-allow-hex: fixture data, never shipped.\n */\nconst c = "#0052CC";';
    assert.equal(findRawHexColors(src).length, 0);
  });

  test('still honours a trailing exemption on the code line directly above', () => {
    const src = 'const a = 1; // hygiene-allow-hex: fixture\nconst c = "#0052CC";';
    assert.equal(findRawHexColors(src).length, 0);
  });

  test('a blank line ends the comment block, so the exemption does not reach', () => {
    const src = '// hygiene-allow-hex: unrelated\n\nconst c = "#0052CC";';
    assert.equal(findRawHexColors(src).length, 1);
  });

  test('a line of code ends the comment block, so the exemption does not reach', () => {
    const src = '// hygiene-allow-hex: unrelated\n// more prose\nconst x = 1;\nconst c = "#0052CC";';
    assert.equal(findRawHexColors(src).length, 1);
  });

  test('a comment block with no marker exempts nothing', () => {
    const src = '// just explaining something\n// over two lines\nconst c = "#0052CC";';
    assert.equal(findRawHexColors(src).length, 1);
  });
});

describe('findUndersizedTouchTargets', () => {
  test('flags a 40px target', () => {
    const hits = findUndersizedTouchTargets("const s = { minWidth: '40px' };");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].px, 40);
    assert.equal(hits[0].property, 'minWidth');
  });

  test('passes exactly 48px (boundary is inclusive)', () => {
    assert.equal(findUndersizedTouchTargets("const s = { minWidth: '48px' };").length, 0);
  });

  test('flags every dimensional property, kebab or camel', () => {
    // The quoted kebab form is the ONLY legal spelling for a kebab-case CSS
    // property in a JS object. An earlier version of the rule missed it, which
    // means it was blind to half of all possible spellings. This test caught it.
    const src = [
      "{ width: '24px' }",
      "{ height: '24px' }",
      "{ 'min-height': '10px' }",
      "{ inlineSize: '32px' }",
    ].join('\n');
    assert.equal(findUndersizedTouchTargets(src).length, 4);
  });

  test('handles a template literal dimension', () => {
    assert.equal(findUndersizedTouchTargets('style={{ width: `24px` }}').length, 1);
  });

  test('does not guess at tokens or rem values', () => {
    assert.equal(findUndersizedTouchTargets("{ width: token('space.300') }").length, 0);
    assert.equal(findUndersizedTouchTargets("{ width: '2rem' }").length, 0);
  });

  test('respects a custom minimum', () => {
    assert.equal(findUndersizedTouchTargets("{ width: '44px' }", 44).length, 0);
    assert.equal(findUndersizedTouchTargets("{ width: '44px' }", 48).length, 1);
  });

  test('honours an explicit exemption', () => {
    assert.equal(
      findUndersizedTouchTargets(
        "{ width: '2px' } // hygiene-allow-small-target: 2px divider, not interactive",
      ).length,
      0,
    );
  });
});

describe('isAcceptableTouchTarget', () => {
  test('48 passes, 47 fails, junk fails', () => {
    assert.ok(isAcceptableTouchTarget(48));
    assert.ok(isAcceptableTouchTarget(64));
    assert.ok(!isAcceptableTouchTarget(47));
    assert.ok(!isAcceptableTouchTarget(Number.NaN));
  });
});

describe('stripComments', () => {
  test('preserves line count so reported line numbers stay true', () => {
    const src = 'a\n/* x\n y */\nb\n// z\nc';
    assert.equal(stripComments(src).split('\n').length, src.split('\n').length);
  });

  test('does not treat // inside a string as a comment', () => {
    const out = stripComments("const u = 'https://example.gov.rw/a'; const v = 1;");
    assert.ok(out.includes('https://example.gov.rw/a'));
    assert.ok(out.includes('const v = 1'));
  });

  test('strips html comments (for svg assets)', () => {
    assert.ok(!stripComments('<!-- #ff0000 --><rect/>').includes('#ff0000'));
  });
});

describe('MIN_BODY_TEXT_PX', () => {
  test('is 16 and agrees with the design-system constant', async () => {
    const { readFileSync } = await import('node:fs');
    assert.equal(MIN_BODY_TEXT_PX, 16);
    const a11y = readFileSync(
      new URL('../../../packages/design-system/src/a11y/index.ts', import.meta.url),
      'utf8',
    );
    // One number, two files, because the predicate file may not import.
    const declared = /MIN_BODY_TEXT_PX = (\d+)/.exec(a11y);
    assert.ok(declared, 'design-system must declare MIN_BODY_TEXT_PX');
    assert.equal(Number(declared[1]), MIN_BODY_TEXT_PX, 'the two floors have drifted apart');
  });

  test('ADS sizes are 12 / 14 / 16, so only large clears the floor', () => {
    assert.deepEqual({ ...TEXT_SIZE_PX }, { small: 12, medium: 14, large: 16 });
    const compliant = Object.entries(TEXT_SIZE_PX)
      .filter(([, px]) => px >= MIN_BODY_TEXT_PX)
      .map(([name]) => name);
    assert.deepEqual(compliant, ['large']);
  });
});

describe('bodyTextSizeOf', () => {
  test('treats a missing size as the 14px medium default', () => {
    assert.equal(bodyTextSizeOf('color="x"').px, 14);
  });
  test('reads single-quoted and double-quoted literals', () => {
    assert.equal(bodyTextSizeOf("size='small'").px, 12);
    assert.equal(bodyTextSizeOf('size="large"').px, 16);
  });
  test('reports an expression rather than guessing', () => {
    assert.match(bodyTextSizeOf('size={compact ? "small" : "large"}').expression, /compact/);
  });
  test('reports an unknown literal rather than passing it', () => {
    assert.equal(bodyTextSizeOf('size="xlarge"').literal, 'xlarge');
  });
});

describe('findUndersizedBodyText', () => {
  test('fires on the default, small and medium', () => {
    const src = '<Text>a</Text>\n<Text size="small">b</Text>\n<Text size="medium">c</Text>';
    assert.deepEqual(
      findUndersizedBodyText(src).map((v) => v.line),
      [1, 2, 3],
    );
  });

  test('stays silent on large', () => {
    assert.equal(findUndersizedBodyText('<Text size="large">ok</Text>').length, 0);
  });

  test('reads a multi-line opening tag and reports its first line', () => {
    const src = 'const a = 1;\n<Text\n  size="small"\n  color="color.text"\n>\n  x\n</Text>';
    assert.deepEqual(findUndersizedBodyText(src), [{ line: 2, size: 'small', px: 12 }]);
  });

  test('is not fooled by a > inside an attribute expression', () => {
    const src = '<Text size="small" testId={a > b ? "x" : "y"}>z</Text>';
    assert.equal(findUndersizedBodyText(src).length, 1);
  });

  test('ignores Heading, TextArea, Textfield and the closing tag', () => {
    const src = [
      '<Heading size="small" as="h2">t</Heading>',
      '<TextArea size="small" />',
      '<Textfield size="small" />',
      '</Text>',
      '<Text size="large">ok</Text>',
    ].join('\n');
    assert.equal(findUndersizedBodyText(src).length, 0);
  });

  test('ignores a size that only appears in a comment', () => {
    const src = '{/* <Text size="small">old</Text> */}\n<Text size="large">ok</Text>';
    assert.equal(findUndersizedBodyText(src).length, 0);
  });

  test('honours the exemption marker on the tag and on the comment above', () => {
    const onTag = '<Text size="small" method="x">a</Text> {/* hygiene-allow-small-text: mark */}';
    assert.equal(findUndersizedBodyText(onTag).length, 0);
    const above = [
      '// hygiene-allow-small-text: a mark, not body copy',
      '<Text size="small">a</Text>',
    ].join('\n');
    assert.equal(findUndersizedBodyText(above).length, 0);
  });
});

describe('isBodyTextExemptPath', () => {
  test('exempts the national lockup and the agency logo only', () => {
    assert.ok(isBodyTextExemptPath('packages/ui/src/national/NationalLockup.tsx'));
    assert.ok(isBodyTextExemptPath('packages/ui/src/components/AgencyLogo/index.tsx'));
    assert.ok(!isBodyTextExemptPath('packages/ui/src/charts/MetricCard.tsx'));
    assert.ok(!isBodyTextExemptPath('apps/officer-console/src/dashboard/panels.tsx'));
  });

  test('exempt paths are inside the scanned roots, so the exemption is meaningful', () => {
    for (const path of BODY_TEXT_SCAN.exemptPaths) {
      assert.ok(
        BODY_TEXT_SCAN.roots.some((r) => path.startsWith(r + '/')),
        path + ' is exempt but not scanned - the exemption is dead weight',
      );
    }
  });
});

describe('the two hex consumers agree about the marker', () => {
  test('a marker on the line exempts, and one in the comment block above exempts', () => {
    const onLine = 'export const c = "#003F82"; // hygiene-allow-hex: PWA theme, OS-read';
    assert.equal(findRawHexColors(onLine).length, 0);

    const above = [
      '// hygiene-allow-hex: PWA theme, read before any CSS exists',
      '// a second justified line',
      'export const c = "#003F82";',
    ].join('\n');
    assert.equal(findRawHexColors(above).length, 0);
  });

  test('an unrelated comment above does NOT exempt (the walk stops at code)', () => {
    const src = [
      '// an ordinary remark with no marker',
      'const other = 1;',
      'export const c = "#003F82";',
    ].join('\n');
    assert.equal(findRawHexColors(src).length, 1);
  });

  test('an unmarked literal is still a violation', () => {
    assert.equal(findRawHexColors('export const c = "#003F82";').length, 1);
  });
});
