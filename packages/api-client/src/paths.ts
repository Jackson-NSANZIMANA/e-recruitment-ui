import { BROWSER_ROUTES, ROUTE_TABLE, SERVICE_INTERNAL_ROUTES, type RouteFact } from '@usrp/contracts';

export interface EdgeOperation {
  readonly id: string;
  readonly method: 'GET' | 'POST';
  readonly edgePath: string;
  readonly upstreamOperationId: string | null;
  readonly session: 'officer' | 'applicant' | 'anonymous';
  readonly retryOnG2G: boolean;
  readonly composition?: 'single' | 'composed' | 'local';
  readonly composedOf?: readonly string[];
  readonly compositionReason?: string;
}

/**
 * Browser edge contract baseline. This is the backend commit checked out by CI
 * and reconciled by contract-drift gate D. Keep this next to the operation
 * registry so a pending operation cannot quietly outlive its evidence.
 */
export const EDGE_BACKEND_SHA = 'b004fca840af12435bbc84ec0e365c513c788c36' as const;

export const EDGE_OPERATIONS = [
  { id: 'officerLogin', method: 'POST', edgePath: '/edge/v1/auth/officer/login', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'officerLogout', method: 'POST', edgePath: '/edge/v1/auth/officer/logout', upstreamOperationId: null, session: 'officer', retryOnG2G: false, composition: 'local' },
  { id: 'beginApplicantOnboarding', method: 'POST', edgePath: '/edge/v1/auth/applicant/identity', upstreamOperationId: 'beginApplicantOnboarding', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'listCampaigns', method: 'GET', edgePath: '/edge/v1/campaigns', upstreamOperationId: 'listPublicCampaigns', session: 'anonymous', retryOnG2G: true, composition: 'single' },
  { id: 'getCampaignDetail', method: 'GET', edgePath: '/edge/v1/campaigns/detail', upstreamOperationId: 'getPublicCampaign', session: 'anonymous', retryOnG2G: true, composition: 'single' },
  { id: 'createCampaign', method: 'POST', edgePath: '/edge/v1/campaigns', upstreamOperationId: 'createCampaign', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'createCampaignPolicy', method: 'POST', edgePath: '/edge/v1/campaigns/policy', upstreamOperationId: 'createCampaignPolicy', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'configureCampaignSession', method: 'POST', edgePath: '/edge/v1/campaigns/session', upstreamOperationId: 'configureCampaignSession', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'publishCampaign', method: 'POST', edgePath: '/edge/v1/campaigns/publish', upstreamOperationId: 'publishCampaign', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'closeCampaignRegistration', method: 'POST', edgePath: '/edge/v1/campaigns/registration-close', upstreamOperationId: 'closeCampaignRegistration', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'completeCampaign', method: 'POST', edgePath: '/edge/v1/campaigns/complete', upstreamOperationId: 'completeCampaign', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'cancelCampaign', method: 'POST', edgePath: '/edge/v1/campaigns/cancel', upstreamOperationId: 'cancelCampaign', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'requestOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/request', upstreamOperationId: 'requestApplicantOtp', session: 'anonymous', retryOnG2G: true, composition: 'single' },
  { id: 'verifyOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/verify', upstreamOperationId: 'verifyApplicantOtp', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'applicantLogout', method: 'POST', edgePath: '/edge/v1/auth/applicant/logout', upstreamOperationId: 'logoutApplicant', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'listApplications', method: 'GET', edgePath: '/edge/v1/applications', upstreamOperationId: 'listApplications', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'listAmberQueue', method: 'GET', edgePath: '/edge/v1/applications/amber-queue', upstreamOperationId: 'listAmberQueue', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'findApplicationById', method: 'GET', edgePath: '/edge/v1/applications/by-id', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getStatusHistory', method: 'GET', edgePath: '/edge/v1/applications/status-history', upstreamOperationId: 'getApplicationStatusHistory', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getApplicationDetail', method: 'GET', edgePath: '/edge/v1/applications/detail', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true, composition: 'composed', composedOf: ['findApplicationById', 'getStatusHistory'], compositionReason: 'Procedural Justice view combines application record and decision trail in one round trip. Field tablet on slow links needs both to render one cohesive view without latency penalty of separate calls.' },
  { id: 'recordMedicalReview', method: 'POST', edgePath: '/edge/v1/applications/medical-review', upstreamOperationId: 'recordMedicalReview', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'recordFinalDecision', method: 'POST', edgePath: '/edge/v1/applications/final-decision', upstreamOperationId: 'recordFinalDecision', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'acceptApplication', method: 'POST', edgePath: '/edge/v1/applications/accept', upstreamOperationId: 'acceptApplication', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'adjudicateApplication', method: 'POST', edgePath: '/edge/v1/applications/adjudicate', upstreamOperationId: 'adjudicateApplication', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'registerWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/register', upstreamOperationId: 'registerWalkIn', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'vetWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/vet', upstreamOperationId: 'vetWalkIn', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'admitAtGate', method: 'POST', edgePath: '/edge/v1/gate/admissions', upstreamOperationId: 'admitAtGate', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'verifyIdentity', method: 'POST', edgePath: '/edge/v1/identities/verify', upstreamOperationId: 'verifyIdentity', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'listMyApplications', method: 'GET', edgePath: '/edge/v1/me/applications', upstreamOperationId: 'listMyApplications', session: 'applicant', retryOnG2G: true, composition: 'single' },
  { id: 'submitMyApplication', method: 'POST', edgePath: '/edge/v1/me/applications', upstreamOperationId: 'submitMyApplication', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'getMyExamInvitation', method: 'GET', edgePath: '/edge/v1/me/applications/exam-invitation', upstreamOperationId: 'getMyExamInvitation', session: 'applicant', retryOnG2G: true, composition: 'single' },
  { id: 'getMyDocumentChecklist', method: 'GET', edgePath: '/edge/v1/me/applications/document-checklist', upstreamOperationId: 'getMyDocumentChecklist', session: 'applicant', retryOnG2G: true, composition: 'single' },
  // ADR-049 (S12c). Read-only; the edge retries it on a G2G fault.
  { id: 'getMyIdentity', method: 'GET', edgePath: '/edge/v1/me/identity', upstreamOperationId: 'getMyIdentity', session: 'applicant', retryOnG2G: true, composition: 'single' },
  // ADR-048 §2.3 (S12b). A write: the edge never retries it. The citizen's own
  // retry is safe because the staged verification record is idempotent, and
  // that is the caller's decision to make, not the transport's.
  { id: 'attachMyClearanceCertificate', method: 'POST', edgePath: '/edge/v1/me/applications/clearance-certificate', upstreamOperationId: 'attachMyClearanceCertificate', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'getDocumentChecklist', method: 'GET', edgePath: '/edge/v1/applications/document-checklist', upstreamOperationId: 'getDocumentChecklist', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'verifyDocumentAtVenue', method: 'POST', edgePath: '/edge/v1/applications/documents/verify-at-venue', upstreamOperationId: 'verifyDocumentAtVenue', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'uploadMyDocument', method: 'POST', edgePath: '/edge/v1/me/applications/documents', upstreamOperationId: 'uploadMyDocument', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'withdrawMyApplication', method: 'POST', edgePath: '/edge/v1/me/applications/withdraw', upstreamOperationId: 'withdrawMyApplication', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'getMyErasureRequest', method: 'GET', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'getMyErasureRequest', session: 'applicant', retryOnG2G: true, composition: 'single' },
  { id: 'fileMyErasureRequest', method: 'POST', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'fileMyErasureRequest', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'enrollFieldDevice', method: 'POST', edgePath: '/edge/v1/field-sync/devices', upstreamOperationId: 'enrollFieldDevice', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'syncFieldScores', method: 'POST', edgePath: '/edge/v1/field-sync/scores', upstreamOperationId: 'syncFieldScores', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'resolveFieldSyncConflict', method: 'POST', edgePath: '/edge/v1/field-sync/conflicts/resolve', upstreamOperationId: 'resolveFieldConflict', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'listOfficers', method: 'GET', edgePath: '/edge/v1/officers', upstreamOperationId: 'officerList', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'createOfficer', method: 'POST', edgePath: '/edge/v1/officers', upstreamOperationId: 'officerCreate', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'releaseOfficerActivation', method: 'POST', edgePath: '/edge/v1/officers/activation/release', upstreamOperationId: 'officerReleaseActivation', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'reissueOfficerActivation', method: 'POST', edgePath: '/edge/v1/officers/activation/reissue', upstreamOperationId: 'officerReissueActivation', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'assignOfficerPosts', method: 'POST', edgePath: '/edge/v1/officers/posts', upstreamOperationId: 'officerAssignPosts', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'disableOfficer', method: 'POST', edgePath: '/edge/v1/officers/disable', upstreamOperationId: 'officerDisable', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'enableOfficer', method: 'POST', edgePath: '/edge/v1/officers/enable', upstreamOperationId: 'officerEnable', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'revokeOfficerSessions', method: 'POST', edgePath: '/edge/v1/officers/sessions/revoke', upstreamOperationId: 'officerRevokeSessions', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'activateOfficer', method: 'POST', edgePath: '/edge/v1/auth/officer/activate', upstreamOperationId: 'officerActivate', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'listAgencyCampaigns', method: 'GET', edgePath: '/edge/v1/campaigns/admin', upstreamOperationId: 'adminCampaignList', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getCampaignAdminDetail', method: 'GET', edgePath: '/edge/v1/campaigns/admin/detail', upstreamOperationId: 'adminCampaignDetail', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'searchApplications', method: 'GET', edgePath: '/edge/v1/applications/search', upstreamOperationId: 'searchApplications', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getVenueRoster', method: 'GET', edgePath: '/edge/v1/gate/roster', upstreamOperationId: 'venueRoster', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getVenueLiveCounts', method: 'GET', edgePath: '/edge/v1/gate/live-counts', upstreamOperationId: 'venueLiveCounts', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'listFieldDevices', method: 'GET', edgePath: '/edge/v1/field-sync/devices', upstreamOperationId: 'fleetList', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'assignDeviceToVenueDay', method: 'POST', edgePath: '/edge/v1/field-sync/devices/assign', upstreamOperationId: 'fleetAssign', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'revokeFieldDevice', method: 'POST', edgePath: '/edge/v1/field-sync/devices/revoke', upstreamOperationId: 'fleetRevoke', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'listErasureRequests', method: 'GET', edgePath: '/edge/v1/erasure-requests', upstreamOperationId: 'listErasureRequests', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getBiometricPolicy', method: 'GET', edgePath: '/edge/v1/gate/biometric-policy', upstreamOperationId: 'biometricPolicy', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'recordBiometricEvidence', method: 'POST', edgePath: '/edge/v1/gate/biometric-evidence', upstreamOperationId: 'biometricEvidenceRecord', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'getBiometricEvidence', method: 'GET', edgePath: '/edge/v1/applications/biometric-evidence', upstreamOperationId: 'getBiometricEvidence', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'confirmManualIdentity', method: 'POST', edgePath: '/edge/v1/gate/manual-identity', upstreamOperationId: 'confirmManualIdentity', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'decideErasureRequest', method: 'POST', edgePath: '/edge/v1/erasure-requests/decision', upstreamOperationId: 'declineErasureRequest', session: 'officer', retryOnG2G: false, composition: 'composed', composedOf: ['declineErasureRequest', 'listErasureRequests', 'eraseIdentity'], compositionReason: 'EXECUTE must name the applicant to the gated erasure road without ever showing the browser an applicant id.' },
  { id: 'readSession', method: 'GET', edgePath: '/edge/v1/session', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false, composition: 'local' },
  { id: 'refreshSession', method: 'POST', edgePath: '/edge/v1/session/refresh', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false, composition: 'local' },
] as const satisfies readonly EdgeOperation[];

