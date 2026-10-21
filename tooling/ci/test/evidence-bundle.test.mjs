import assert from 'node:assert/strict';
import test from 'node:test';
import { assertionCount, parseJUnit, parsePlaywright, pinAgreement, summariseE2eReports, typedOperationIds } from '../evidence-bundle.mjs';

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

test('node:test JUnit: a raw > inside a failure message does not hide the failure', () => {
  const xml = '<testsuites><testcase name="compares" file="/repo/a.test.mjs" failure="expected 2 > 1"><failure type="testCodeFailure" message="expected 2 > 1 to be false">stack</failure></testcase><testcase name="next" file="/repo/a.test.mjs"/></testsuites>';
  assert.deepEqual(parseJUnit(xml, '/repo').map((c) => [c.name, c.outcome]), [['compares', 'failed'], ['next', 'passed']]);
});

const passing = { suites: [{ title: 'a.spec.ts', file: 'a.spec.ts', specs: [{ title: 'ok', tests: [{ projectName: 'chromium', status: 'expected', annotations: [] }] }] }], errors: [] };

test('E2E is passed only when every app reported cleanly', () => {
  const all = summariseE2eReports([{ app: 'applicant-portal', report: passing }, { app: 'officer-console', report: passing }, { app: 'field-station', report: passing }]);
  assert.equal(all.status, 'passed');
});

test('E2E with an app report missing is incomplete, not passed', () => {
  const one = summariseE2eReports([{ app: 'applicant-portal', report: passing }]);
  assert.equal(one.status, 'incomplete');
  assert.deepEqual(one.missingApps, ['officer-console', 'field-station']);
});

test('a Playwright top-level error (no specs ran) is a failure', () => {
  const broken = { suites: [], errors: [{ message: '\x1b[31mError: global setup failed\x1b[0m' }] };
  const result = summariseE2eReports([{ app: 'applicant-portal', report: passing }, { app: 'officer-console', report: broken }, { app: 'field-station', report: passing }]);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.errors, [{ app: 'officer-console', message: 'Error: global setup failed' }]);
});

test('backend pins agree only when ci.yml and paths.ts are both readable and equal', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  assert.equal(pinAgreement({ ciBackendSha: a, edgeBackendSha: a, openapiShas: [a] }), true);
  assert.equal(pinAgreement({ ciBackendSha: a, edgeBackendSha: a, openapiShas: [] }), true);
  assert.equal(pinAgreement({ ciBackendSha: null, edgeBackendSha: a, openapiShas: [a] }), false);
  assert.equal(pinAgreement({ ciBackendSha: a, edgeBackendSha: null, openapiShas: [] }), false);
  assert.equal(pinAgreement({ ciBackendSha: a, edgeBackendSha: a, openapiShas: [b] }), false);
});
