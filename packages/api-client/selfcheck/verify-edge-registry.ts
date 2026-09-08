import { EDGE_OPERATIONS, assertPathsMatchContract } from '../src/paths.js';

const expectedEdgeOwned = new Set(['officerLogout', 'readSession', 'refreshSession']);
const operationIds = new Set(EDGE_OPERATIONS.map((operation) => operation.id));
const upstreamIds = EDGE_OPERATIONS.filter((operation) => operation.upstreamOperationId !== null).map((operation) => operation.upstreamOperationId);

if (operationIds.size !== EDGE_OPERATIONS.length) throw new Error('EDGE_OPERATIONS contains duplicate ids.');
for (const operation of EDGE_OPERATIONS) {
  if (operation.edgePath.includes('${') || operation.edgePath.includes(':')) throw new Error(`${operation.id} has a templated path.`);
  if (expectedEdgeOwned.has(operation.id) !== (operation.upstreamOperationId === null)) {
    throw new Error(`${operation.id} must explicitly declare whether it is edge-owned.`);
  }
}
if (upstreamIds.includes('officerLogin') && EDGE_OPERATIONS.find((operation) => operation.id === 'officerLogout')?.upstreamOperationId === 'officerLogin') {
  throw new Error('officerLogout must not masquerade as officerLogin.');
}
assertPathsMatchContract();
console.log(`edge registry selfcheck OK: ${EDGE_OPERATIONS.length} operations`);
