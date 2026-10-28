// ══════════════════════════════════════════════════════════════════
// campaigns — the basics form (step 1 of the control plane)
//
// PURE. Mirrors campaign-validation.ts `normalizeCampaignDraft` at the pinned
// backend SHA so an officer is told about a mistake before the round-trip. The
// server stays authoritative: its refusal is rendered per field through
// `fieldOfServerError`, never swallowed.
// ══════════════════════════════════════════════════════════════════

import type { CreateCampaignInput } from '@usrp/api-client';
import { CATEGORY_AGENCY, type Agency, type ApplicationCategory } from '@usrp/contracts';
import { isDistrict, walkInOffered } from './geography.ts';
import { kigaliLocalToInstant } from './kigali.ts';

export const PUBLIC_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,63}$/;
export const LABEL_MAX = 50;
export const CONTACT_PHONES_MAX = 10;

export interface DraftForm {
  readonly publicCode: string;
  readonly campaignLabel: string;
  readonly targetCategories: readonly string[];
  readonly targetDistricts: readonly string[];
  /** Kigali wall clock, "YYYY-MM-DDTHH:mm". */
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly examinationStartDate: string;
  readonly examinationEndDate: string;
  readonly examinationReportingHour: string;
  readonly allowsWalkIn: boolean;
  readonly targetIntakeCount: string;
  /** One number per line. */
  readonly contactPhoneNumbers: string;
  readonly contactWebsite: string;
}

export const EMPTY_DRAFT: DraftForm = {
  publicCode: '', campaignLabel: '', targetCategories: [], targetDistricts: [],
  registrationOpensAt: '', registrationClosesAt: '', examinationStartDate: '', examinationEndDate: '',
  examinationReportingHour: '', allowsWalkIn: false, targetIntakeCount: '', contactPhoneNumbers: '', contactWebsite: '',
};

export type DraftField = keyof DraftForm;
/** field → i18n key under `campaigns.errors.*` */
export type DraftErrors = Partial<Record<DraftField, string>>;

export function categoriesOfAgency(agency: string): readonly ApplicationCategory[] {
  return (Object.keys(CATEGORY_AGENCY) as ApplicationCategory[]).filter((c) => CATEGORY_AGENCY[c] === (agency as Agency));
}

export function normalisePublicCode(value: string): string {
  return value.trim().normalize('NFC').toUpperCase();
}

export function parsePhones(raw: string): readonly string[] {
  return raw.split('\n').map((s) => s.trim()).filter((s) => s !== '');
}

