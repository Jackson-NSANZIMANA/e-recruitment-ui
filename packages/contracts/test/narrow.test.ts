import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_AGENCIES,
  AgencyStatusError,
  assertStatusFor,
  isStatusFor,
  narrowRow,
  narrowRows,
} from '../src/narrow.js';
import { APPLICATION_STATUSES, RDF_ONLY_STATUSES, STATUSES_BY_AGENCY } from '../src/agency.js';
import type { ApplicationStatus } from '../src/agency.js';

const row = (status: ApplicationStatus): { readonly status: ApplicationStatus; readonly id: string } => ({
  status,
  id: 'a1',
});

test('ALL_AGENCIES is the full set, so an iteration cannot miss one', () => {
  assert.deepEqual([...ALL_AGENCIES], ['RDF', 'RNP', 'RCS']);
});

test('isStatusFor mirrors STATUSES_BY_AGENCY for every agency and every status', () => {
  for (const agency of ALL_AGENCIES) {
    for (const status of APPLICATION_STATUSES) {
      assert.equal(
        isStatusFor(agency, status),
        STATUSES_BY_AGENCY[agency].includes(status),
        `${agency}/${status}`,
      );
    }
  }
});

test('THE BUG THIS FILE EXISTS FOR: a walk-in status on an RNP row is refused', () => {
  for (const status of RDF_ONLY_STATUSES) {
    assert.equal(isStatusFor('RDF', status), true);
    assert.equal(isStatusFor('RNP', status), false);
    assert.equal(isStatusFor('RCS', status), false);
    assert.throws(() => narrowRow('RNP', row(status)), AgencyStatusError);
    assert.throws(() => narrowRow('RCS', row(status)), AgencyStatusError);
    assert.doesNotThrow(() => narrowRow('RDF', row(status)));
  }
});

test('narrowRow returns the same object, only retyped — no field is dropped', () => {
  const original = row('SUBMITTED');
  const narrowed = narrowRow('RNP', original);
  assert.equal(narrowed, original);
  assert.equal(narrowed.id, 'a1');
});

test('the refusal explains itself with the agency, the count and the lane', () => {
  try {
    narrowRow('RNP', row('WALK_IN_REGISTERED'));
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(error instanceof AgencyStatusError);
    assert.equal(error.agency, 'RNP');
    assert.equal(error.status, 'WALK_IN_REGISTERED');
    assert.equal(error.name, 'AgencyStatusError');
    assert.ok(error.message.includes('not legal for RNP'), error.message);
    assert.ok(error.message.includes('15 of 19'), error.message);
    assert.ok(error.message.includes('rdf_ops'), error.message);
  }
});

test('assertStatusFor throws for an illegal status and passes for a legal one', () => {
  assert.throws(() => assertStatusFor('RCS', 'WALK_IN_PHYSICAL_TEST'), AgencyStatusError);
  assert.doesNotThrow(() => assertStatusFor('RCS', 'MEDICAL_REVIEW'));
});

test('narrowRows names the offending INDEX, so a bad page is diagnosable', () => {
  const rows = [row('SUBMITTED'), row('DRAFT'), row('WALK_IN_REJECTED')];
  try {
    narrowRows('RNP', rows);
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(error instanceof AgencyStatusError);
    assert.ok(error.message.includes('at index 2'), error.message);
  }
});

test('narrowRows passes a clean page through in order', () => {
  const rows = [row('SUBMITTED'), row('MEDICAL_REVIEW')];
  const narrowed = narrowRows('RNP', rows);
  assert.equal(narrowed.length, 2);
  assert.deepEqual(narrowed.map((r) => r.status), ['SUBMITTED', 'MEDICAL_REVIEW']);
});

test('ADJUDICATION_REVIEW is legal for all three — rls/0011 added it everywhere', () => {
  for (const agency of ALL_AGENCIES) {
    assert.equal(isStatusFor(agency, 'ADJUDICATION_REVIEW'), true);
  }
});
