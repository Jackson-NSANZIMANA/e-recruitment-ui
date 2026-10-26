#!/usr/bin/env node
import { runSelfchecks } from '../../ci/selfcheck-junit.mjs';

process.exit(runSelfchecks('@usrp/surface-contract', [{ name: 'src/cli.ts', command: 'node', args: ['--experimental-strip-types', 'src/cli.ts'] }]));