/** PURE. The per-field problems with `form` for an officer of `agency`; empty when it can be sent. */
export function validateDraft(form: DraftForm, agency: string): DraftErrors {
  const e: Record<string, string> = {};
  const code = normalisePublicCode(form.publicCode);
  if (!PUBLIC_CODE_RE.test(code) || code.startsWith('LEGACY-')) e['publicCode'] = 'publicCode';
  const label = form.campaignLabel.trim();
  if (label === '') e['campaignLabel'] = 'labelRequired';
  else if (Array.from(label.normalize('NFC')).length > LABEL_MAX) e['campaignLabel'] = 'labelTooLong';

  const own = new Set<string>(categoriesOfAgency(agency));
  if (form.targetCategories.length === 0) e['targetCategories'] = 'categoriesRequired';
  else if (form.targetCategories.some((c) => !own.has(c))) e['targetCategories'] = 'categoryAgency';
  if (form.targetDistricts.length === 0) e['targetDistricts'] = 'districtsRequired';
  else if (form.targetDistricts.some((d) => !isDistrict(d))) e['targetDistricts'] = 'districtsRequired';

  const opens = kigaliLocalToInstant(form.registrationOpensAt);
  const closes = kigaliLocalToInstant(form.registrationClosesAt);
  if (opens === null) e['registrationOpensAt'] = 'dateRequired';
  if (closes === null) e['registrationClosesAt'] = 'dateRequired';
  if (opens !== null && closes !== null && Date.parse(opens) >= Date.parse(closes)) e['registrationClosesAt'] = 'registrationWindow';

  const dateOk = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
  if (!dateOk(form.examinationStartDate)) e['examinationStartDate'] = 'dateRequired';
  if (!dateOk(form.examinationEndDate)) e['examinationEndDate'] = 'dateRequired';
  if (dateOk(form.examinationStartDate) && dateOk(form.examinationEndDate) && form.examinationStartDate > form.examinationEndDate) e['examinationEndDate'] = 'examinationWindow';
  // Not in the server's rule but the control plane's intent: exams follow registration.
  if (closes !== null && dateOk(form.examinationStartDate) && form.examinationStartDate < closes.slice(0, 10)) e['examinationStartDate'] = 'examBeforeRegistrationCloses';

  const hour = Number(form.examinationReportingHour);
  if (form.examinationReportingHour.trim() === '' || !Number.isInteger(hour) || hour < 0 || hour > 23) e['examinationReportingHour'] = 'reportingHour';

  if (form.targetIntakeCount.trim() !== '') {
    const n = Number(form.targetIntakeCount);
    if (!Number.isSafeInteger(n) || n < 1) e['targetIntakeCount'] = 'intake';
  }
  const phones = parsePhones(form.contactPhoneNumbers);
  if (phones.length > CONTACT_PHONES_MAX || phones.some((p) => p.length > 40)) e['contactPhoneNumbers'] = 'phones';
  if (form.contactWebsite.trim() !== '') {
    try {
      const u = new URL(form.contactWebsite.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') e['contactWebsite'] = 'website';
    } catch {
      e['contactWebsite'] = 'website';
    }
  }
  if (form.allowsWalkIn && !walkInOffered(agency)) e['allowsWalkIn'] = 'walkIn';
  return e as DraftErrors;
}

/** PURE. The create-campaign body for a VALID form. Throws if the form is not valid. */
export function toCreateCommand(form: DraftForm, agency: string): CreateCampaignInput {
  if (Object.keys(validateDraft(form, agency)).length > 0) throw new Error('toCreateCommand: the form is not valid');
  const phones = parsePhones(form.contactPhoneNumbers);
  const site = form.contactWebsite.trim();
  return {
    publicCode: normalisePublicCode(form.publicCode),
    campaignLabel: form.campaignLabel.trim().normalize('NFC'),
    targetCategories: [...form.targetCategories].sort() as CreateCampaignInput['targetCategories'],
    targetDistricts: [...form.targetDistricts].sort(),
    registrationOpensAt: kigaliLocalToInstant(form.registrationOpensAt) as string,
    registrationClosesAt: kigaliLocalToInstant(form.registrationClosesAt) as string,
    examinationStartDate: form.examinationStartDate,
    examinationEndDate: form.examinationEndDate,
    examinationReportingHour: Number(form.examinationReportingHour),
    allowsWalkIn: form.allowsWalkIn,
    ...(form.targetIntakeCount.trim() === '' ? {} : { targetIntakeCount: Number(form.targetIntakeCount) }),
    ...(phones.length === 0 ? {} : { contactPhoneNumbers: phones }),
    ...(site === '' ? {} : { contactWebsite: site }),
  };
}

/** The form field a server-side validation code belongs to, so its 400/422 lands on the field. */
export function fieldOfServerError(code: string): DraftField | null {
  switch (code) {
    case 'INVALID_PUBLIC_CODE': case 'PUBLIC_CODE_ALREADY_EXISTS': return 'publicCode';
    case 'CAMPAIGN_LABEL_ALREADY_EXISTS': return 'campaignLabel';
    case 'CATEGORY_AGENCY_MISMATCH': return 'targetCategories';
    case 'INVALID_REGISTRATION_WINDOW': case 'INVALID_TIMESTAMP': return 'registrationClosesAt';
    case 'INVALID_EXAMINATION_WINDOW': case 'INVALID_DATE': return 'examinationEndDate';
    case 'INVALID_CONTACT_WEBSITE': return 'contactWebsite';
    default: return null;
  }
}
