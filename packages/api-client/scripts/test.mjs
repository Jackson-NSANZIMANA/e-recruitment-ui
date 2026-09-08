#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

for (const file of ['selfcheck/verify-api-client.ts', 'selfcheck/verify-edge-registry.ts']) {
  const result = spawnSync('pnpm', ['exec', 'tsx', file], { stdio: 'inherit' });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
