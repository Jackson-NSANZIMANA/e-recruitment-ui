// ══════════════════════════════════════════════════════════════════
// @usrp/api-client selfcheck
//
//   pnpm --filter @usrp/api-client selfcheck
//
// Asserts the pure logic the socket-level edge proof cannot reach: error
// normalisation over the REAL discriminated bodies, the retry policy's refusals,
// and the invalidation map. Every fixture body below is transcribed from a
// backend controller, so a normaliser that "works" against invented shapes
// cannot pass.
// ══════════════════════════════════════════════════════════════════

import { ApiError, describeError, normaliseErrorBody, G2G_UNAVAILABLE_CODES } from '../src/errors.js';
import { createApiClient } from '../src/transport.js';
import { submitMyApplication } from '../src/operations/applicant.js';
import { backoffDelayMs, shouldRetry, withRetry, type RetryPolicy } from '../src/retry.js';
import { INVALIDATION_MAP, applicationKeys, applicantKeys, resolveInvalidation, sessionKeys } from '../src/keys.js';

let passed = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(detail === undefined ? label : `${label} — ${detail}`);
}
function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function deepEq(label: string, actual: unknown, expected: unknown): void {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ══ Error normalisation over REAL bodies ═══════════════════════

// withAuth 401 — iam-service officer login and every authed route.
const unauth = normaliseErrorBody(401, { error: 'UNAUTHENTICATED', detail: 'A bearer token is required.' });
eq('401 UNAUTHENTICATED normalises to unauthenticated', unauth.kind, 'unauthenticated');
// identity-service uses a DIFFERENT code at the same status for the session kind.
const badSession = normaliseErrorBody(401, { error: 'INVALID_SESSION', detail: 'A valid session token is required.' });
eq('401 INVALID_SESSION also normalises to unauthenticated', badSession.kind, 'unauthenticated');
ok('…and the distinct code survives for logging', badSession.kind === 'unauthenticated' && badSession.code === 'INVALID_SESSION');

// THREE incompatible 403 bodies exist platform-wide. All three must normalise.
const forbidA = normaliseErrorBody(403, { error: 'FORBIDDEN', detail: 'Officer principal required.' });
const forbidB = normaliseErrorBody(403, { error: 'FORBIDDEN' });
const forbidC = normaliseErrorBody(403, { status: 'AGENCY_MISMATCH' });
eq('403 from withAuth normalises', forbidA.kind, 'forbidden');
eq('403 from an outcome branch normalises', forbidB.kind, 'forbidden');
eq('403 from biometric-service (status-keyed) normalises', forbidC.kind, 'forbidden');
ok('…and the status-keyed 403 keeps its code', forbidC.kind === 'forbidden' && forbidC.code === 'AGENCY_MISMATCH');

// The bare 404 is an anti-enumeration device and must stay bare.
const notFoundRead = normaliseErrorBody(404, { error: 'NOT_FOUND' });
const notFoundWrite = normaliseErrorBody(404, { status: 'NOT_FOUND' });
eq('the read-shaped 404 normalises', notFoundRead.kind, 'notFound');
eq('the write-shaped 404 normalises identically', notFoundWrite.kind, 'notFound');
deepEq('a normalised 404 carries NO detail (no cross-agency existence oracle)', notFoundRead, { kind: 'notFound', status: 404 });
deepEq('…and the two shapes are indistinguishable afterwards', notFoundRead, notFoundWrite);

// ADR-014: the edge deliberately strips the sibling agency before it reaches the browser.
const locked = normaliseErrorBody(409, { error: 'CROSS_AGENCY_ACCEPT_LOCK' });
eq('409 CROSS_AGENCY_ACCEPT_LOCK is a conflict', locked.kind, 'conflict');
ok('…keeping the edge-visible outcome name', locked.kind === 'conflict' && locked.outcome === 'CROSS_AGENCY_ACCEPT_LOCK');
ok('…without exposing the sibling agency', locked.kind === 'conflict' && Object.keys(locked.data).length === 0);

// ADR-012: AGE_PENDING is the officer's retry, and carries the current status.
const agePending = normaliseErrorBody(409, { status: 'AGE_PENDING', currentStatus: 'WALK_IN_REGISTERED' });
eq('409 AGE_PENDING is a conflict, not an outage', agePending.kind, 'conflict');
ok('…with currentStatus preserved', agePending.kind === 'conflict' && agePending.data['currentStatus'] === 'WALK_IN_REGISTERED');
ok('…and is NOT retryable by the client', !new ApiError(agePending, 'x').isRetryable);

// ADR-013: the agency-mode mismatch.
const wrongMode = normaliseErrorBody(422, { status: 'INVALID_MEDICAL_INPUT', reason: 'AGENCY_USES_CERTIFICATE' });
eq('422 INVALID_MEDICAL_INPUT is unprocessable', wrongMode.kind, 'unprocessable');
ok('…with the reason that names the agency mode', wrongMode.kind === 'unprocessable' && wrongMode.data['reason'] === 'AGENCY_USES_CERTIFICATE');

// 501 is a permanent answer, not a fault: hide the control, do not offer a retry.
const unsupported = normaliseErrorBody(501, { status: 'UNSUPPORTED_AGENCY', agency: 'RNP' });
eq('501 UNSUPPORTED_AGENCY has its own kind', unsupported.kind, 'unsupportedAgency');
ok('…naming the agency', unsupported.kind === 'unsupportedAgency' && unsupported.agency === 'RNP');
ok('…and is not retryable', !new ApiError(unsupported, 'x').isRetryable);

// 400 detail IS safe to show (expose = status < 500).
const badRequest = normaliseErrorBody(400, { error: 'INVALID_APPLICATION_ID', detail: 'Field "applicationId" must be a UUID.' });
eq('400 normalises to badRequest', badRequest.kind, 'badRequest');
ok('…and keeps the caller-facing detail', badRequest.kind === 'badRequest' && badRequest.detail?.includes('UUID') === true);

// walk-in.controller.ts builds codes by upper-casing field names, producing
// MISSING_APPLICANTID where every sibling emits MISSING_APPLICANT_ID.
const misspelled = normaliseErrorBody(400, { error: 'MISSING_APPLICANTID', detail: 'Field "applicantId" is required.' });
ok('the walk-in controller\'s odd MISSING_APPLICANTID spelling still normalises',
  misspelled.kind === 'badRequest' && misspelled.code === 'MISSING_APPLICANTID');

// 5xx detail is discarded upstream; we must not invent one.
const serverError = normaliseErrorBody(500, { error: 'APPLICATION_PERSISTENCE_ERROR' });
eq('500 normalises to serverError', serverError.kind, 'serverError');
const upstreamDown = normaliseErrorBody(502, { error: 'UPSTREAM_UNREACHABLE' });
eq('502 is a serverError, NOT a retryable G2G fault', upstreamDown.kind, 'serverError');
ok('…and is explicitly not retryable (a refused socket may have half-written)',
  !new ApiError(upstreamDown, 'x').isRetryable);

// ══ G2G: the ONLY retryable class ══════════════════════════════
for (const code of G2G_UNAVAILABLE_CODES) {
  const fault = normaliseErrorBody(503, { error: code });
  ok(`503 ${code} is a named G2G outage`, fault.kind === 'g2gUnavailable');
  ok(`…and names the authority (${code})`, fault.kind === 'g2gUnavailable' && fault.authority === code);
  ok(`…and is retryable (${code})`, new ApiError(fault, 'x').isRetryable);
}
const unknown503 = normaliseErrorBody(503, { error: 'SOMETHING_ELSE_UNAVAILABLE' });
eq('an UNRECOGNISED 503 is NOT treated as a transient G2G fault', unknown503.kind, 'serverError');
ok('…so an unknown outage cannot become a thundering herd', !new ApiError(unknown503, 'x').isRetryable);
const empty = normaliseErrorBody(503, null);
eq('a 503 with no body is not retryable either', empty.kind, 'serverError');

eq('describeError reports the edge-visible lock outcome', describeError(locked), '409 CROSS_AGENCY_ACCEPT_LOCK');
eq('describeError on a bare 404 says only 404', describeError(notFoundRead), '404');

// ══ Retry policy ═══════════════════════════════════════════════
const g2g = new ApiError(normaliseErrorBody(503, { error: 'NIDA_UNAVAILABLE' }), 'x');
const conflict = new ApiError(locked, 'x');
ok('a G2G fault on a retryable operation retries', shouldRetry(g2g, true));
ok('the SAME fault on a NON-retryable operation does NOT retry', !shouldRetry(g2g, false));
ok('a conflict never retries, even on a retryable operation', !shouldRetry(conflict, true));
ok('a plain Error never retries', !shouldRetry(new Error('boom'), true));

const policy: RetryPolicy = { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 1_000, random: () => 1, sleep: async () => {} };
eq('backoff attempt 0', backoffDelayMs(0, policy), 100);
eq('backoff attempt 1 doubles', backoffDelayMs(1, policy), 200);
eq('backoff attempt 4 is capped', backoffDelayMs(4, policy), 1_000);
eq('full jitter can floor to zero', backoffDelayMs(3, { ...policy, random: () => 0 }), 0);

let readAttempts = 0;
const readResult = await withRetry(async () => {
  readAttempts += 1;
  if (readAttempts < 3) throw g2g;
  return 'ok';
}, true, policy);
eq('a retryable read succeeds on the third attempt', readResult, 'ok');
eq('…having made exactly three attempts', readAttempts, 3);

let writeAttempts = 0;
try {
  await withRetry(async () => { writeAttempts += 1; throw g2g; }, false, policy);
} catch { /* expected */ }
eq('a WRITE facing the same G2G fault is attempted exactly ONCE', writeAttempts, 1);

let exhausted = 0;
try {
  await withRetry(async () => { exhausted += 1; throw g2g; }, true, policy);
  ok('an exhausted retry must throw', false);
} catch (err) {
  ok('an exhausted retry throws the original ApiError', err instanceof ApiError);
  ok('…preserving the authority for the message', err instanceof ApiError && err.normalised.kind === 'g2gUnavailable');
}
eq('…after maxRetries + 1 attempts', exhausted, 3);

let conflictAttempts = 0;
try {
  await withRetry(async () => { conflictAttempts += 1; throw conflict; }, true, policy);
} catch { /* expected */ }
eq('a 409 is never retried', conflictAttempts, 1);

// ══ Query keys and the invalidation map ════════════════════════
deepEq('the officer list is keyed by agency', applicationKeys.list('RDF'), ['applications', 'list', 'RDF']);
ok('two agencies do not share a cache slot',
  JSON.stringify(applicationKeys.list('RDF')) !== JSON.stringify(applicationKeys.list('RNP')));
deepEq('citizen applications are NOT agency-keyed (a citizen is cross-agency)', applicantKeys.myApplications(), ['applicant', 'applications']);

const transitions = ['recordMedicalReview', 'recordFinalDecision', 'acceptApplication', 'adjudicateApplication'];
for (const name of transitions) {
  const targets = INVALIDATION_MAP[name] ?? [];
  ok(`${name} invalidates the list`, targets.includes('applications:list'));
  ok(`${name} invalidates the row`, targets.includes('applications:detail'));
  ok(`${name} invalidates the status history (append-only, so it always grew)`, targets.includes('applications:status-history'));
}
ok('medical-review invalidates the AMBER QUEUE (an adverse verdict routes there)',
  (INVALIDATION_MAP['recordMedicalReview'] ?? []).includes('applications:amber-queue'));
ok('adjudicate invalidates the amber queue (it is how a row leaves)',
  (INVALIDATION_MAP['adjudicateApplication'] ?? []).includes('applications:amber-queue'));
ok('accept reaches into CITIZEN caches (ADR-017 auto-withdrawal)',
  (INVALIDATION_MAP['acceptApplication'] ?? []).includes('applicant:applications'));
deepEq('verifyIdentity invalidates NOTHING, and says so explicitly', INVALIDATION_MAP['verifyIdentity'], []);
ok('erasure invalidates the session too (ADR-015 terminates it)',
  (INVALIDATION_MAP['eraseIdentity'] ?? []).includes('session:current'));
ok('every transition appears in the map', transitions.every((name) => INVALIDATION_MAP[name] !== undefined));
ok('submitMyApplication refreshes the citizen projection',
  JSON.stringify(INVALIDATION_MAP['submitMyApplication']) === JSON.stringify(['applicant:applications']));
ok('registerWalkIn invalidates the list but has no row yet',
  JSON.stringify(INVALIDATION_MAP['registerWalkIn']) === JSON.stringify(['applications:list']));

const resolved = resolveInvalidation(INVALIDATION_MAP['acceptApplication'] ?? [], { agency: 'RDF', applicationId: 'app-1' });
eq('accept resolves to six concrete key families', resolved.length, 6);
deepEq('…including the agency-scoped list', resolved[0], applicationKeys.list('RDF'));
deepEq('…including the exact by-id and composed-detail reads', resolved[2], applicationKeys.byId('app-1'));
deepEq('…and the citizen cache last (ADR-017 auto-withdrawal)', resolved[5], applicantKeys.myApplications());
deepEq('the session key resolves on its own target', resolveInvalidation(['session:current'], {})[0], sessionKeys.current());
const withoutContext = resolveInvalidation(['applications:detail'], {});
eq('a detail target with no applicationId resolves to nothing (never a broad nuke)', withoutContext.length, 0);

// ══ Applicant submit wire proof ════════════════════════════════
// This fixture stands in for the edge only. It proves the browser client sends
// the exact allowlist and can observe the real replay header without turning
// the mutation response into a fabricated application projection.
let submitRequest: { url: string; init: RequestInit } | null = null;
const submitClient = createApiClient({
  baseUrl: '',
  readCsrfToken: () => 'csrf-echo',
  newCorrelationId: () => 'correlation-id',
  fetchImpl: async (input, init) => {
    submitRequest = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({
      status: 'SUBMITTED',
      applicationId: '123e4567-e89b-12d3-a456-426614174000',
      processingCode: 'RDF-2026-000001',
      agency: 'RDF',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'Idempotency-Replayed': 'true' },
    });
  },
});
let replayMeta: { status: number; replayed: boolean } | null = null;
await submitMyApplication(
  submitClient,
  { category: 'GENERAL_ENLISTMENT', campaignCode: 'RDF-2026-A', nesaIndexNumber: 'NESA-123' },
  '123e4567-e89b-12d3-a456-426614174001',
  undefined,
  (meta) => { replayMeta = { status: meta.status, replayed: meta.headers.get('Idempotency-Replayed') === 'true' }; },
);
const capturedRequest = submitRequest as unknown as { url: string; init: RequestInit };
const capturedReplayMeta = replayMeta as unknown as { status: number; replayed: boolean };
const submitHeaders = new Headers(capturedRequest.init.headers);
ok('submit uses the exact browser-relative edge route', capturedRequest.url === '/edge/v1/me/applications');
ok('submit sends the CSRF double-submit header', submitHeaders.get('x-csrf-token') === 'csrf-echo');
ok('submit sends exactly one UUID idempotency key', submitHeaders.get('idempotency-key') === '123e4567-e89b-12d3-a456-426614174001');
ok('submit sends only backend-supported fields', capturedRequest.init.body === JSON.stringify({ category: 'GENERAL_ENLISTMENT', campaignCode: 'RDF-2026-A', nesaIndexNumber: 'NESA-123' }));
ok('the replay header is observable without changing the response body', capturedReplayMeta.status === 200 && capturedReplayMeta.replayed);

