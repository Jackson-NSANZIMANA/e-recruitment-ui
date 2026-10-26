#!/usr/bin/env node
import { runSelfchecks } from '../../../tooling/ci/selfcheck-junit.mjs';

const files = ['selfcheck/verify-api-client.ts', 'selfcheck/verify-edge-registry.ts', 'selfcheck/verify-decode.ts', 'selfcheck/verify-staff-ops.ts'];
process.exit(runSelfchecks('@usrp/api-client', files.map((file) => ({ name: file, command: 'pnpm', args: ['exec', 'tsx', file] }))));
