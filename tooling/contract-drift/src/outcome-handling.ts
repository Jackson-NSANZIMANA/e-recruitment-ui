// Gate E's outcome evidence: for each operation a screen calls, the 409/422 codes
// it handles and WHERE. A const here is a claim, so `verifyOutcomeHandling` checks
// the named source really contains the handling and, where a code has its own
// message, that the message exists in all three languages. Run by the selftest.

export const OUTCOMES_FILE = 'tooling/contract-drift/src/outcome-handling.ts';

export const CREATE_CAMPAIGN_OUTCOMES = ['PUBLIC_CODE_ALREADY_EXISTS', 'CAMPAIGN_LABEL_ALREADY_EXISTS', 'CAMPAIGN_WRITE_CONFLICT', 'IDEMPOTENCY_KEY_REUSED', 'CATEGORY_AGENCY_MISMATCH', 'INVALID_REGISTRATION_WINDOW', 'INVALID_EXAMINATION_WINDOW'] as const;
export const CREATE_CAMPAIGN_POLICY_OUTCOMES = ['INVALID_STATE', 'POLICY_VERSION_CONFLICT', 'POLICY_HASH_MISMATCH', 'IDEMPOTENCY_KEY_REUSED', 'INVALID_POLICY', 'POLICY_CATEGORY_COVERAGE_MISMATCH'] as const;
export const CONFIGURE_CAMPAIGN_SESSION_OUTCOMES = ['INVALID_STATE', 'SESSION_ALREADY_RESERVED', 'STALE_COVERAGE', 'INCOMPLETE_COVERAGE', 'CAPACITY_DECISION_REQUIRED', 'IDEMPOTENCY_KEY_REUSED', 'INVALID_SESSION_CONFIGURATION', 'INVALID_SESSION_DATE', 'INVALID_REPORTING_HOUR', 'DISTRICT_PROVINCE_MISMATCH'] as const;
export const PUBLISH_CAMPAIGN_OUTCOMES = ['INVALID_STATE', 'POLICY_NOT_SET', 'INCOMPLETE_COVERAGE', 'STALE_COVERAGE', 'POLICY_HASH_MISMATCH', 'INVALID_CAPACITY', 'CAPACITY_DECISION_REQUIRED', 'IDEMPOTENCY_KEY_REUSED'] as const;
export const CLOSE_CAMPAIGN_REGISTRATION_OUTCOMES = ['INVALID_STATE', 'IDEMPOTENCY_KEY_REUSED'] as const;
export const COMPLETE_CAMPAIGN_OUTCOMES = ['INVALID_STATE', 'IDEMPOTENCY_KEY_REUSED'] as const;
export const CANCEL_CAMPAIGN_OUTCOMES = ['INVALID_STATE', 'CANCELLATION_HAS_APPLICATIONS', 'IDEMPOTENCY_KEY_REUSED'] as const;
export const CREATE_OFFICER_OUTCOMES = ['HANDLE_TAKEN', 'INVALID_HANDLE', 'INVALID_POSTS', 'UNKNOWN_POST'] as const;
export const RELEASE_OFFICER_ACTIVATION_OUTCOMES = ['NOT_PENDING_ACTIVATION', 'ALREADY_RELEASED', 'ACTIVATION_EXPIRED'] as const;
export const REISSUE_OFFICER_ACTIVATION_OUTCOMES = ['NOT_PENDING_ACTIVATION'] as const;
export const ASSIGN_OFFICER_POSTS_OUTCOMES = ['INVALID_POSTS', 'UNKNOWN_POST', 'INVALID_REASON'] as const;
export const DISABLE_OFFICER_OUTCOMES = ['LAST_ACTIVE_ADMIN', 'INVALID_REASON'] as const;
export const ENABLE_OFFICER_OUTCOMES = ['INVALID_REASON'] as const;
export const REVOKE_OFFICER_SESSIONS_OUTCOMES = ['INVALID_REASON'] as const;
export const RECORD_MEDICAL_REVIEW_OUTCOMES = ['INVALID_MEDICAL_INPUT', 'ILLEGAL_TRANSITION'] as const;
export const ACCEPT_APPLICATION_OUTCOMES = ['ILLEGAL_TRANSITION', 'CROSS_AGENCY_ACCEPT_LOCK'] as const;
export const RECORD_FINAL_DECISION_OUTCOMES = ['ILLEGAL_TRANSITION'] as const;
export const ADJUDICATE_APPLICATION_OUTCOMES = ['ILLEGAL_TRANSITION', 'ADJUDICATION_LANE_REQUIRED'] as const;
export const VET_WALK_IN_OUTCOMES = ['AGE_PENDING', 'ILLEGAL_TRANSITION', 'VALIDATION_FAILED'] as const;
export const VERIFY_IDENTITY_OUTCOMES = ['NOT_A_CITIZEN'] as const;
export const SUBMIT_MY_APPLICATION_OUTCOMES = ['ALREADY_APPLIED', 'IDENTITY_NOT_VERIFIED', 'NO_OPEN_CAMPAIGN', 'KEY_REUSED'] as const;
export const ATTACH_MY_CLEARANCE_CERTIFICATE_OUTCOMES = ['APPLICATION_CLOSED', 'CLEARANCE_NUMBER_MALFORMED'] as const;
export const UPLOAD_MY_DOCUMENT_OUTCOMES = ['NOT_ACCEPTING_DOCUMENTS', 'DOCUMENT_REVIEW_CLOSED'] as const;
export const ENROLL_FIELD_DEVICE_OUTCOMES = ['DEVICE_REVOKED'] as const;
export const RESOLVE_FIELD_SYNC_CONFLICT_OUTCOMES = ['NO_CONFLICT'] as const;
export const DECIDE_ERASURE_REQUEST_OUTCOMES = ['NOT_PENDING', 'REFUSED_ACTIVE_APPLICATION', 'REFUSED_ACCEPT_LOCKED'] as const;

