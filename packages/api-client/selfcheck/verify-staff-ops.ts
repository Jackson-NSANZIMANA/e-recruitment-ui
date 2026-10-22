// ══════════════════════════════════════════════════════════════════
// @usrp/api-client selfcheck — S06 operations (staff, search, evidence, erasure)
// ══════════════════════════════════════════════════════════════════
import { ApiError } from '../src/errors.js';
import { createApiClient } from '../src/transport.js';
import { EDGE_OPERATIONS, operation } from '../src/paths.js';
import { PENDING_EDGE_OPERATIONS } from '../src/pending.js';
import { searchQuery } from '../src/operations/ops-reads.js';
import { activateOfficer, assignOfficerPosts, createOfficer, listOfficers, releaseOfficerActivation } from '../src/operations/staff.js';
import { decideErasureRequest } from '../src/operations/ops-reads.js';

let passed = 0;
const failures: string[] = [];
const ok = (label: string, c: boolean): void => { if (c) passed += 1; else failures.push(label); };

const calls: { url: string; init: RequestInit }[] = [];
let status = 200;
let body: unknown = {};
const client = createApiClient({
  baseUrl: 'http://edge.test',
  readCsrfToken: () => 'csrf-token',
  newCorrelationId: () => 'cid',
  fetchImpl: (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }) as unknown as typeof fetch,
});

// Registry
ok('every staff operation is registered except the pending release',
  ['listOfficers', 'createOfficer', 'reissueOfficerActivation', 'assignOfficerPosts', 'disableOfficer', 'enableOfficer', 'revokeOfficerSessions', 'activateOfficer', 'searchApplications', 'getBiometricEvidence', 'listErasureRequests', 'decideErasureRequest'].every((id) => EDGE_OPERATIONS.some((o) => o.id === id)));
ok('CONTRACT-PENDING ids are not in EDGE_OPERATIONS (move them when the backend merges)',
  PENDING_EDGE_OPERATIONS.every((p) => !EDGE_OPERATIONS.some((o) => (o.id as string) === p.id)));
ok('the pending release resolves through operation() with no retry', operation('releaseOfficerActivation').retryOnG2G === false);
ok('no staff write is retryable', ['createOfficer', 'reissueOfficerActivation', 'assignOfficerPosts', 'disableOfficer', 'enableOfficer', 'revokeOfficerSessions', 'activateOfficer', 'decideErasureRequest'].every((id) => !operation(id).retryOnG2G));
ok('activateOfficer is the only anonymous staff operation', operation('activateOfficer').session === 'anonymous' && operation('createOfficer').session === 'officer');

// Query building
ok('search: status travels comma-separated, empty filters are dropped', JSON.stringify(searchQuery({ status: ['DOCUMENT_REVIEW_AMBER', 'ADJUDICATION_REVIEW'], category: '', limit: 50 })) === JSON.stringify({ status: 'DOCUMENT_REVIEW_AMBER,ADJUDICATION_REVIEW', limit: '50' }));
ok('search: no filters is an empty query', Object.keys(searchQuery({})).length === 0);

// Wire behaviour
await listOfficers(client);
ok('listOfficers is a GET to the staff path', calls[0]!.url === 'http://edge.test/edge/v1/officers' && calls[0]!.init.method === 'GET');
body = { outcome: 'CREATED', officer: {} };
status = 201;
await createOfficer(client, { loginHandle: 'rdf.med.one', posts: ['medical_officer'] });
const create = calls[1]!;
ok('createOfficer posts exactly {loginHandle, posts} with CSRF and no agency', create.init.body === JSON.stringify({ loginHandle: 'rdf.med.one', posts: ['medical_officer'] }) && (create.init.headers as Record<string, string>)['x-csrf-token'] === 'csrf-token');
status = 200; body = { outcome: 'RELEASED', officer: {}, activation: { code: 'AAAAA-BBBBB-CCCCC-DDDDD', expiresAt: 'x' } };
await releaseOfficerActivation(client, { targetOfficerId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9' });
ok('release posts only targetOfficerId to the release path', calls[2]!.url.endsWith('/edge/v1/officers/activation/release') && calls[2]!.init.body === JSON.stringify({ targetOfficerId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9' }));

// Refusals are typed, writes are never retried
status = 403; body = { error: 'SAME_ADMIN' };
let sameAdmin = false;
const before = calls.length;
try { await releaseOfficerActivation(client, { targetOfficerId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9' }); } catch (e) { sameAdmin = e instanceof ApiError && e.normalised.kind === 'forbidden' && e.normalised.code === 'SAME_ADMIN'; }
ok('a SAME_ADMIN refusal is a forbidden ApiError carrying its code, sent once', sameAdmin && calls.length === before + 1);
status = 503; body = { error: 'UPSTREAM_UNAVAILABLE' };
const b2 = calls.length;
try { await assignOfficerPosts(client, { targetOfficerId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9', posts: ['reviewer'], reasonCode: 'CORRECTION' }); } catch { /* expected */ }
ok('assign posts is not retried on 503', calls.length === b2 + 1);
status = 409; body = { error: 'REFUSED_ACTIVE_APPLICATION' };
let conflict = false;
try { await decideErasureRequest(client, { requestId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9', decision: 'EXECUTE' }); } catch (e) { conflict = e instanceof ApiError && e.normalised.kind === 'conflict' && e.normalised.outcome === 'REFUSED_ACTIVE_APPLICATION'; }
ok('an erasure refusal is a typed conflict', conflict);
status = 204; body = {};
await activateOfficer(client, { loginHandle: 'rdf.med.one', activationCode: 'AAAAA-BBBBB-CCCCC-DDDDD', password: 'a-long-enough-password' });
ok('activation posts exactly the three fields', calls[calls.length - 1]!.init.body === JSON.stringify({ loginHandle: 'rdf.med.one', activationCode: 'AAAAA-BBBBB-CCCCC-DDDDD', password: 'a-long-enough-password' }));

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ staff-ops selfcheck FAILED — ${failures.length} of ${total}\n`);
  for (const f of failures) process.stderr.write(`    ✗ ${f}\n`);
  process.exit(1);
}
process.stdout.write(`\n  ✓ staff-ops selfcheck GREEN — ${passed} assertions\n\n`);
