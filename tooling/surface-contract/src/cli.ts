#!/usr/bin/env node
// surface:verify — every docs/ui-surfaces manifest, every mounted route, every
// rung's evidence (ADR-FE-009). `--manifest <file>` checks one manifest alone
// (no coverage check); `--selftest` proves each rung's check can go red.
import {
  formatSuiteReport,
  formatSurfaceReport,
  loadSurfaceContract,
  verifySurfaceContract,
  verifySurfaceSuite,
} from './verify.ts';
import { runSelftest } from './selftest.ts';

const args = process.argv.slice(2);
// Resolve from this source file, not the caller's cwd. Turbo runs package
// scripts from tooling/surface-contract, while root scripts run from the repo.
const root = new URL('../../../', import.meta.url).pathname;

try {
  if (args.includes('--selftest')) {
    process.exit(runSelftest(root) ? 0 : 1);
  }
  const manifestIndex = args.indexOf('--manifest');
  if (manifestIndex !== -1) {
    const manifest = args[manifestIndex + 1];
    if (manifest === undefined) throw new Error('--manifest needs a path');
    const result = verifySurfaceContract(loadSurfaceContract(root, manifest), root);
    console.log(formatSurfaceReport(manifest, result));
    process.exit(result.findings.some((f) => f.severity === 'error') ? 1 : 0);
  }
  const result = verifySurfaceSuite(root);
  console.log(formatSuiteReport(result));
  if (result.manifests === 0) {
    console.error('  no manifests found under docs/ui-surfaces — a gate with nothing to check is not a gate');
    process.exit(2);
  }
  if (result.findings.length > 0) process.exit(1);
} catch (error) {
  console.error(`surface-contract\n  status: ERROR\n  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
