// ══════════════════════════════════════════════════════════════════
// campaigns — the selection policy, contract v1 (step 2 of the control plane)
//
// ONE MODULE owns the policy document's shape (S12c adopts policy v2, ADR-049,
// by replacing this module and its editor, not by touching the rest of the
// Studio). PURE.
//
// The platform supplies NO official thresholds (BUILD-001): every value the
// Studio shows as a starting point is a SUGGESTION copied from the eligibility
// engine's constants, labelled as such, and the officer must confirm each
// category before the command can be sent. Nothing is defaulted silently.
//
// Hash: the edge returns the SHA-256 of canonical JSON v1 over exactly
// { legalBasisCode, legalBasisReference, policyDocument } (BUILD-001 "Canonical
// hashes"). `policyDigest` recomputes it on this device so the officer sees the
// returned hash independently confirmed, and so the Studio and `pnpm rehearse`
// are comparable for the same inputs.
// ══════════════════════════════════════════════════════════════════

import type { CampaignCategoryPolicy, CreateCampaignPolicyInput } from '@usrp/api-client';
import { isRealDate } from './kigali.ts';
import { AGENCY_DOCUMENT_TYPES, CATEGORY_AGENCY, type Agency, type ApplicationCategory } from '@usrp/contracts';

export const POLICY_CONTRACT_VERSION = 1;
export const EDUCATION_MODES = ['NESA_RESULTS', 'HEC_DEGREE'] as const;
export const EDUCATION_LEVELS = ['O_LEVEL_S3', 'O_LEVEL_S6_EQUIV', 'A_LEVEL_A2', 'A1_IPRC', 'BACHELOR_A0', 'MASTERS', 'PHD'] as const;
export const CRIMINAL_THRESHOLDS = ['ANY_CONVICTION', 'IMPRISONMENT_GT_6MO', 'IMPRISONMENT_GTE_6MO'] as const;
export const MEDICAL_MODES = ['BOARD', 'CERTIFICATE'] as const;
export const SUGGESTION_LEGAL_BASIS_CODE = 'SYNTHETIC-REHEARSAL';

/** ADR-013: RDF runs an in-house medical board; RNP and RCS verify a government-physician certificate. */
const MEDICAL_MODE_BY_AGENCY: Readonly<Record<Agency, (typeof MEDICAL_MODES)[number]>> = { RDF: 'BOARD', RNP: 'CERTIFICATE', RCS: 'CERTIFICATE' };

interface EngineRow {
  readonly min: number;
  readonly max: number;
  readonly level: (typeof EDUCATION_LEVELS)[number];
  readonly hec: boolean;
  readonly criminal: (typeof CRIMINAL_THRESHOLDS)[number];
  readonly docs: readonly string[];
}

const DOCS_RDF = ['NATIONAL_ID', 'GOOD_CONDUCT_CERTIFICATE', 'NON_CONVICTION_CERTIFICATE'];
const DOCS_RCS = ['NATIONAL_ID', 'GOOD_CONDUCT_CERTIFICATE', 'NON_CONVICTION_CERTIFICATE', 'CELIBACY_CERTIFICATE', 'MEDICAL_CERTIFICATE_GOVT'];

/**
 * The eligibility engine's constants (AGE_CRITERIA, EDUCATION_REQUIREMENTS,
 * CRIMINAL_THRESHOLD_BY_CATEGORY, REQUIRED_DOCUMENTS), transcribed from the
 * backend shared-types at the pinned SHA. SUGGESTIONS only.
 */