export interface OutcomeHandling {
  readonly op: string;
  readonly codes: readonly string[];
  /** The file that handles these codes. */
  readonly source: string;
  /** Text that must appear there: the branch or lookup that does the handling. */
  readonly token: string;
  /** When set, every code needs its own message at this key path. */
  readonly keyPrefix?: string;
  readonly locales?: string;
}

export const OUTCOME_HANDLING: readonly OutcomeHandling[] = [
  { op: 'createCampaign', codes: CREATE_CAMPAIGN_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'createCampaignPolicy', codes: CREATE_CAMPAIGN_POLICY_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'configureCampaignSession', codes: CONFIGURE_CAMPAIGN_SESSION_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'publishCampaign', codes: PUBLISH_CAMPAIGN_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'closeCampaignRegistration', codes: CLOSE_CAMPAIGN_REGISTRATION_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'completeCampaign', codes: COMPLETE_CAMPAIGN_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'cancelCampaign', codes: CANCEL_CAMPAIGN_OUTCOMES, source: 'packages/features/campaigns/src/api/campaigns.ts', token: "campaignRefusalKey", keyPrefix: 'campaigns.refusals.', locales: 'packages/features/campaigns/locales' },
  { op: 'createOfficer', codes: CREATE_OFFICER_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'releaseOfficerActivation', codes: RELEASE_OFFICER_ACTIVATION_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'reissueOfficerActivation', codes: REISSUE_OFFICER_ACTIVATION_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'assignOfficerPosts', codes: ASSIGN_OFFICER_POSTS_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'disableOfficer', codes: DISABLE_OFFICER_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'enableOfficer', codes: ENABLE_OFFICER_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'revokeOfficerSessions', codes: REVOKE_OFFICER_SESSIONS_OUTCOMES, source: 'packages/features/identity/src/ui/StaffPage.tsx', token: "identity.staff.refusals.${code}", keyPrefix: 'identity.staff.refusals.', locales: 'packages/features/identity/locales' },
  { op: 'recordMedicalReview', codes: RECORD_MEDICAL_REVIEW_OUTCOMES, source: 'packages/features/applications/src/ui/ActionPanels.tsx', token: "o.kind === 'conflict'" },
  { op: 'acceptApplication', codes: ACCEPT_APPLICATION_OUTCOMES, source: 'packages/features/applications/src/ui/ActionPanels.tsx', token: "o.kind === 'conflict'" },
  { op: 'recordFinalDecision', codes: RECORD_FINAL_DECISION_OUTCOMES, source: 'packages/features/adjudication/src/ui/QueuesPage.tsx', token: "adjudication.errors.refused" },
  { op: 'adjudicateApplication', codes: ADJUDICATE_APPLICATION_OUTCOMES, source: 'packages/features/adjudication/src/ui/QueuesPage.tsx', token: "n.outcome === 'ADJUDICATION_LANE_REQUIRED'" },
  { op: 'vetWalkIn', codes: VET_WALK_IN_OUTCOMES, source: 'packages/features/field-ops/src/routes/walk-in.tsx', token: "setVetFailed(true)" },
  { op: 'verifyIdentity', codes: VERIFY_IDENTITY_OUTCOMES, source: 'packages/features/field-ops/src/model/walk-in.ts', token: "WALK_IN_VERIFY_REFUSALS", keyPrefix: 'walk_in.refusals.', locales: 'packages/i18n/src/locales' },
  { op: 'submitMyApplication', codes: SUBMIT_MY_APPLICATION_OUTCOMES, source: 'apps/applicant-portal/src/routes/apply/index.tsx', token: "apply.conflicts.${error.outcome}" },
  { op: 'attachMyClearanceCertificate', codes: ATTACH_MY_CLEARANCE_CERTIFICATE_OUTCOMES, source: 'apps/applicant-portal/src/routes/documents/index.tsx', token: "citizen_docs.clearance.failed" },
  { op: 'uploadMyDocument', codes: UPLOAD_MY_DOCUMENT_OUTCOMES, source: 'apps/applicant-portal/src/routes/apply/index.tsx', token: "apply.upload_refusals.${code}" },
  { op: 'enrollFieldDevice', codes: ENROLL_FIELD_DEVICE_OUTCOMES, source: 'packages/features/field-ops/src/routes/setup.tsx', token: "n?.kind === 'conflict' ? 'revoked'" },
  { op: 'resolveFieldSyncConflict', codes: RESOLVE_FIELD_SYNC_CONFLICT_OUTCOMES, source: 'packages/features/field-ops/src/routes/conflicts.tsx', token: "NO_CONFLICT" },
  { op: 'decideErasureRequest', codes: DECIDE_ERASURE_REQUEST_OUTCOMES, source: 'packages/features/compliance/src/ui/DpoQueuePage.tsx', token: "n.outcome === 'NOT_PENDING'" },
];

