/**
 * The accessibility floor, asserted as arithmetic.
 *
 * axe-core proves the RENDERED output is conformant. These tests prove the
 * CONSTANTS the components are built from are still the ones the research
 * asked for - which is the thing a well-meaning refactor is most likely to
 * quietly change.
 *
 * Deliberately zero-dependency (node:test) so it runs on a clean checkout.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => readFileSync(join(SRC, p), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('accessibility floor', () => {
  test('MIN_TOUCH_TARGET_PX is 48 and clears WCAG 2.1 AA SC 2.5.5 (44)', () => {
    const m = /MIN_TOUCH_TARGET_PX = (\d+)/.exec(read('a11y/index.ts'));
    assert.ok(m, 'MIN_TOUCH_TARGET_PX must be declared');
    assert.equal(Number(m[1]), 48);
    assert.ok(Number(m[1]) >= 44);
  });

  test('body text floor is 16px, below which mobile browsers force zoom', () => {
    assert.match(read('a11y/index.ts'), /MIN_BODY_TEXT_PX = 16/);
  });

  test('contrast floors match WCAG 2.1 AA exactly', () => {
    const src = read('a11y/index.ts');
    assert.match(src, /CONTRAST_AA_NORMAL_TEXT = 4\.5/);
    assert.match(src, /CONTRAST_AA_LARGE_TEXT = 3/);
    assert.match(src, /CONTRAST_AA_NON_TEXT = 3/);
  });

  test('colour mode is light: positive polarity for sunlight readability', () => {
    assert.match(read('a11y/index.ts'), /COLOR_MODE = 'light'/);
  });

  test('TouchTarget enforces the floor from the constant, not a magic number', () => {
    const src = read('components/TouchTarget/index.tsx');
    assert.match(src, /MIN_TOUCH_TARGET_PX/, 'must reference the shared constant');
    assert.match(src, /minWidth: '48px'/);
    assert.match(src, /minHeight: '48px'/);
  });
});

describe('domain-free guarantee', () => {
  const files = [
    'index.ts',
    'tokens/index.ts',
    'a11y/index.ts',
    'components/ErrorBoundary/index.tsx',
    'components/RouterLink/index.tsx',
    'components/TouchTarget/index.tsx',
  ];

  test('no source file imports a USRP domain package', () => {
    for (const f of files) {
      const code = stripComments(read(f));
      const bad = /from\s+['"]@usrp\/(shared-types|contracts|api-client|auth|features|i18n|ui)/.exec(code);
      assert.equal(bad, null, f + ' imports ' + (bad?.[0] ?? ''));
    }
  });

  test('no source file contains a raw hex colour', () => {
    for (const f of files) {
      const code = stripComments(read(f));
      assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(code), false, f + ' contains a raw hex colour');
    }
  });
});
