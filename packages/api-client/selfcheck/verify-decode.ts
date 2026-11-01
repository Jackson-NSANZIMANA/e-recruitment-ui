// ══════════════════════════════════════════════════════════════════
// @usrp/api-client decode + transport selfcheck
//
//   pnpm --filter @usrp/api-client selfcheck
//
// PINS THE TWO DEFECTS THAT TOOK THE OFFICER CONSOLE DOWN, so neither can
// return silently:
//
//   1. `baseUrl: ''` means SAME ORIGIN. `new URL(path, '')` throws
//      `TypeError: Invalid base URL` BEFORE fetch, so every hook failed while
//      `@usrp/auth` — which concatenates strings — kept working. The session was
//      live and the dashboard said "Something went wrong": the most misleading
//      failure mode available.
//   2. The officer reads are BARE ARRAYS. `wire.ts` described the upstream
//      envelope that `tooling/edge-dev` relays, so `data.applications.length`
//      type-checked against a shape the production gateway never sends.
//
// Every fixture below is transcribed from a real responder — the gateway's
// `projections.ts` on one side, the dev harness's relayed upstream body on the
// other. A decoder that passes invented shapes cannot pass this file.
// ══════════════════════════════════════════════════════════════════

import { ApiError } from '../src/errors.js';
import { createApiClient } from '../src/transport.js';
import {
  decodeAmberQueue,
  decodeApplication,
  decodeApplicationDetail,
  decodeApplicationList,
  decodeMyApplications,
  decodeStatusHistory,
  decodeTransition,
  decodeUploadAnswer,
  isUnconfirmedUploadOutcome,
} from '../src/decode.js';
import type { UploadDocumentResponse } from '../src/wire.js';

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
function throwsMalformed(label: string, run: () => unknown, operationId: string): void {
  try {
    run();
    ok(label, false, 'it returned instead of throwing');
  } catch (error) {
    const isNamed = error instanceof ApiError
      && error.normalised.kind === 'malformed'
      && error.normalised.detail.includes(operationId);
    ok(label, isNamed, `got ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ══ 1. The transport's same-origin base ════════════════════════

ok('`new URL(path, "")` really does throw — this is the bug, not a theory', (() => {
  try { new URL('/edge/v1/applications', ''); return false; } catch { return true; }
})());

const origin = 'http://localhost:3001';
(globalThis as Record<string, unknown>)['window'] ??= { location: { origin } };

const requested: string[] = [];
const fakeFetch = (async (url: string) => {
  requested.push(String(url));
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
}) as unknown as typeof fetch;

const sameOrigin = createApiClient({ baseUrl: '', fetchImpl: fakeFetch });
await sameOrigin.call<unknown>('listApplications');
deepEq('an empty baseUrl resolves to a relative path and the request is SENT', requested, ['/edge/v1/applications']);

requested.length = 0;
const absolute = createApiClient({ baseUrl: 'https://portal.usrp.gov.rw', fetchImpl: fakeFetch });
await absolute.call<unknown>('findApplicationById', { query: { applicationId: 'abc' } });
deepEq('an explicit origin is untouched, and the id stays a QUERY param (ADR-005)',
  requested, ['https://portal.usrp.gov.rw/edge/v1/applications/by-id?applicationId=abc']);

// ══ 2. Officer list reads ══════════════════════════════════════

// edge-gateway: projectListItems() — a bare array, applicationId, agency injected.
const gatewayRow = {
  applicationId: '8a1f0d3e-0000-4000-8000-000000000001',
  processingCode: 'RDF-2026-000001',
  category: 'GENERAL_ENTRY',
  status: 'MEDICAL_REVIEW',
  agency: 'RDF',
  submittedAt: '2026-09-01T08:00:00.000Z',
};
// tooling/edge-dev: the relayed upstream envelope, keyed `id`.
const harnessBody = {
  agency: 'RDF',
  applications: [{ id: gatewayRow.applicationId, agency: 'RDF', status: 'MEDICAL_REVIEW', processingCode: 'RDF-2026-000001', category: 'GENERAL_ENTRY' }],
};

deepEq('an empty gateway list is [] — the dashboard\u2019s normal zero state', decodeApplicationList([], 'RDF'), []);
eq('the gateway\u2019s bare array decodes', decodeApplicationList([gatewayRow], 'RDF').length, 1);
eq('…with applicationId, not id', decodeApplicationList([gatewayRow], 'RDF')[0]?.applicationId, gatewayRow.applicationId);
eq('the dev harness\u2019s envelope decodes to the SAME view model',
  decodeApplicationList(harnessBody, 'RDF')[0]?.applicationId, gatewayRow.applicationId);
eq('agency is stamped from the SESSION, never trusted from the row',
  decodeApplicationList([{ ...gatewayRow, agency: 'RNP' }], 'RDF')[0]?.agency, 'RDF');
deepEq('the amber queue is a bare array too', decodeAmberQueue([], 'RDF'), []);

// The shape that actually shipped and broke: a paginated envelope nothing sends.
throwsMalformed('a `PaginatedResult` envelope is named drift, not a TypeError in a render',
  () => decodeApplicationList({ items: [], total: 0 }, 'RDF'), 'listApplications');
throwsMalformed('a status the contract does not know is refused',
  () => decodeApplicationList([{ ...gatewayRow, status: 'NOT_A_STATUS' }], 'RDF'), 'listApplications');
throwsMalformed('a row with no id is refused rather than keyed on undefined',
  () => decodeApplicationList([{ status: 'MEDICAL_REVIEW' }], 'RDF'), 'listApplications');

// S12b: the same read serves a LIVE row whose criminal clearance is UNDER_REVIEW,
// so a decoder that only understood the two holds would call the officer's real
// queue malformed. And the reason codes are the only thing that says WHY.
const s12bAmber = decodeAmberQueue([{
  applicationId: 'b',
  processingCode: 'RNP-2026-000002',
  status: 'CRIMINAL_CLEARANCE',
  documentType: null,
  forensicsScore: null,
  queuedAt: null,
  reasons: ['CRIMINAL_RECORD_REVIEW'],
}], 'RNP');
eq('a registry hold decodes instead of failing the whole read', s12bAmber[0]?.status, 'CRIMINAL_CLEARANCE');
deepEq('…carrying the closed reason codes verbatim', s12bAmber[0]?.reasons, ['CRIMINAL_RECORD_REVIEW']);
deepEq('a row with no reasons gets [] — "not stated", never inferred',
  decodeAmberQueue([{ applicationId: 'c', status: 'ADJUDICATION_REVIEW' }], 'RDF')[0]?.reasons, []);
deepEq('a malformed reasons array is dropped, not fatal to the queue',
  decodeAmberQueue([{ applicationId: 'd', status: 'ADJUDICATION_REVIEW', reasons: ['KEPT', 7, null, ''] }], 'RDF')[0]?.reasons, ['KEPT']);
eq('a row with no status is listed, not refused', decodeAmberQueue([{ applicationId: 'e' }], 'RDF')[0]?.status, null);
throwsMalformed('an unknown status is still named drift on this read',
  () => decodeAmberQueue([{ applicationId: 'f', status: 'NOT_A_STATUS' }], 'RDF'), 'listAmberQueue');

// ══ 3. One record, flat or enveloped ═══════════════════════════

const flat = decodeApplication({ applicationId: 'a', processingCode: 'RDF-1', status: 'ACCEPTED', documentLane: 'GREEN' }, 'RDF');
const enveloped = decodeApplication({ agency: 'RDF', application: { id: 'a', processingCode: 'RDF-1', status: 'ACCEPTED' } }, 'RDF');
eq('the gateway\u2019s flat record decodes', flat.applicationId, 'a');
eq('the harness\u2019s { application } envelope decodes to the same id', enveloped.applicationId, 'a');
eq('an officer-only forensic signal survives when the edge sends it', flat.documentLane, 'GREEN');
eq('…and is null, not undefined, when it does not', enveloped.documentLane, null);

// ══ 4. The decision trail ══════════════════════════════════════

const gatewayHistory = decodeStatusHistory([
  { entryId: null, fromStatus: 'SUBMITTED', toStatus: 'MEDICAL_REVIEW', status: 'MEDICAL_REVIEW', note: 'cleared', actorKind: 'OFFICER', occurredAt: '2026-09-02T09:00:00.000Z' },
]);
const upstreamHistory = decodeStatusHistory({
  agency: 'RDF',
  applicationId: 'a',
  history: [{ fromStatus: 'SUBMITTED', toStatus: 'MEDICAL_REVIEW', actorKind: 'OFFICER', actor: 'b0a1-officer-uuid', at: '2026-09-02T09:00:00.000Z', reason: 'cleared' }],
});
deepEq('occurredAt/note and at/reason decode to one entry shape', gatewayHistory, upstreamHistory);
eq('entryId is decoded when the gateway sends it',
  decodeStatusHistory([{ entryId: 'e1', fromStatus: null, toStatus: 'SUBMITTED', actorKind: 'SYSTEM', occurredAt: null, note: null }])[0]?.entryId, 'e1');
ok('the officer UUID does NOT survive decoding', !('actor' in (gatewayHistory[0] ?? {})));
eq('the first transition keeps fromStatus null — nothing preceded it',
  decodeStatusHistory([{ fromStatus: null, toStatus: 'SUBMITTED', actorKind: 'SYSTEM', occurredAt: null, note: null }])[0]?.fromStatus, null);

// ══ 5. The composed detail read ════════════════════════════════

const detailFromGateway = decodeApplicationDetail(
  { application: { applicationId: 'a', processingCode: 'RDF-1', status: 'MEDICAL_REVIEW' }, history: [{ fromStatus: null, toStatus: 'SUBMITTED', actorKind: 'SYSTEM', occurredAt: '2026-09-01T00:00:00.000Z', note: null }] },
  'RDF',
);
eq('the gateway detail decodes one level deep, not two', detailFromGateway.application.applicationId, 'a');
deepEq('…and `partial` defaults to [] because the gateway fails whole', detailFromGateway.partial, []);
const detailFromHarness = decodeApplicationDetail(
  { application: { agency: 'RDF', application: { id: 'a', status: 'MEDICAL_REVIEW' } }, history: null, partial: ['history'] },
  'RDF',
);
deepEq('…while a real partial from the harness is preserved', detailFromHarness.partial, ['history']);
deepEq('a null history panel degrades to an empty trail, not a crash', detailFromHarness.history, []);

// ══ 6. `status` means two different things. Never conflate them. ═

const gatewayApplied = decodeTransition('a', { applicationId: 'a', outcome: 'APPLIED', fromStatus: 'MEDICAL_REVIEW', status: 'FINAL_SHORTLIST' });
const upstreamApplied = decodeTransition('a', { status: 'APPLIED', fromStatus: 'MEDICAL_REVIEW', toStatus: 'FINAL_SHORTLIST' });
deepEq('the gateway\u2019s {outcome,status} and the upstream\u2019s {status,toStatus} agree', gatewayApplied, upstreamApplied);
eq('…and the RESULTING state is never read as the outcome', upstreamApplied.status, 'FINAL_SHORTLIST');
eq('NO_CHANGE is not reported as a successful transition',
  decodeTransition('a', { status: 'NO_CHANGE', currentStatus: 'ACCEPTED' }).outcome, 'NO_CHANGE');
eq('…and still carries the state the row is actually in',
  decodeTransition('a', { status: 'NO_CHANGE', currentStatus: 'ACCEPTED' }).status, 'ACCEPTED');

// ══ 7. The citizen's rows ══════════════════════════════════════

const mine = decodeMyApplications([
  { applicationId: 'a', agency: 'RNP', status: 'SUBMITTED', processingCode: 'RNP-2026-000007', submittedAt: '2026-08-30T00:00:00.000Z' },
]);
eq('the citizen list decodes from a bare array', mine.length, 1);
eq('…and agency comes from the ROW, because a citizen is cross-agency', mine[0]?.agency, 'RNP');
throwsMalformed('an unknown agency on a citizen row is refused, never defaulted',
  () => decodeMyApplications([{ applicationId: 'a', agency: 'RDX', status: 'SUBMITTED' }]), 'listMyApplications');

// ══ 8. D8: the upload answer is DECODED, never cast ════════════
//
// `POST /edge/v1/me/applications/documents` is the one operation whose 2xx
// body is EVIDENCE: the screen prints the revision it carries. A TypeScript
// interface is not a check, so every case below goes through the real
// transport — `createApiClient(...).call('uploadMyDocument', { form })` →
// `fetch` → JSON → decoder — and not through a predicate defined beside the
// assertions.
//
// WHAT THESE CASES DO NOT SAY. A refused answer is NOT proof the upload
// failed: the bytes may be stored and the revision assigned, with only the
// answer unusable. Every refusal here is therefore reported as an UNCONFIRMED
// outcome, and the transport must not re-send the file to find out.

const UPLOAD_DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_ANSWER = JSON.stringify({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision: 1 });

/** One upload through the real transport, with the edge answering `raw`. */
function uploadClient(raw: string, status = 201, counter?: number[]): ReturnType<typeof createApiClient> {
  return createApiClient({
    baseUrl: 'https://portal.usrp.gov.rw',
    fetchImpl: (async () => {
      counter?.push(1);
      return new Response(raw, { status, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch,
  });
}

/** The two things a call can produce: a decoded answer, or the thrown error. */
async function uploadOutcome(raw: string, status = 201, counter?: number[]): Promise<{ answer?: UploadDocumentResponse; error?: unknown }> {
  try {
    const answer = await uploadClient(raw, status, counter).call<UploadDocumentResponse>('uploadMyDocument', { form: new FormData() });
    return { answer };
  } catch (error) {
    return { error };
  }
}

const answerWith = (revision: unknown): string =>
  JSON.stringify({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision });

const withoutRevision = (body: Record<string, unknown>): string =>
  JSON.stringify({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', ...body });

// A body that is not an answer at all.
const NON_ANSWERS: readonly (readonly [string, string])[] = [
  ['JSON null', 'null'],
  ['the string "null"', '"null"'],
  ['an array', '[]'],
  ['a number primitive', '7'],
  ['a string primitive', '"UPLOADED"'],
  ['an empty body', ''],
  ['a 201 that is not JSON', 'UPLOADED 201'],
];

// A JSON object that is not the upload answer.
const DRIFTED_ANSWERS: readonly (readonly [string, string])[] = [
  ['no revision at all', withoutRevision({})],
  ['revision 0', answerWith(0)],
  ['a negative revision', answerWith(-3)],
  ['a fractional revision', answerWith(2.5)],
  ['a stringified revision', answerWith('2')],
  ['a revision past the safe-integer range', answerWith(Number.MAX_SAFE_INTEGER + 1)],
  ['a null revision', answerWith(null)],
  ['a boolean revision', answerWith(true)],
  ['a revision object', answerWith({ value: 2 })],
  ['a status that is not UPLOADED', JSON.stringify({ status: 'REFUSED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision: 1 })],
  ['a documentId that is not a UUID', JSON.stringify({ status: 'UPLOADED', documentId: 'doc-internal-0001', documentType: 'NATIONAL_ID', revision: 1 })],
  ['a documentType that is not a document type', JSON.stringify({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'whatever-the-browser-sent', revision: 1 })],
];

for (const [label, body] of NON_ANSWERS) {
  const { answer, error } = await uploadOutcome(body);
  ok(`${label} is refused instead of rendered as a receipt`, answer === undefined, 'it decoded instead of throwing');
  ok(`…and ${label} is named an UNCONFIRMED upload outcome, not a failure`, isUnconfirmedUploadOutcome(error),
    `got ${error instanceof Error ? error.message : String(error)}`);
}

for (const [label, body] of DRIFTED_ANSWERS) {
  const { answer, error } = await uploadOutcome(body);
  ok(`a 201 with ${label} is refused`, answer === undefined, 'it decoded instead of throwing');
  ok(`…and ${label} is reported as an UNCONFIRMED outcome`, isUnconfirmedUploadOutcome(error),
    `got ${error instanceof Error ? error.message : String(error)}`);
}

// The two cases JSON cannot express, straight through the decoder.
throwsMalformed('NaN is not a revision', () => decodeUploadAnswer({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision: Number.NaN }), 'uploadMyDocument');
throwsMalformed('Infinity is not a revision', () => decodeUploadAnswer({ status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision: Number.POSITIVE_INFINITY }), 'uploadMyDocument');

// The well-formed answers, including the two the journey actually produces.
deepEq('a first upload decodes to revision 1', await uploadClient(VALID_ANSWER).call('uploadMyDocument', { form: new FormData() }),
  { status: 'UPLOADED', documentId: UPLOAD_DOCUMENT_ID, documentType: 'NATIONAL_ID', revision: 1 });
eq('a replacement decodes to the revision the server assigned, not revision+1',
  (await uploadClient(answerWith(2)).call<UploadDocumentResponse>('uploadMyDocument', { form: new FormData() })).revision, 2);

// The decoder is an ALLOWLIST, not a pass-through: forensics verdict, score,
// lane, flags, HMAC, object key and revision history are internal, and a
// future edge that starts echoing them must not move them into the DOM.
const tainted = decodeUploadAnswer({
  status: 'UPLOADED',
  documentId: UPLOAD_DOCUMENT_ID,
  documentType: 'NATIONAL_ID',
  revision: 3,
  lane: 'GREEN',
  forensicsScore: 3,
  flags: ['LOW_RESOLUTION'],
  contentHmac: 'deadbeef',
  objectKey: 'applications/a/NATIONAL_ID/3',
  superseded: [1, 2],
});
deepEq('a tainted 201 decodes to the four allowlisted fields and nothing else',
  Object.keys(tainted).sort(), ['documentId', 'documentType', 'revision', 'status']);
eq('…keeping the revision the server assigned', tainted.revision, 3);

// An unconfirmed outcome must not trigger a second upload: upstream, an
// identical re-upload is a RETRY — same revision, no new history entry — so
// resending cannot repair a lost answer and only muddies the record.
const uploadCalls: number[] = [];
await uploadOutcome(withoutRevision({}), 201, uploadCalls);
eq('an unconfirmed upload is NOT retried by the transport', uploadCalls.length, 1);

// The decoder is keyed by operation: every other answer keeps its own contract.
deepEq('a bare array is still a valid answer to listMyApplications',
  await uploadClient('[]', 200).call('listMyApplications'), []);
const noBodyClient = createApiClient({
  baseUrl: 'https://portal.usrp.gov.rw',
  fetchImpl: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
});
deepEq('a 204 with no body is still a valid answer to a command',
  await noBodyClient.call('withdrawMyApplication', { body: { applicationId: 'a' } }), {});

// The message a citizen could see is generic: the drift stays in `detail`,
// which no screen renders.
const { error: driftError } = await uploadOutcome(answerWith('2'));
ok('the citizen-facing message names no drift', driftError instanceof Error && driftError.message === 'The server returned an unexpected response.',
  `got ${driftError instanceof Error ? driftError.message : String(driftError)}`);

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ decode selfcheck FAILED — ${failures.length} of ${total} assertions\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ decode selfcheck GREEN — ${passed} assertions\n\n`);
