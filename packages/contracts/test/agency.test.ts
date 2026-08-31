import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENCIES,
  AGENCY_DOCUMENT_TYPES,
  APPLICATION_CHANNELS,
  APPLICATION_STATUSES,
  AUTH_KINDS,
  DOCUMENT_LANES,
  DOCUMENT_TYPES,
  GENDERS,
  RDF_ONLY_STATUSES,
  ROUTE_REACHES,
  STATUSES_BY_AGENCY,
  TERMINAL_STATUSES,
  VERIFIED_BACKEND_SHA,
  isDocumentTypeSupported,
  isTerminal,
} from '../src/agency.js';

/** The commit .github/workflows/ci.yml pins BACKEND_SHA to. */
const CI_PINNED_BACKEND_SHA = '47d9ad3ab019f6d2f826cfae2136cbff898d733f';

test('the divergence model is pinned to the same backend commit CI checks out', () => {
  assert.equal(VERIFIED_BACKEND_SHA, CI_PINNED_BACKEND_SHA);
});

test('three agencies, no fourth, no superadmin', () => {
  assert.deepEqual([...AGENCIES], ['RDF', 'RNP', 'RCS']);
});

test('19 statuses for RDF, 15 for RNP and RCS', () => {
  assert.equal(APPLICATION_STATUSES.length, 19);
  assert.equal(STATUSES_BY_AGENCY.RDF.length, 19);
  assert.equal(STATUSES_BY_AGENCY.RNP.length, 15);
  assert.equal(STATUSES_BY_AGENCY.RCS.length, 15);
});

test('the walk-in lane is exactly the four RDF-only states', () => {
  assert.equal(RDF_ONLY_STATUSES.length, 4);
  assert.ok(RDF_ONLY_STATUSES.every((status) => status.startsWith('WALK_IN_')));
  for (const status of RDF_ONLY_STATUSES) {
    assert.ok(STATUSES_BY_AGENCY.RDF.includes(status), `RDF must carry ${status}`);
    assert.ok(!STATUSES_BY_AGENCY.RNP.includes(status), `RNP must NOT carry ${status}`);
    assert.ok(!STATUSES_BY_AGENCY.RCS.includes(status), `RCS must NOT carry ${status}`);
  }
});

test('RNP and RCS see exactly the shared set — the partition is total', () => {
  const shared = APPLICATION_STATUSES.filter(
    (status) => !(RDF_ONLY_STATUSES as readonly string[]).includes(status),
  );
  assert.deepEqual([...STATUSES_BY_AGENCY.RNP], shared);
  assert.deepEqual([...STATUSES_BY_AGENCY.RCS], shared);
  assert.equal(shared.length + RDF_ONLY_STATUSES.length, APPLICATION_STATUSES.length);
});

test('statuses are unique and SCREAMING_SNAKE, as the enums are', () => {
  assert.equal(new Set(APPLICATION_STATUSES).size, APPLICATION_STATUSES.length);
  assert.ok(APPLICATION_STATUSES.every((status) => /^[A-Z][A-Z_]*$/.test(status)));
});

test('the twelve statuses the deprecated package invented exist nowhere here', () => {
  const fiction = [
    'UNDER_REVIEW',
    'SHORTLISTED',
    'PHYSICAL_SCHEDULED',
    'PHYSICAL_PASSED',
    'PHYSICAL_FAILED',
    'MEDICAL_SCHEDULED',
    'MEDICAL_PASSED',
    'MEDICAL_FAILED',
    'VETTING_IN_PROGRESS',
    'VETTING_PASSED',
    'VETTING_FAILED',
    'EXPIRED',
  ];
  for (const invented of fiction) {
    assert.ok(
      !(APPLICATION_STATUSES as readonly string[]).includes(invented),
      `${invented} does not exist in any *_ops.application_status enum`,
    );
  }
});

