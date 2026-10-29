import { describe, expect, it } from 'vitest';
import type { CampaignAdminDetail } from '@usrp/api-client';
import { EMPTY_DRAFT, fieldOfServerError, toCreateCommand, validateDraft, type DraftForm } from './draft.ts';
import { daysBetween, instantToKigaliLocal, kigaliLocalToInstant } from './kigali.ts';
import { diffPolicy, policyDigest, suggestPolicy, toPolicyCommand, validatePolicy, canonicalPolicyJson } from './policy.ts';
import { canPublish, consequencesOf, preflight, stepOfRefusal } from './preflight.ts';
import { coverageOf, toSessionCommand, validateSession } from './sessions.ts';
import { provinceOf, walkInOffered } from './geography.ts';

const good: DraftForm = {
  ...EMPTY_DRAFT, publicCode: 'rdf-2026-a', campaignLabel: 'RDF General Enlistment 2026', targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['NYAGATARE', 'GASABO'],
  registrationOpensAt: '2026-11-01T08:00', registrationClosesAt: '2026-11-10T17:00', examinationStartDate: '2026-11-15', examinationEndDate: '2026-11-16', examinationReportingHour: '7',
};

describe('Kigali time', () => {
  it('is a fixed +02:00 offset both ways', () => {
    expect(kigaliLocalToInstant('2026-11-01T08:00')).toBe('2026-11-01T08:00:00+02:00');
    expect(instantToKigaliLocal('2026-11-01T06:00:00Z')).toBe('2026-11-01T08:00');
    expect(kigaliLocalToInstant('nope')).toBeNull();
  });
  it('lists the exam days inclusively', () => expect(daysBetween('2026-11-15', '2026-11-17')).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']));
});

describe('draft form', () => {
  it('accepts a complete form and normalises the command', () => {
    expect(validateDraft(good, 'RDF')).toEqual({});
    const cmd = toCreateCommand(good, 'RDF');
    expect(cmd.publicCode).toBe('RDF-2026-A');
    expect(cmd.registrationClosesAt).toBe('2026-11-10T17:00:00+02:00');
    expect(cmd.targetDistricts).toEqual(['GASABO', 'NYAGATARE']);
    expect(cmd).not.toHaveProperty('targetIntakeCount');
  });
  it('mirrors campaign-validation: code token, 50-char label, chronology, agency categories, walk-in policy', () => {
    const e = validateDraft({ ...good, publicCode: 'a b', campaignLabel: 'x'.repeat(51), targetCategories: ['CADET_OFFICER'], registrationClosesAt: '2026-10-01T00:00', examinationEndDate: '2026-11-01', allowsWalkIn: true }, 'RCS');
    expect(Object.keys(e).sort()).toEqual(['allowsWalkIn', 'campaignLabel', 'examinationEndDate', 'publicCode', 'registrationClosesAt', 'targetCategories']);
  });
  it('refuses to build a command from an invalid form', () => expect(() => toCreateCommand(EMPTY_DRAFT, 'RDF')).toThrow());
  it('routes server validation codes to fields', () => {
    expect(fieldOfServerError('INVALID_PUBLIC_CODE')).toBe('publicCode');
    expect(fieldOfServerError('INVALID_REGISTRATION_WINDOW')).toBe('registrationClosesAt');
    expect(fieldOfServerError('SOMETHING_ELSE')).toBeNull();
  });
  it('rejects dates that do not exist and the reserved code NEW', () => {
    expect(validateDraft({ ...good, examinationStartDate: '2026-02-31' }, 'RDF')).toHaveProperty('examinationStartDate');
    expect(kigaliLocalToInstant('2026-02-31T08:00')).toBeNull();
    expect(validateDraft({ ...good, publicCode: 'new' }, 'RDF')).toHaveProperty('publicCode');
  });
  it('keeps spaces inside phone numbers', () => {
    expect(toCreateCommand({ ...good, contactPhoneNumbers: '+250 788 000 000, +250 722 111 222' }, 'RDF').contactPhoneNumbers).toEqual(['+250 788 000 000', '+250 722 111 222']);
  });
  it('offers walk-in only where the policy allows it', () => {
    expect([walkInOffered('RDF'), walkInOffered('RNP'), walkInOffered('RCS')]).toEqual([true, false, false]);
  });
});

describe('policy v1', () => {
  const policy = (): ReturnType<typeof suggestPolicy> => {
    const s = suggestPolicy(['GENERAL_ENLISTMENT'], '2026-11-01');
    return { ...s, legalBasisCode: 'synthetic-rehearsal', legalBasisReference: 'ref', categories: { GENERAL_ENLISTMENT: { ...s.categories['GENERAL_ENLISTMENT']!, confirmed: true } } };
  };
  it('never defaults silently: a suggestion is unconfirmed and has no legal basis', () => {
    const s = suggestPolicy(['GENERAL_ENLISTMENT', 'CADET_OFFICER'], '2026-11-01');
    expect(validatePolicy(s, ['GENERAL_ENLISTMENT', 'CADET_OFFICER']).map((i) => i.key)).toEqual(expect.arrayContaining(['legalBasisCode', 'legalBasisReference', 'unconfirmed']));
    expect(() => toPolicyCommand('X', s, ['GENERAL_ENLISTMENT'])).toThrow();
  });
  it('copies the engine constants', () => {
    const c = toPolicyCommand('REH-1', policy(), ['GENERAL_ENLISTMENT']).policyDocument['GENERAL_ENLISTMENT']!;
    expect(c.age).toEqual({ minimumAge: 18, maximumAge: 25, referenceDate: '2026-11-01' });
    expect(c.education).toEqual({ mode: 'NESA_RESULTS', threshold: 'O_LEVEL_S3' });
    expect(c.requiredDocumentTypes).toEqual(['GOOD_CONDUCT_CERTIFICATE', 'NATIONAL_ID', 'NON_CONVICTION_CERTIFICATE', 'OLEVEL_CERTIFICATE']);
    expect(c.medicalMode).toBe('BOARD');
  });
  it('refuses a document the agency cannot store', () => {
    const p = policy();
    const c = p.categories['GENERAL_ENLISTMENT']!;
    expect(validatePolicy({ ...p, categories: { GENERAL_ENLISTMENT: { ...c, requiredDocumentTypes: ['CELIBACY_CERTIFICATE'] } } }, ['GENERAL_ENLISTMENT']).map((i) => i.key)).toContain('documentsAgency');
  });
  it('hashes over exactly the three fields, in sorted compact form, whatever the publicCode', async () => {
    const a = toPolicyCommand('A-1', policy(), ['GENERAL_ENLISTMENT']);
    const b = toPolicyCommand('B-2', policy(), ['GENERAL_ENLISTMENT']);
    expect(canonicalPolicyJson(a).startsWith('{"legalBasisCode":"SYNTHETIC-REHEARSAL","legalBasisReference":"ref","policyDocument":{"GENERAL_ENLISTMENT":{"age":{')).toBe(true);
    expect(await policyDigest(a)).toBe(await policyDigest(b));
    expect(await policyDigest(a)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('diffs against the previous version', () => {
    const a = toPolicyCommand('A-1', policy(), ['GENERAL_ENLISTMENT']);
    const p = policy();
    const c = p.categories['GENERAL_ENLISTMENT']!;
    const b = toPolicyCommand('A-1', { ...p, categories: { GENERAL_ENLISTMENT: { ...c, maximumAge: '27' } } }, ['GENERAL_ENLISTMENT']);
    expect(diffPolicy(a, b)).toEqual([{ path: 'policyDocument.GENERAL_ENLISTMENT.age.maximumAge', before: '25', after: '27' }]);
    expect(diffPolicy(null, a).length).toBeGreaterThan(5);
  });
});

describe('sessions and coverage', () => {
  const form = { venueName: ' Gasabo Stadium ', examDate: '2026-11-15', reportingTimeHour: '7', capacityMode: 'BOUNDED' as const, capacityLimit: '500', isActive: true };
  it('derives the province from the district and states the unbounded decision explicitly', () => {
    expect(provinceOf('NYAGATARE')).toBe('EASTERN_PROVINCE');
    expect(toSessionCommand('C-1', 'GASABO', form)).toMatchObject({ province: 'KIGALI_CITY', venueName: 'Gasabo Stadium', capacityLimit: 500 });
    const open = toSessionCommand('C-1', 'GASABO', { ...form, capacityMode: 'UNBOUNDED' });
    expect(open.capacityLimit).toBeNull();
    expect(open.capacityDecisionCode).toBe('UNBOUNDED_CAPACITY');
    expect(toSessionCommand('C-1', 'GASABO', form)).not.toHaveProperty('capacityDecisionCode');
  });
  it('validates against the exam window', () => {
    expect(validateSession({ ...form, examDate: '2026-12-01', capacityLimit: '0' }, { start: '2026-11-15', end: '2026-11-16' })).toEqual({ examDate: 'sessionOutsideWindow', capacityLimit: 'capacity' });
  });
  it('counts only active sessions as coverage', () => {
    const s = (district: string, isActive: boolean): never => ({ district, isActive } as never);
    expect(coverageOf(['A', 'B', 'C'], [s('A', true), s('B', false)])).toMatchObject({ covered: ['A'], missing: ['B', 'C'], total: 3 });
  });
});

describe('preflight', () => {
  const detail = (over: Partial<CampaignAdminDetail> = {}): CampaignAdminDetail => ({
    ...{ publicCode: 'C-1', campaignLabel: 'L', status: 'DRAFT', targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['GASABO'], registrationOpensAt: '2026-11-01T00:00:00Z', registrationClosesAt: '2026-11-10T00:00:00Z', examinationStartDate: '2026-11-15', examinationEndDate: '2026-11-16', allowsWalkIn: false, targetIntakeCount: null, publishedAt: null, createdAt: '2026-10-01T00:00:00Z', occupancy: { sessionCount: 1, capacityTotal: 5, hasUnboundedSession: false, registeredTotal: 0 } },
    contactPhoneNumbers: null, contactWebsite: null, announcementReference: null, registrationClosedAt: null, cancelledAt: null,
    policy: { versionNumber: 1, policyHash: 'h', hashVersion: 1, legalBasisCode: 'X', createdAt: '2026-10-01T00:00:00Z' }, coverage: { version: 1, hash: 'c' },
    sessions: [{ district: 'GASABO', province: 'KIGALI_CITY', venueName: 'V', examDate: '2026-11-15', reportingTimeHour: 7, capacityLimit: 5, capacityDecisionCode: null, registeredCount: 0, remaining: 5, isActive: true }],
    history: [], ...over,
  });
  it('passes a complete draft', () => expect(canPublish(preflight(detail()))).toBe(true));
  it('fails each gate it should', () => {
    const failing = (d: CampaignAdminDetail): string[] => preflight(d).filter((i) => !i.ok).map((i) => i.id);
    expect(failing(detail({ policy: null }))).toEqual(['policy']);
    expect(failing(detail({ sessions: [] }))).toEqual(['coverage', 'capacity']);
    expect(failing(detail({ sessions: [{ ...detail().sessions[0]!, capacityLimit: null }] }))).toEqual(['capacity']);
    expect(failing(detail({ sessions: [{ ...detail().sessions[0]!, examDate: '2026-12-31' }] }))).toEqual(['windows']);
  });
  it('points a refusal to its step and never invents a zero count', () => {
    expect(stepOfRefusal('INCOMPLETE_COVERAGE')).toBe('sessions');
    expect(stepOfRefusal('POLICY_NOT_SET')).toBe('policy');
    expect(consequencesOf(detail())).toEqual({ registered: 0, sessions: 1 });
    expect(consequencesOf({ ...detail(), occupancy: undefined as never })).toEqual({ registered: null, sessions: null });
  });
});