/** A message file: a feature's `<lang>.json`, or the shared `<lang>/common.json`. */
function messagesOf(root: string, dir: string, lang: string, read: (path: string) => string | null): unknown {
  const text = read(`${root}/${dir}/${lang}.json`) ?? read(`${root}/${dir}/${lang}/common.json`);
  return text === null ? null : JSON.parse(text);
}

function hasKey(messages: unknown, key: string): boolean {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.trim() !== '';
}

/** Problems with the handling claimed above. Empty means every claim holds. */
export function verifyOutcomeHandling(
  root: string,
  read: (path: string) => string | null,
  table: readonly OutcomeHandling[] = OUTCOME_HANDLING,
): readonly string[] {
  const problems: string[] = [];
  for (const entry of table) {
    const source = read(`${root}/${entry.source}`);
    if (source === null) problems.push(`${entry.op}: ${entry.source} does not exist`);
    else if (!source.includes(entry.token)) problems.push(`${entry.op}: ${entry.source} no longer contains ${entry.token}`);
    if (entry.keyPrefix === undefined || entry.locales === undefined) continue;
    for (const lang of ['en', 'fr', 'rw']) {
      const messages = messagesOf(root, entry.locales, lang, read);
      for (const code of entry.codes) {
        if (!hasKey(messages, `${entry.keyPrefix}${code}`)) problems.push(`${entry.op}: ${lang} has no ${entry.keyPrefix}${code}`);
      }
    }
  }
  return problems;
}
