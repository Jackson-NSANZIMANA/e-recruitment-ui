import { describe, expect, it } from 'vitest';
import {
  activeFlags,
  availableGrounds,
  holdKindOf,
  signalBand,
  type AmberRow,
} from './amber.js';

const documentHold: AmberRow = {
  applicationId: 'a-1',
  processingCode: 'RDF-1',
  status: 'DOCUMENT_REVIEW_AMBER',
  documentType: 'NATIONAL_ID',
  forensicsScore: 0.82,
  forensicsFlags: { glare: true, cropped: false },
  queuedAt: '2026-09-08T08:00:00.000Z',
};

describe('amber queue model', () => {
  it('distinguishes document and adjudication holds', () => {
    expect(holdKindOf(documentHold)).toBe('DOCUMENT');
    expect(holdKindOf({ status: 'ADJUDICATION_REVIEW' })).toBe('ADJUDICATION');
    expect(availableGrounds(documentHold)).toEqual(['DOCUMENT']);
    expect(availableGrounds({ ...documentHold, status: 'ADJUDICATION_REVIEW' })).toEqual(['ELIGIBILITY']);
  });

  it('keeps signal bands and active flags deterministic', () => {
    expect(signalBand(null)).toBe('UNSCORED');
    expect(signalBand(0.6)).toBe('WEAKER');
    expect(signalBand(0.8)).toBe('MIXED');
    expect(signalBand(0.95)).toBe('CLEANER');
    expect(activeFlags(documentHold.forensicsFlags)).toEqual(['glare']);
  });
});