export type EdgeOperationId = (typeof EDGE_OPERATIONS)[number]['id'];
export type AnonymousEdgeOperationId = Extract<(typeof EDGE_OPERATIONS)[number], { readonly session: 'anonymous' }>['id'];
const BY_ID: ReadonlyMap<string, EdgeOperation> = new Map(EDGE_OPERATIONS.map((edgeOperation): readonly [string, EdgeOperation] => [edgeOperation.id, edgeOperation]));
export function operation(id: string): EdgeOperation { const found = BY_ID.get(id); if (found === undefined) throw new Error(`Unknown edge operation "${id}". Add it to EDGE_OPERATIONS in paths.ts.`); return found; }
export function isEdgeOperationId(id: string): id is EdgeOperationId { return BY_ID.has(id); }
export const EDGE_PATHS: readonly string[] = [...new Set(EDGE_OPERATIONS.map((edgeOperation) => edgeOperation.edgePath))];
export class ContractMismatchError extends Error { readonly problems: readonly string[]; constructor(problems: readonly string[]) { super(`@usrp/api-client disagrees with @usrp/contracts:\n  ${problems.join('\n  ')}`); this.name = 'ContractMismatchError'; this.problems = problems; } }
export function assertPathsMatchContract(): void { const problems: string[] = []; const byOperationId = new Map<string, RouteFact>(ROUTE_TABLE.map((route) => [route.operationId, route])); const brokered = new Set(['verifyIdentity']); if (ROUTE_TABLE.length === 0) problems.push('ROUTE_TABLE is empty.'); if (BROWSER_ROUTES.length === 0) problems.push('BROWSER_ROUTES is empty.'); if (SERVICE_INTERNAL_ROUTES.length === 0) problems.push('SERVICE_INTERNAL_ROUTES is empty.'); const seen = new Set<string>(); for (const edgeOperation of EDGE_OPERATIONS) { if (seen.has(edgeOperation.id)) problems.push(`${edgeOperation.id}: duplicate operation id.`); seen.add(edgeOperation.id); if (edgeOperation.edgePath.includes('${') || edgeOperation.edgePath.includes(':')) problems.push(`${edgeOperation.id}: edge path is templated.`); if (edgeOperation.composition === 'composed') { if (!edgeOperation.composedOf || edgeOperation.composedOf.length < 2) problems.push(`${edgeOperation.id}: composed operation must list 2+ upstream operation IDs in composedOf.`); } else if (edgeOperation.composition === 'single' && 'composedOf' in edgeOperation) { problems.push(`${edgeOperation.id}: composedOf should only be set when composition is 'composed'.`); } if (edgeOperation.composition === 'single' || edgeOperation.composition === 'composed') { if (edgeOperation.upstreamOperationId === null) continue; const upstream = byOperationId.get(edgeOperation.upstreamOperationId); if (upstream === undefined) { problems.push(`${edgeOperation.id}: no contract operation "${edgeOperation.upstreamOperationId}".`); continue; } if (upstream.reach === 'service-internal' && !brokered.has(edgeOperation.upstreamOperationId)) problems.push(`${edgeOperation.id}: "${edgeOperation.upstreamOperationId}" is service-internal and not brokered.`); if (upstream.path.includes('${') || upstream.path.includes(':')) problems.push(`${edgeOperation.id}: upstream path is templated.`); } } if (problems.length > 0) throw new ContractMismatchError(problems); }
assertPathsMatchContract();