// ── ADR-029 / ADR-030 operations ─────────────────────────────────
import { beginApplicantOnboarding } from '../src/operations/session.js';
import { getPublicCampaign, listPublicCampaigns } from '../src/operations/campaigns.js';
import { uploadMyDocument } from '../src/operations/applicant.js';

interface Captured { url: string; init: RequestInit }
function capturingClient(status: number, body: unknown): { client: ReturnType<typeof createApiClient>; last: () => Captured } {
  let captured: Captured | null = null;
  const client = createApiClient({
    baseUrl: '',
    readCsrfToken: () => 'csrf-echo',
    newCorrelationId: () => 'cid',
    fetchImpl: ((url: string, init: RequestInit) => {
      captured = { url, init };
      return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    }) as unknown as typeof fetch,
  });
  return { client, last: (): Captured => captured as unknown as Captured };
}

const onboard = capturingClient(200, { onboardingToken: 'tok', expiresAt: '2026-10-14T10:00:00.000Z' });
const begun = await beginApplicantOnboarding(onboard.client, { nationalId: '1199680012345678', dateOfBirth: '2002-05-14' });
ok('onboarding step 1 uses the identity edge route', onboard.last().url === '/edge/v1/auth/applicant/identity');
ok('…sending exactly nationalId + dateOfBirth', onboard.last().init.body === JSON.stringify({ nationalId: '1199680012345678', dateOfBirth: '2002-05-14' }));
ok('…returning only the token and expiry', begun.onboardingToken === 'tok');

