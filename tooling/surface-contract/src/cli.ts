#!/usr/bin/env node
import { formatSurfaceReport, loadSurfaceContract, verifySurfaceContract } from './verify.ts';

const root = process.cwd();
const args = process.argv.slice(2);
const manifest = args[args.indexOf('--manifest') + 1] ?? 'docs/ui-surfaces/officer.application-workspace.json';

try {
  const contract = loadSurfaceContract(root, manifest);
  const result = verifySurfaceContract(contract, root);
  console.log(formatSurfaceReport(manifest, result));
  if (result.findings.length > 0) process.exit(1);
} catch (error) {
  console.error(`surface-contract\n  status: ERROR\n  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
