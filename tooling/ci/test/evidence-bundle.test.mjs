import assert from 'node:assert/strict';
import test from 'node:test';
import { assertionCount, parseJUnit, parsePlaywright, typedOperationIds } from '../evidence-bundle.mjs';

test('vitest JUnit: classname is the file, a bare <skipped/> counts', () => {
  const xml = '<testsuites name="vitest tests" tests="2"><testsuite name="src/x.test.ts"><testcase classname="src/x.test.ts" name="maps wire &amp; state" time="0.1"></testcase><testcase classname="src/x.test.ts" name="later" time="0"><skipped/></testcase></testsuite></testsuites>';
  assert.deepEqual(parseJUnit(xml, '/repo'), [
    { name: 'maps wire & state', file: 'src/x.test.ts', outcome: 'passed' },
    { name: 'later', file: 'src/x.test.ts', outcome: 'skipped', reason: '' },
  ]);
});

test('node:test JUnit: absolute file made relative, failure message kept', () => {
  const xml = '<testsuites><testcase name="parity" classname="test" file="/repo/packages/i18n/test/a.test.mjs"><failure type="testCodeFailure" message="rw is missing &quot;rehearsal.title&quot;">stack</failure></testcase></testsuites>';
  assert.deepEqual(parseJUnit(xml, '/repo'), [
    { name: 'parity', file: 'packages/i18n/test/a.test.mjs', outcome: 'failed', reason: 'rw is missing "rehearsal.title"' },
  ]);
});

test('Playwright JSON: nested suites flattened, skip reason kept, flaky kept apart', () => {
  const report = {
    suites: [{
      title: 'live-rehearsal.spec.ts',
      file: 'live-rehearsal.spec.ts',
      specs: [],
      suites: [{
        title: 'live journey',
        specs: [
          { title: 'persona A is admitted', file: 'live-rehearsal.spec.ts', tests: [{ projectName: 'chromium', status: 'skipped', annotations: [{ type: 'skip', description: 'set USRP_LIVE=1' }] }] },
          { title: 'signs in', file: 'live-rehearsal.spec.ts', tests: [{ projectName: 'chromium', status: 'expected', annotations: [] }] },
          { title: 'retries once', file: 'live-rehearsal.spec.ts', tests: [{ projectName: 'chromium', status: 'flaky', annotations: [] }] },
          { title: 'breaks', file: 'live-rehearsal.spec.ts', tests: [{ projectName: 'chromium', status: 'unexpected', annotations: [] }] },
        ],
      }],
    }],
  };
  const cases = parsePlaywright(report, 'applicant-portal');
  assert.deepEqual(cases.map((c) => [c.name, c.outcome]), [
    ['persona A is admitted', 'skipped'],
    ['signs in', 'passed'],
    ['retries once', 'flaky'],
    ['breaks', 'failed'],
  ]);
  assert.equal(cases[0].reason, 'set USRP_LIVE=1');
  assert.equal(cases[0].app, 'applicant-portal');
});

test('assertion counts come from the proof\'s own total line, or are null', () => {
  assert.equal(assertionCount('  PASS  contract drift — 877 assertions\n\x1b[32mALL GATES GREEN — 2,377 assertions.\x1b[0m'), 2377);
  assert.equal(assertionCount('  manifest: x.json\n  assertions: 44\n  status: PASS'), 44);
  assert.equal(assertionCount('ALL HYGIENE GATES GREEN'), null);
});

test('typed operations are the IDs with a call site; registry-only IDs are not', () => {
  const sources = [
    "return client.call<PublicCampaignListResponse>('listCampaigns', {});",
    "client.call('readSession')",
    "// createCampaign is not wrapped yet",
  ];
  assert.deepEqual([...typedOperationIds(sources)].sort(), ['listCampaigns', 'readSession']);
});