const ENGINE: Readonly<Record<ApplicationCategory, EngineRow>> = {
  GENERAL_ENLISTMENT: { min: 18, max: 25, level: 'O_LEVEL_S3', hec: false, criminal: 'ANY_CONVICTION', docs: [...DOCS_RDF, 'OLEVEL_CERTIFICATE'] },
  RESERVE_FORCE_ALEVEL: { min: 18, max: 25, level: 'A_LEVEL_A2', hec: false, criminal: 'ANY_CONVICTION', docs: [...DOCS_RDF, 'ALEVEL_CERTIFICATE'] },
  RESERVE_FORCE_UNIVERSITY: { min: 18, max: 26, level: 'A1_IPRC', hec: true, criminal: 'ANY_CONVICTION', docs: [...DOCS_RDF, 'DEGREE_DIPLOMA_COPY'] },
  RESERVE_FORCE_SPECIALIST: { min: 18, max: 27, level: 'BACHELOR_A0', hec: true, criminal: 'ANY_CONVICTION', docs: [...DOCS_RDF, 'DEGREE_DIPLOMA_COPY'] },
  CADET_OFFICER: { min: 18, max: 25, level: 'A1_IPRC', hec: true, criminal: 'IMPRISONMENT_GT_6MO', docs: ['APPLICATION_FORM_WITH_PHOTO', 'NATIONAL_ID', 'DEGREE_DIPLOMA_COPY', 'GOOD_CONDUCT_CERTIFICATE'] },
  BASIC_POLICE_COURSE: { min: 18, max: 25, level: 'A_LEVEL_A2', hec: false, criminal: 'IMPRISONMENT_GTE_6MO', docs: ['APPLICATION_FORM_WITH_PHOTO', 'NATIONAL_ID', 'ALEVEL_CERTIFICATE', 'GOOD_CONDUCT_CERTIFICATE'] },
  GENERAL_ENLISTEE: { min: 18, max: 25, level: 'A_LEVEL_A2', hec: false, criminal: 'ANY_CONVICTION', docs: [...DOCS_RCS, 'ALEVEL_CERTIFICATE'] },
  OFFICER_ONE_YEAR: { min: 18, max: 25, level: 'A1_IPRC', hec: true, criminal: 'ANY_CONVICTION', docs: [...DOCS_RCS, 'BIRTH_CERTIFICATE', 'DEGREE_DIPLOMA_NOTARIZED'] },
  OFFICER_ONE_YEAR_SPECIALIST: { min: 18, max: 27, level: 'BACHELOR_A0', hec: true, criminal: 'ANY_CONVICTION', docs: [...DOCS_RCS, 'BIRTH_CERTIFICATE', 'DEGREE_DIPLOMA_NOTARIZED'] },
  OFFICER_FOUR_YEAR_UR: { min: 18, max: 21, level: 'A_LEVEL_A2', hec: false, criminal: 'ANY_CONVICTION', docs: [...DOCS_RCS, 'BIRTH_CERTIFICATE', 'ALEVEL_CERTIFICATE'] },
};

/** One category's editable values; numbers stay strings until validated. */
export interface CategoryPolicyForm {
  readonly minimumAge: string;
  readonly maximumAge: string;
  readonly referenceDate: string;
  readonly educationMode: string;
  readonly educationThreshold: string;
  readonly criminalThreshold: string;
  readonly requiredDocumentTypes: readonly string[];
  readonly medicalMode: string;
  /** True once the officer has reviewed this category and confirmed its values. */
  readonly confirmed: boolean;
}

export interface PolicyForm {
  readonly legalBasisCode: string;
  readonly legalBasisReference: string;
  readonly categories: Readonly<Record<string, CategoryPolicyForm>>;
}

/** PURE. The engine-constant SUGGESTION for one category: always `confirmed: false`. */
export function suggestCategory(category: string, referenceDate: string): CategoryPolicyForm {
  const row = ENGINE[category as ApplicationCategory];
  const agency = CATEGORY_AGENCY[category as ApplicationCategory];
  if (row === undefined || agency === undefined) throw new Error(`suggestCategory: unknown category ${category}`);
  return {
    minimumAge: String(row.min),
    maximumAge: String(row.max),
    referenceDate,
    educationMode: row.hec ? 'HEC_DEGREE' : 'NESA_RESULTS',
    educationThreshold: row.level,
    criminalThreshold: row.criminal,
    requiredDocumentTypes: [...row.docs].sort(),
    medicalMode: MEDICAL_MODE_BY_AGENCY[agency],
    confirmed: false,
  };
}

/** PURE. A suggestion for every target category; nothing confirmed, legal basis left for the officer. */
export function suggestPolicy(categories: readonly string[], referenceDate: string): PolicyForm {
  return {
    legalBasisCode: '',
    legalBasisReference: '',
    categories: Object.fromEntries([...categories].sort().map((c) => [c, suggestCategory(c, referenceDate)])),
  };
}

/** Document types the agency of `category` can store (the server refuses any other). */
export function acceptedDocumentTypes(category: string): readonly string[] {
  const agency = CATEGORY_AGENCY[category as ApplicationCategory];
  return agency === undefined ? [] : [...AGENCY_DOCUMENT_TYPES[agency]].sort();
}

export type PolicyIssue = { readonly category: string | null; readonly field: string; readonly key: string };

const CODE_TOKEN = /^[A-Z0-9][A-Z0-9_:-]{0,63}$/;