const campaigns = capturingClient(200, { campaigns: [] });
await listPublicCampaigns(campaigns.client);
ok('the public list is an anonymous GET with no body', campaigns.last().url === '/edge/v1/campaigns' && campaigns.last().init.method === 'GET' && campaigns.last().init.body === undefined);
const detail = capturingClient(200, { campaign: {} });
await getPublicCampaign(detail.client, 'RDF-2026-A');
ok('detail addresses the campaign by PUBLIC code in the query', detail.last().url === '/edge/v1/campaigns/detail?publicCode=RDF-2026-A');

const uploader = capturingClient(201, { status: 'UPLOADED', documentId: 'd', documentType: 'NATIONAL_ID_COPY' });
await uploadMyDocument(uploader.client, {
  applicationId: '123e4567-e89b-12d3-a456-426614174001',
  documentType: 'NATIONAL_ID_COPY',
  file: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
});
const uploadInit = uploader.last().init;
const uploadHeaders = new Headers(uploadInit.headers);
ok('upload posts to the document edge route', uploader.last().url === '/edge/v1/me/applications/documents');
ok('…as multipart (FormData), letting the browser set the boundary', uploadInit.body instanceof FormData && uploadHeaders.get('content-type') === null);
ok('…with the CSRF header and NO Authorization header', uploadHeaders.get('x-csrf-token') === 'csrf-echo' && uploadHeaders.get('authorization') === null);
const sentForm = uploadInit.body as FormData;
ok('…carrying exactly applicationId, documentType, file — never an applicant id',
  [...sentForm.keys()].sort().join(',') === 'applicationId,documentType,file');

