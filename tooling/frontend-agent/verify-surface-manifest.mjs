#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);
const manifestPath = resolve(root, 'docs/architecture/frontend-agent/officer.applications.json');
const pathsPath = resolve(root, 'packages/api-client/src/paths.ts');

function fail(message) {
  console.error(`SURFACE MANIFEST FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(manifestPath)) fail('manifest is missing');
if (!existsSync(pathsPath)) fail('api-client operation registry is missing');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const paths = readFileSync(pathsPath, 'utf8');
const backendShaMatch = paths.match(/EDGE_BACKEND_SHA = '([0-9a-f]{40})'/);
if (!backendShaMatch) fail('EDGE_BACKEND_SHA is missing from api-client paths');
if (manifest.backend.mainSha !== backendShaMatch[1]) fail(`manifest backend SHA ${manifest.backend.mainSha} does not match api-client EDGE_BACKEND_SHA ${backendShaMatch[1]}`);
const ciPath = resolve(root, '.github/workflows/ci.yml');
const ciShaMatch = existsSync(ciPath) ? readFileSync(ciPath, 'utf8').match(/^\s*BACKEND_SHA:\s*([0-9a-f]{40})\s*$/m) : null;
if (!ciShaMatch) fail('BACKEND_SHA is missing from .github/workflows/ci.yml');
if (ciShaMatch[1] !== backendShaMatch[1]) fail(`api-client EDGE_BACKEND_SHA ${backendShaMatch[1]} does not match the backend CI checks out (${ciShaMatch[1]})`);

for (const key of ['schemaVersion', 'surfaceId', 'status', 'host', 'route', 'persona', 'goal', 'backend', 'operations', 'stateModel', 'adsPlan', 'accessibility', 'verification']) {
  if (!(key in manifest)) fail(`missing required field: ${key}`);
}
if (manifest.status !== 'implementation' && manifest.status !== 'verified') fail(`unsupported status: ${manifest.status}`);
if (manifest.operations.length === 0) fail('no edge operations declared');
if (new Set(manifest.operations).size !== manifest.operations.length) fail('duplicate edge operation in manifest');
if (new Set(manifest.stateModel).size !== manifest.stateModel.length) fail('duplicate state in manifest');

const operationIds = new Set([...paths.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1]));
for (const operation of manifest.operations) {
  if (!operationIds.has(operation)) fail(`manifest operation is absent from packages/api-client/src/paths.ts: ${operation}`);
}

const requiredComponents = ['Heading', 'DynamicTable', 'Lozenge', 'Button', 'TextField', 'SectionMessage'];
for (const component of requiredComponents) {
  if (!manifest.adsPlan.components.includes(component)) fail(`ADS plan is missing required component: ${component}`);
}

for (const lane of ['contract', 'unit', 'a11y', 'e2e', 'visual']) {
  if (typeof manifest.verification[lane] !== 'string' || manifest.verification[lane].length < 8) fail(`verification.${lane} is not defined`);
}

if ((manifest.status === 'implementation' || manifest.status === 'verified') && manifest.verification.visual.length === 0) fail('visual verification is required before implementation can be considered complete');
if (manifest.status === 'verified' && manifest.knownBlockers.length > 0) fail('verified surface cannot contain blockers');

console.log(`SURFACE MANIFEST PASS: ${manifest.surfaceId}`);
console.log(`  backend: ${manifest.backend.repository}@${manifest.backend.mainSha}`);
console.log(`  operations: ${manifest.operations.length}`);
console.log(`  states: ${manifest.stateModel.length}`);