/** PURE. Every reason `form` cannot be sent for `categories`; empty means complete and confirmed. */
export function validatePolicy(form: PolicyForm, categories: readonly string[]): readonly PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const code = form.legalBasisCode.trim().toUpperCase();
  if (!CODE_TOKEN.test(code)) issues.push({ category: null, field: 'legalBasisCode', key: 'legalBasisCode' });
  const ref = form.legalBasisReference.trim();
  if (ref === '' || ref.length > 256) issues.push({ category: null, field: 'legalBasisReference', key: 'legalBasisReference' });
  for (const category of categories) {
    const c = form.categories[category];
    if (c === undefined) { issues.push({ category, field: 'category', key: 'missing' }); continue; }
    const min = Number(c.minimumAge);
    const max = Number(c.maximumAge);
    if (c.minimumAge.trim() === '' || !Number.isInteger(min) || min < 0 || min > 130) issues.push({ category, field: 'minimumAge', key: 'age' });
    if (c.maximumAge.trim() === '' || !Number.isInteger(max) || max < 0 || max > 130) issues.push({ category, field: 'maximumAge', key: 'age' });
    else if (Number.isInteger(min) && min > max) issues.push({ category, field: 'maximumAge', key: 'ageOrder' });
    if (!isRealDate(c.referenceDate)) issues.push({ category, field: 'referenceDate', key: 'date' });
    if (!(EDUCATION_MODES as readonly string[]).includes(c.educationMode)) issues.push({ category, field: 'educationMode', key: 'required' });
    if (c.educationThreshold.trim() === '') issues.push({ category, field: 'educationThreshold', key: 'required' });
    if (!(CRIMINAL_THRESHOLDS as readonly string[]).includes(c.criminalThreshold)) issues.push({ category, field: 'criminalThreshold', key: 'required' });
    if (!(MEDICAL_MODES as readonly string[]).includes(c.medicalMode)) issues.push({ category, field: 'medicalMode', key: 'required' });
    const accepted = new Set(acceptedDocumentTypes(category));
    if (c.requiredDocumentTypes.length === 0) issues.push({ category, field: 'requiredDocumentTypes', key: 'documents' });
    else if (c.requiredDocumentTypes.some((d) => !accepted.has(d))) issues.push({ category, field: 'requiredDocumentTypes', key: 'documentsAgency' });
    if (!c.confirmed) issues.push({ category, field: 'confirmed', key: 'unconfirmed' });
  }
  return issues;
}

/** PURE. The create-policy body for a VALID form, in the server's normalised form (codes upper-case, documents sorted). */
export function toPolicyCommand(publicCode: string, form: PolicyForm, categories: readonly string[]): CreateCampaignPolicyInput {
  if (validatePolicy(form, categories).length > 0) throw new Error('toPolicyCommand: the policy is not valid');
  const code = form.legalBasisCode.trim().toUpperCase();
  const reference = form.legalBasisReference.trim().normalize('NFC');
  const policyDocument: Record<string, CampaignCategoryPolicy> = {};
  for (const category of [...categories].sort()) {
    const c = form.categories[category] as CategoryPolicyForm;
    policyDocument[category] = {
      age: { minimumAge: Number(c.minimumAge), maximumAge: Number(c.maximumAge), referenceDate: c.referenceDate },
      education: { mode: c.educationMode, threshold: c.educationThreshold.trim() },
      criminalThreshold: c.criminalThreshold,
      requiredDocumentTypes: [...c.requiredDocumentTypes].sort(),
      medicalMode: c.medicalMode,
      legalBasis: { code, reference },
    };
  }
  return { publicCode, policyDocument, legalBasisCode: code, legalBasisReference: reference };
}

// ── Canonical hash v1 ───────────────────────────────────────────

function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k.normalize('NFC'), v] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** PURE. The bytes the policy digest covers: exactly the three fields, publicCode excluded. */
export function canonicalPolicyJson(cmd: CreateCampaignPolicyInput): string {
  return canonical({ legalBasisCode: cmd.legalBasisCode, legalBasisReference: cmd.legalBasisReference, policyDocument: cmd.policyDocument });
}

/** The lower-case hex SHA-256 the edge should return for `cmd`; null where WebCrypto is unavailable. */
export async function policyDigest(cmd: CreateCampaignPolicyInput): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return null;
  const bytes = new TextEncoder().encode(canonicalPolicyJson(cmd));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Diff against the previous version ───────────────────────────

export interface PolicyChange { readonly path: string; readonly before: string | null; readonly after: string | null }

function flatten(value: unknown, path: string, out: Map<string, string>): void {
  if (Array.isArray(value)) out.set(path, value.join(', '));
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, path === '' ? k : `${path}.${k}`, out);
  else out.set(path, String(value));
}

/** PURE. Field-by-field differences between two policy commands, in path order. */
export function diffPolicy(before: CreateCampaignPolicyInput | null, after: CreateCampaignPolicyInput): readonly PolicyChange[] {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  if (before !== null) flatten({ legalBasisCode: before.legalBasisCode, legalBasisReference: before.legalBasisReference, policyDocument: before.policyDocument }, '', a);
  flatten({ legalBasisCode: after.legalBasisCode, legalBasisReference: after.legalBasisReference, policyDocument: after.policyDocument }, '', b);
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
  return paths.filter((p) => a.get(p) !== b.get(p)).map((path) => ({ path, before: a.get(path) ?? null, after: b.get(path) ?? null }));
}
