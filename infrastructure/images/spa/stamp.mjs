#!/usr/bin/env node
// Stamp a built SPA with its build facts (ADR-FE-014), at image build time:
//   • /version.json  { app, build: { sha, ref, time }, edgeOrigin }
//   • <meta name="usrp-build-sha" content="<sha>"> in index.html
//   • source maps removed (they are `sourcemap: "hidden"` build output, not
//     something a public origin should serve).
// Values are validated, not echoed, like the backend's GET /version.
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2];
if (!dist) throw new Error('usage: stamp.mjs <dist>');
const pick = (value, shape) => (shape.test((value ?? '').trim()) ? value.trim() : 'unknown');
const sha = pick(process.env.USRP_BUILD_SHA, /^[0-9a-f]{7,40}$/);
const version = {
  app: pick(process.env.USRP_APP, /^[a-z][a-z0-9-]{0,63}$/),
  build: {
    sha,
    ref: pick(process.env.USRP_BUILD_REF, /^[A-Za-z0-9._/-]{1,128}$/),
    time: pick(process.env.USRP_BUILD_TIME, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/),
  },
  edgeOrigin: pick(process.env.USRP_EDGE_URL, /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/),
};
writeFileSync(join(dist, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);

const indexFile = join(dist, 'index.html');
const html = readFileSync(indexFile, 'utf8');
const meta = `<meta name="usrp-build-sha" content="${sha}" />`;
if (!/<meta charset="UTF-8" \/>/i.test(html)) throw new Error('index.html has no <meta charset> to anchor the build stamp');
writeFileSync(indexFile, html.replace(/(<meta charset="UTF-8" \/>)/i, `$1\n    ${meta}`));

let removed = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.map')) { rmSync(path); removed += 1; }
  }
};
walk(dist);
console.log(`stamped ${dist}: ${JSON.stringify(version)}; removed ${removed} source maps`);
