#!/usr/bin/env node
import { runSelfchecks } from '../../ci/selfcheck-junit.mjs';

process.exit(runSelfchecks('@usrp/edge-dev', [{ name: 'selfcheck/verify-edge.ts', command: 'node', args: ['--experimental-strip-types', 'selfcheck/verify-edge.ts'] }]));