// ── ADR-032 checklist operations ──
import { getDocumentChecklist, getMyDocumentChecklist, verifyDocumentAtVenue } from '../src/operations/documents.js';
const ck = capturingClient(200, { agency: 'RDF', source: 'POLICY_VERSION', complete: false, items: [] });
await getMyDocumentChecklist(ck.client, '123e4567-e89b-12d3-a456-426614174001');
ok('the citizen checklist is a GET on the /me route with the id in the query',
  ck.last().url === '/edge/v1/me/applications/document-checklist?applicationId=123e4567-e89b-12d3-a456-426614174001' && ck.last().init.method === 'GET');
await getDocumentChecklist(ck.client, '123e4567-e89b-12d3-a456-426614174001');
ok('the officer checklist uses the officer route', ck.last().url.startsWith('/edge/v1/applications/document-checklist?'));
const venueClient = capturingClient(200, { status: 'RECORDED', checklist: { agency: 'RDF', source: 'POLICY_VERSION', complete: false, items: [] } });
await verifyDocumentAtVenue(venueClient.client, { applicationId: '123e4567-e89b-12d3-a456-426614174001', documentType: 'GOOD_CONDUCT_CERTIFICATE' });
ok('venue verification POSTs exactly applicationId + documentType with CSRF',
  venueClient.last().url === '/edge/v1/applications/documents/verify-at-venue' &&
  venueClient.last().init.body === JSON.stringify({ applicationId: '123e4567-e89b-12d3-a456-426614174001', documentType: 'GOOD_CONDUCT_CERTIFICATE' }) &&
  new Headers(venueClient.last().init.headers).get('x-csrf-token') === 'csrf-echo');

