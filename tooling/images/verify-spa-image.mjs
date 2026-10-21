#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// verify-spa-image.mjs — boot a built SPA image and prove its serving contract
// (ADR-FE-014). Runs in CI after every SPA image build, and locally:
//
//   node tooling/images/verify-spa-image.mjs --image usrp-applicant-portal:dev \
//     [--sha <expected build sha>] [--camera]
//
// It starts the image TWICE, both times hardened the way production should
// run it (read-only root filesystem, every capability dropped, tmpfs /tmp):
//
//   1. USRP_EDGE_MODE=off   — /edge and /edge/** answer 404, never the shell;
//   2. USRP_EDGE_MODE=proxy — /edge/** reaches a stub upstream verbatim, with
//                             the same security headers on the response.
//
// and asserts the headers (CSP without inline script, HSTS, nosniff,
// no-referrer, Permissions-Policy), the cache policy (no-cache on the shell,
// sw.js, registerSW.js, the manifest and version.json; immutable hashed
// assets), the SPA fallback (deep routes get the shell, missing files with
// an extension get 404), the build stamp, and that no source map is served.
//
// Zero dependencies; needs docker. Exits non-zero on any failed check.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const image = opt('--image');
const expectedSha = opt('--sha');
const camera = flag('--camera');
if (!image) { console.error('usage: verify-spa-image.mjs --image <ref> [--sha <sha>] [--camera]'); process.exit(2); }

