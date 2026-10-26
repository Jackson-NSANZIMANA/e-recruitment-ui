#!/usr/bin/env node
import { runSelfchecks } from '../../../tooling/ci/selfcheck-junit.mjs';

process.exit(runSelfchecks('@usrp/auth', [{ name: 'selfcheck/verify-auth.ts', command: 'pnpm', args: ['exec', 'tsx', 'selfcheck/verify-auth.ts'] }]));