// ── ADR-033 exam QR ──
import { getMyExamInvitation } from '../src/operations/exam-invitation.js';
const qrClient = capturingClient(200, { state: 'PENDING', agency: 'RDF', processingCode: 'RDF-1', campaignLabel: null, currentStatus: 'SUBMITTED' });
const qrView = await getMyExamInvitation(qrClient.client, '123e4567-e89b-12d3-a456-426614174001');
ok('the exam QR is a GET on the /me route, id in the query, no body',
  qrClient.last().url === '/edge/v1/me/applications/exam-invitation?applicationId=123e4567-e89b-12d3-a456-426614174001' &&
  qrClient.last().init.method === 'GET' && qrClient.last().init.body === undefined);
ok('…and the state is surfaced as-is', qrView.state === 'PENDING');

// ── Gate admission (BUILD-003, ADR-034) ──
import { admitAtGate, gateResultFromRefusal } from '../src/operations/gate.js';
const GATE_CANDIDATE = { applicationId: '22222222-2222-4222-8222-222222222222', processingCode: 'RDF-90001', category: 'GENERAL_ENLISTMENT' };
const gateOk = capturingClient(200, { outcome: 'ADMITTED', candidate: GATE_CANDIDATE, venueName: 'ULK Stadium', examDate: '2026-12-01', reportingTimeHour: 8, admittedAt: '2026-12-01T06:01:00.000Z', statusAdvanced: true });
const admitted = await admitAtGate(gateOk.client, { qrToken: 'USRP-SLOT.v1.a.b', nationalId: '1199880012345678', gateVenueName: 'ULK Stadium' });
ok('the gate POSTs to the officer edge route with CSRF', gateOk.last().url === '/edge/v1/gate/admissions' && gateOk.last().init.method === 'POST' &&
  (gateOk.last().init.headers as Record<string, string>)['x-csrf-token'] === 'csrf-echo');