test('the real statuses the deprecated package lost are all present', () => {
  for (const real of [
    'ACADEMIC_VETTING',
    'CRIMINAL_CLEARANCE',
    'DOCUMENT_REVIEW_GREEN',
    'DOCUMENT_REVIEW_AMBER',
    'SLOT_ASSIGNED',
    'PHYSICAL_TEST_SCHEDULED',
    'PHYSICAL_TEST_COMPLETE',
    'MEDICAL_REVIEW',
    'FINAL_SHORTLIST',
    'ADJUDICATION_REVIEW',
  ]) {
    assert.ok((APPLICATION_STATUSES as readonly string[]).includes(real), `${real} is missing`);
  }
});

test('terminal states are per-agency, include WALK_IN_REJECTED for RDF only, and exclude EXPIRED', () => {
  assert.deepEqual([...TERMINAL_STATUSES.RDF], ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REJECTED']);
  assert.deepEqual([...TERMINAL_STATUSES.RNP], ['ACCEPTED', 'REJECTED', 'WITHDRAWN']);
  assert.deepEqual([...TERMINAL_STATUSES.RCS], ['ACCEPTED', 'REJECTED', 'WITHDRAWN']);
  for (const agency of AGENCIES) {
    assert.ok(!(TERMINAL_STATUSES[agency] as readonly string[]).includes('EXPIRED'));
    const terminal: readonly string[] = TERMINAL_STATUSES[agency];
    const legal: readonly string[] = STATUSES_BY_AGENCY[agency];
    for (const status of terminal) {
      assert.ok(legal.includes(status), `${status} must be legal for ${agency}`);
    }
  }
});

test('isTerminal agrees with the tables, per agency', () => {
  assert.equal(isTerminal('RDF', 'WALK_IN_REJECTED'), true);
  assert.equal(isTerminal('RDF', 'SUBMITTED'), false);
  assert.equal(isTerminal('RNP', 'ACCEPTED'), true);
  assert.equal(isTerminal('RNP', 'DRAFT'), false);
});

test('document types are agency-specific, and every agency set is a subset of the union', () => {
  assert.equal(DOCUMENT_TYPES.length, 11);
  for (const agency of AGENCIES) {
    const accepted: readonly string[] = AGENCY_DOCUMENT_TYPES[agency];
    for (const documentType of accepted) {
      assert.ok((DOCUMENT_TYPES as readonly string[]).includes(documentType));
    }
    assert.ok(accepted.includes('NATIONAL_ID'), 'every agency wants the NID');
  }
});

test('OLEVEL is RDF-only and CELIBACY is RCS-only, as the *_ops enums have it', () => {
  assert.equal(isDocumentTypeSupported('RDF', 'OLEVEL_CERTIFICATE'), true);
  assert.equal(isDocumentTypeSupported('RNP', 'OLEVEL_CERTIFICATE'), false);
  assert.equal(isDocumentTypeSupported('RCS', 'OLEVEL_CERTIFICATE'), false);
  assert.equal(isDocumentTypeSupported('RCS', 'CELIBACY_CERTIFICATE'), true);
  assert.equal(isDocumentTypeSupported('RDF', 'CELIBACY_CERTIFICATE'), false);
});

test('gender is the two values NIDA validates — no third', () => {
  assert.deepEqual([...GENDERS], ['MALE', 'FEMALE']);
});

test('the four channels identity-service validates', () => {
  assert.deepEqual([...APPLICATION_CHANNELS], ['WEB', 'USSD', 'IREMBO_KIOSK', 'WALK_IN']);
});

test('the four auth kinds, and the citizen session is not a JWT kind', () => {
  assert.deepEqual([...AUTH_KINDS], ['officer', 'system', 'applicant-session', 'none']);
  assert.ok(AUTH_KINDS.includes('applicant-session'));
});

test('reach is a two-value model and the lanes are the forensics triage', () => {
  assert.deepEqual([...ROUTE_REACHES], ['browser', 'service-internal']);
  assert.deepEqual([...DOCUMENT_LANES], ['GREEN', 'AMBER', 'RED']);
});
