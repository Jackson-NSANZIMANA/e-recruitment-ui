import { describe, expect, it } from 'vitest';
import { choicesFor, medicalInputFor, medicalModeFor } from './medical.ts';

const APP = 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f';
describe('medical agency mode (ADR-013)', () => {
  it('RDF is a board; RNP and RCS are certificate agencies; anything else has none', () => {
    expect(medicalModeFor('RDF')).toBe('BOARD');
    expect(medicalModeFor('RNP')).toBe('CERTIFICATE');
    expect(medicalModeFor('RCS')).toBe('CERTIFICATE');
    expect(medicalModeFor('XYZ')).toBeNull();
    expect(choicesFor('BOARD')).toEqual(['FIT', 'UNFIT']);
  });
  it('RDF sends fitnessStatus only', () => {
    expect(medicalInputFor('BOARD', APP, 'FIT', 'ignored')).toEqual({ input: { applicationId: APP, fitnessStatus: 'FIT' } });
    expect(medicalInputFor('BOARD', APP, 'CERT_VERIFIED', 'Dr X')).toEqual({ problem: 'choice_not_for_mode' });
  });
  it('a verified certificate needs the physician; a rejected one needs no name', () => {
    expect(medicalInputFor('CERTIFICATE', APP, 'CERT_VERIFIED', ' ')).toEqual({ problem: 'physician_required' });
    expect(medicalInputFor('CERTIFICATE', APP, 'CERT_VERIFIED', ' Dr Mukamana ')).toEqual({ input: { applicationId: APP, certVerdict: 'CERT_VERIFIED', physicianName: 'Dr Mukamana' } });
    expect(medicalInputFor('CERTIFICATE', APP, 'CERT_REJECTED', '')).toEqual({ input: { applicationId: APP, certVerdict: 'CERT_REJECTED' } });
    expect(medicalInputFor('CERTIFICATE', APP, 'FIT', '')).toEqual({ problem: 'choice_not_for_mode' });
  });
});