ok('…sending exactly the scanned QR, the card number and the gate venue', gateOk.last().init.body === JSON.stringify({ qrToken: 'USRP-SLOT.v1.a.b', nationalId: '1199880012345678', gateVenueName: 'ULK Stadium' }));
ok('…and ADMITTED is a result', admitted.outcome === 'ADMITTED' && admitted.candidate.processingCode === 'RDF-90001');
const dup = await admitAtGate(capturingClient(409, { error: 'ALREADY_ADMITTED', candidate: GATE_CANDIDATE, admittedAt: '2026-12-01T06:01:00.000Z', venueName: 'ULK Stadium', admittedBySelf: false }).client,
  { qrToken: 'x', nationalId: '1199880012345678', gateVenueName: 'ULK Stadium' });
ok('a spent QR is a RESULT (ALREADY_ADMITTED), not a thrown error', dup.outcome === 'ALREADY_ADMITTED' && !dup.admittedBySelf);
const forgedQr = await admitAtGate(capturingClient(422, { error: 'INVALID_TICKET', reason: 'TICKET_NOT_ISSUED' }).client,
  { qrToken: 'x', nationalId: '1199880012345678', gateVenueName: 'ULK Stadium' });
ok('an invalid ticket is a RESULT with its reason', forgedQr.outcome === 'INVALID_TICKET' && forgedQr.reason === 'TICKET_NOT_ISSUED');
let threw: unknown = null;
try {
  await admitAtGate(capturingClient(409, { error: 'SOMETHING_NEW' }).client, { qrToken: 'x', nationalId: '1199880012345678', gateVenueName: 'v' });
} catch (e) { threw = e; }
ok('an undocumented refusal still THROWS (never guessed into a result)', threw instanceof ApiError);
threw = null;
try {
  await admitAtGate(capturingClient(503, { error: 'UPSTREAM_UNAVAILABLE' }).client, { qrToken: 'x', nationalId: '1199880012345678', gateVenueName: 'v' });
} catch (e) { threw = e; }
ok('an infrastructure fault throws', threw instanceof ApiError);
ok('refusal mapping: every documented shape', [
  gateResultFromRefusal(409, 'NOT_ADMISSIBLE', { candidate: GATE_CANDIDATE, currentStatus: 'WITHDRAWN' })?.outcome,
  gateResultFromRefusal(409, 'IDENTITY_MISMATCH', { candidate: GATE_CANDIDATE })?.outcome,
  gateResultFromRefusal(409, 'WRONG_VENUE', { ticketVenueName: 'Amahoro' })?.outcome,
  gateResultFromRefusal(409, 'TOO_EARLY', { examDate: '2026-12-01' })?.outcome,
  gateResultFromRefusal(409, 'EXPIRED', { examDate: '2026-12-01' })?.outcome,
].join() === 'NOT_ADMISSIBLE,IDENTITY_MISMATCH,WRONG_VENUE,TOO_EARLY,EXPIRED');
ok('refusal mapping: a shape missing its detail is not a result', gateResultFromRefusal(409, 'IDENTITY_MISMATCH', {}) === null &&
  gateResultFromRefusal(422, 'INVALID_TICKET', { reason: 'EXPIRED' }) === null);

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ api-client selfcheck FAILED — ${failures.length} of ${total} assertions\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ api-client selfcheck GREEN — ${passed} assertions\n\n`);
