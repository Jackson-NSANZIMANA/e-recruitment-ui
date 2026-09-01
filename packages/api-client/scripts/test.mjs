#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const result = spawnSync('pnpm', ['exec', 'tsx', 'selfcheck/verify-api-client.ts'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