let pass = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.error(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`); }
}

const docker = (...a) => execFileSync('docker', a, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(env) {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  const id = docker('run', '-d', '--rm', '--read-only', '--tmpfs', '/tmp:uid=65532,gid=65532', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--add-host', 'host.docker.internal:host-gateway',
    '-p', '127.0.0.1::8080', ...envArgs, image);
  const port = docker('port', id, '8080/tcp').split('\n')[0].split(':').pop();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { id, base }; } catch { /* not up yet */ }
    await sleep(250);
  }
  const logs = (() => { try { return docker('logs', id); } catch { return '(no logs)'; } })();
  try { docker('rm', '-f', id); } catch { /* already gone */ }
  throw new Error(`container never became healthy:\n${logs}`);
}

const get = async (base, path) => {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' });
  return { status: res.status, headers: res.headers, body: await res.text() };
};
const isShell = (body) => body.includes('<div id="root">');

function securityHeaders(label, h) {
  const csp = h.get('content-security-policy') ?? '';
  const scriptSrc = /script-src ([^;]*)/.exec(csp)?.[1] ?? '';
  check(`${label}: CSP present with default-src 'self'`, csp.includes("default-src 'self'"), csp);
  check(`${label}: CSP script-src is 'self' only (no inline, no eval)`, scriptSrc.trim() === "'self'", scriptSrc);
  check(`${label}: CSP forbids framing and plugins`, csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));
  const hsts = /max-age=(\d+)/.exec(h.get('strict-transport-security') ?? '');
  check(`${label}: HSTS max-age ≥ 1 year`, hsts !== null && Number(hsts[1]) >= 31_536_000, h.get('strict-transport-security') ?? 'absent');
  check(`${label}: X-Content-Type-Options nosniff`, h.get('x-content-type-options') === 'nosniff');
  check(`${label}: Referrer-Policy no-referrer`, h.get('referrer-policy') === 'no-referrer');
  const pp = h.get('permissions-policy') ?? '';
  check(`${label}: Permissions-Policy camera=${camera ? '(self)' : '()'}`, pp.includes(camera ? 'camera=(self)' : 'camera=()'), pp);
  check(`${label}: no Server banner`, h.get('server') === null, h.get('server') ?? '');
}

const containers = [];
let stub;
try {
  console.log(`\n══ ${image}: user and edge-off mode`);
  const user = docker('image', 'inspect', '-f', '{{.Config.User}}', image);
  check('runs as a non-root user', user !== '' && !/^(0|root)(:|$)/.test(user), user);

  const off = await start({ USRP_EDGE_MODE: 'off' });
  containers.push(off.id);

  const root = await get(off.base, '/');
  check('/ serves the SPA shell', root.status === 200 && isShell(root.body), String(root.status));
  securityHeaders('/', root.headers);
  check('/ is revalidated (no-cache)', root.headers.get('cache-control') === 'no-cache', root.headers.get('cache-control') ?? '');
  const stamp = /<meta name="usrp-build-sha" content="([^"]+)"/.exec(root.body)?.[1];
  check('index.html carries the build SHA meta tag', stamp !== undefined && (expectedSha === undefined || stamp === expectedSha), stamp);
  check('index.html has no inline <script> body', !/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(root.body));

  const deep = await get(off.base, '/applications/123/exam-qr');
  check('deep client route falls back to the shell', deep.status === 200 && isShell(deep.body), String(deep.status));
  check('fallback shell is no-cache', deep.headers.get('cache-control') === 'no-cache');

  for (const path of ['/edge', '/edge/', '/edge/v1/session', '/edge/v1/campaigns?x=1', '/edge/unknown/deep/path']) {
    const r = await get(off.base, path);
    check(`${path} → 404, never the shell (edge off)`, r.status === 404 && !isShell(r.body), `${r.status}`);
  }
  const edgeish = await get(off.base, '/edgewise');
  check('/edgewise is a client route, not the edge', edgeish.status === 200 && isShell(edgeish.body));

  for (const path of ['/sw.js', '/registerSW.js', '/manifest.webmanifest', '/version.json']) {
    const r = await get(off.base, path);
    check(`${path} served and no-cache`, r.status === 200 && r.headers.get('cache-control') === 'no-cache', `${r.status} ${r.headers.get('cache-control')}`);
  }
  const version = JSON.parse((await get(off.base, '/version.json')).body);
  check('/version.json names the app and the build', typeof version.app === 'string' && /^[0-9a-f]{7,40}$|^unknown$/.test(version.build?.sha ?? ''), JSON.stringify(version));
  if (expectedSha !== undefined) check('/version.json build SHA matches', version.build?.sha === expectedSha, version.build?.sha);

  const asset = /src="(\/assets\/[^"]+\.js)"/.exec(root.body)?.[1];
  check('index.html references a hashed /assets bundle', asset !== undefined);
  if (asset !== undefined) {
    const a = await get(off.base, asset);
    check(`${asset} is immutable`, a.status === 200 && (a.headers.get('cache-control') ?? '').includes('immutable'), a.headers.get('cache-control') ?? '');
    const map = await get(off.base, `${asset}.map`);
    check('source maps are not served', map.status === 404 && !isShell(map.body), String(map.status));
  }
  for (const path of ['/assets/missing-0000.js', '/missing.png', '/favicon-nope.ico']) {
    const r = await get(off.base, path);
    check(`${path} → 404, not the shell`, r.status === 404 && !isShell(r.body), String(r.status));
  }

  console.log(`\n══ ${image}: edge-proxy mode (stub upstream)`);
  stub = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ stub: true, method: req.method, url: req.url, host: req.headers.host ?? null }));
  });
  await new Promise((r) => stub.listen(0, '0.0.0.0', r));
  const stubPort = stub.address().port;
  const proxy = await start({ USRP_EDGE_MODE: 'proxy', USRP_EDGE_UPSTREAM: `http://host.docker.internal:${stubPort}` });
  containers.push(proxy.id);
  const proxied = await get(proxy.base, '/edge/v1/campaigns?status=open');
  let body = {};
  try { body = JSON.parse(proxied.body); } catch { /* checked below */ }
  check('/edge/** reaches the upstream with path and query intact', proxied.status === 200 && body.stub === true && body.url === '/edge/v1/campaigns?status=open', proxied.body.slice(0, 120));
  securityHeaders('proxied /edge response', proxied.headers);
  const shellViaProxy = await get(proxy.base, '/dashboard');
  check('client routes still get the shell in proxy mode', shellViaProxy.status === 200 && isShell(shellViaProxy.body));
} catch (error) {
  failures.push(String(error.message ?? error));
  console.error(`  ✗ ${error.message ?? error}`);
} finally {
  for (const id of containers) { try { docker('rm', '-f', id); } catch { /* gone */ } }
  stub?.close();
}

console.log(`\n${failures.length === 0 ? `SPA IMAGE CONTRACT GREEN — ${pass} checks` : `${failures.length} failed, ${pass} passed`}`);
process.exit(failures.length === 0 ? 0 : 1);
