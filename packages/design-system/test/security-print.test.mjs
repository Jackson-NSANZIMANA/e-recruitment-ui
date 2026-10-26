/**
 * Security-print arithmetic.
 *
 * The check digit is asserted against the ICAO Doc 9303 specimen passport
 * (Utopia, L898902C3) - the published worked example, not values computed by
 * the code under test. The guilloche is asserted for the one property that
 * makes it worth having: the same seed always draws the same pattern, and a
 * different seed never does.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkDigit, mrzValue, toMrz, verifyCheckDigit, withCheckDigit } from '../src/security-print/check-digit.ts';
import { bandPaths, rosettePaths, seedFrom } from '../src/security-print/guilloche.ts';

describe('ICAO 9303 check digit', () => {
  test('matches the Doc 9303 specimen data page', () => {
    assert.equal(checkDigit('L898902C3'), 6, 'document number');
    assert.equal(checkDigit('740812'), 2, 'date of birth');
    assert.equal(checkDigit('120415'), 9, 'date of expiry');
    assert.equal(checkDigit('ZE184226B<<<<<'), 1, 'optional data with fillers');
  });

  test('character values follow the standard', () => {
    assert.equal(mrzValue('<'), 0);
    assert.equal(mrzValue('7'), 7);
    assert.equal(mrzValue('A'), 10);
    assert.equal(mrzValue('Z'), 35);
    assert.throws(() => mrzValue('a'), RangeError);
  });

  test('normalises free text and round-trips', () => {
    assert.equal(toMrz('rdf-26 nyg/004817'), 'RDF<26<NYG<004817');
    const line = withCheckDigit('RDF-26-NYG-004817');
    assert.ok(verifyCheckDigit(line));
  });

  test('a single-character change of value +/-1 to +/-9 is always caught', () => {
    // 7, 3 and 1 are all coprime to 10, so any change whose value difference is
    // not a multiple of 10 moves the sum off its residue. A change of exactly 10
    // (e.g. '<' to 'A', '5' to 'F') is the scheme's known blind spot.
    const line = withCheckDigit('RDF<26<NYG<004817');
    for (let i = 0; i < line.length - 1; i += 1) {
      const ch = line[i];
      const swapped = ch === '9' ? '8' : ch === '<' ? '1' : ch === 'Z' ? 'Y' : String.fromCharCode(ch.charCodeAt(0) + 1);
      const altered = line.slice(0, i) + swapped + line.slice(i + 1);
      assert.equal(verifyCheckDigit(altered), false, `position ${i}: ${altered}`);
    }
  });

  test('rejects garbage without throwing', () => {
    assert.equal(verifyCheckDigit(''), false);
    assert.equal(verifyCheckDigit('A'), false);
    assert.equal(verifyCheckDigit('ABCX'), false);
  });
});

describe('seeded guilloche', () => {
  test('same seed, same pattern; different seed, different pattern', () => {
    const a = bandPaths({ seed: seedFrom('EP-0048-1730'), width: 600, height: 360 });
    const b = bandPaths({ seed: seedFrom('EP-0048-1730'), width: 600, height: 360 });
    const c = bandPaths({ seed: seedFrom('EP-0048-1731'), width: 600, height: 360 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  test('rosette curves close and stay inside their radius', () => {
    const paths = rosettePaths({ seed: seedFrom('x'), cx: 100, cy: 100, radius: 50, rings: 4, samples: 360 });
    assert.equal(paths.length, 4);
    for (const d of paths) {
      assert.ok(d.endsWith('Z'));
      for (const [, x, y] of d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)) {
        assert.ok(Math.hypot(Number(x) - 100, Number(y) - 100) <= 50.01);
      }
    }
  });

  test('seedFrom is stable (pinned value guards an accidental algorithm change)', () => {
    assert.equal(seedFrom(''), 0x811c9dc5);
    assert.equal(seedFrom('a'), 0xe40c292c);
  });
});

describe('machine line', () => {
  test('head, fields with check digits, composite digit', async () => {
    const { composeMachineLine } = await import('../src/security-print/check-digit.ts');
    const line = composeMachineLine('USRP<RCS', ['RCS-26-HYE-000412', '261114']);
    assert.match(line, /^USRP<RCS<<RCS<26<HYE<000412\d<<261114\d<<\d$/);
    const [, serialGroup, dateGroup] = line.split('<<');
    assert.ok(verifyCheckDigit(serialGroup));
    assert.ok(verifyCheckDigit(dateGroup));
    assert.ok(verifyCheckDigit(line.slice(0, -3) + line.slice(-1)));
  });
});
