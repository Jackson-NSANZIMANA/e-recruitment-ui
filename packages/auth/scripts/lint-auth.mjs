#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rootPath = new URL('../src/', import.meta.url).pathname;
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
}
function codeOnly(source) {
  return source
    .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
    .replace(/(['\"])(?:\\.|(?!\1)[^\\])*\1/g, '');
}
walk(rootPath);
const failures = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const code = codeOnly(source);
  const rel = file.slice(rootPath.length);
  if (/\b(localStorage|sessionStorage)\b/.test(code)) failures.push(`${rel}: browser credential storage is forbidden`);
  if (/document\.cookie/.test(code) && !rel.endsWith('edge-client.ts')) failures.push(`${rel}: only edge-client.ts may read the CSRF cookie`);
  if (/\bfetch\s*\(/.test(code)) failures.push(`${rel}: auth must call the edge client, never fetch directly`);
  if (/\/api\//.test(code)) failures.push(`${rel}: invented /api/ routes are forbidden`);
}
if (files.length === 0) failures.push('no TypeScript source files found');
if (failures.length) {
  console.error(failures.map((failure) => `✖ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`auth lint passed: ${files.length} source files checked`);
