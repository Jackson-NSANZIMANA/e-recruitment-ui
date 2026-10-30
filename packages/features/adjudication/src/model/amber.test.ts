import { describe, expect, it } from 'vitest';
import {
  ADJUDICABLE_STATUSES,
  activeFlags,
  availableGrounds,
  holdKindOf,
  isActionableHold,
  reasonCodes,
  registryHoldOf,
  signalBand,
  type AmberRow,
  type HoldKind,
} from './amber.js';

const documentHold: AmberRow = {
  applicationId: 'a-1',
  processingCode: 'RDF-1',
  status: 'DOCUMENT_REVIEW_AMBER',
  documentType: 'NATIONAL_ID',
  forensicsScore: 0.82,
  forensicsFlags: { glare: true, cropped: false },
  queuedAt: '2026-09-08T08:00:00.000Z',
  reasons: [],
};

/** S12b: a LIVE row the same read serves because its criminal clearance is UNDER_REVIEW. */
const clearanceHold: AmberRow = {
  ...documentHold,
  applicationId: 'a-2',
  processingCode: 'RNP-2',
  status: 'CRIMINAL_CLEARANCE',
  documentType: null,
  forensicsScore: null,
  forensicsFlags: null,
  reasons: ['CRIMINAL_RECORD_REVIEW'],
};

const academicHold: AmberRow = {
  ...clearanceHold,
  applicationId: 'a-3',
  processingCode: 'RCS-3',
  status: 'ACADEMIC_VETTING',
  reasons: ['NESA_LEVEL_UNKNOWN', 'IDENTITY_NAME_PARTIAL'],
};

describe('amber queue model', () => {
  it('distinguishes the three things one read serves', () => {
    expect(holdKindOf(documentHold)).toBe('DOCUMENT');
    expect(holdKindOf({ status: 'ADJUDICATION_REVIEW' })).toBe('ADJUDICATION');
    expect(holdKindOf(clearanceHold)).toBe('REGISTRY');
    expect(holdKindOf({ status: null })).toBe('REGISTRY');
  });

  it('offers grounds only where a decision can be recorded', () => {
    expect(availableGrounds(documentHold)).toEqual(['DOCUMENT']);
    expect(availableGrounds({ ...documentHold, status: 'ADJUDICATION_REVIEW' })).toEqual(['ELIGIBILITY']);
    expect(availableGrounds(clearanceHold)).toEqual([]);
  });

  it('never calls a registry hold actionable, and never contradicts the status set it mirrors', () => {
    expect(isActionableHold('DOCUMENT')).toBe(true);
    expect(isActionableHold('ADJUDICATION')).toBe(true);
    expect(isActionableHold('REGISTRY')).toBe(false);
    // The set is a BACKEND fact; the classifier must agree with it, or the screen
    // offers a decision the adjudicate transaction answers NOT_APPLICABLE to.
    const samples: readonly HoldKind[] = ['DOCUMENT', 'ADJUDICATION', 'REGISTRY'];
    for (const kind of samples) {
      const status = kind === 'DOCUMENT' ? 'DOCUMENT_REVIEW_AMBER' : kind === 'ADJUDICATION' ? 'ADJUDICATION_REVIEW' : 'CRIMINAL_CLEARANCE';
      expect(ADJUDICABLE_STATUSES.has(status)).toBe(isActionableHold(kind));
    }
  });

  it('names which registry a hold waits on, and says so plainly when the codes do not', () => {
    expect(registryHoldOf(clearanceHold.reasons)).toBe('CRIMINAL');
    expect(registryHoldOf(academicHold.reasons)).toBe('ACADEMIC');
    // Both present: criminal wins, because it is the more consequential.
    expect(registryHoldOf(['NESA_MALPRACTICE', 'CRIMINAL_RECORD_REVIEW'])).toBe('CRIMINAL');
    // No codes at all is a real, different answer from "no reason exists".
    expect(registryHoldOf([])).toBeNull();
    expect(registryHoldOf(['SOMETHING_NEW'])).toBeNull();
  });

  it('carries every code through, de-duplicated and sorted, including ones it cannot name', () => {
    expect(reasonCodes(academicHold)).toEqual(['IDENTITY_NAME_PARTIAL', 'NESA_LEVEL_UNKNOWN']);
    expect(reasonCodes({ reasons: ['B', 'A', 'B'] })).toEqual(['A', 'B']);
    expect(reasonCodes({ reasons: ['SOMETHING_NEW'] })).toEqual(['SOMETHING_NEW']);
    expect(reasonCodes({ reasons: [] })).toEqual([]);
  });

  it('keeps signal bands and active flags deterministic', () => {
    expect(signalBand(null)).toBe('UNSCORED');
    expect(signalBand(0.6)).toBe('WEAKER');
    expect(signalBand(0.8)).toBe('MIXED');
    expect(signalBand(0.95)).toBe('CLEANER');
    expect(activeFlags(documentHold.forensicsFlags)).toEqual(['glare']);
  });
});
