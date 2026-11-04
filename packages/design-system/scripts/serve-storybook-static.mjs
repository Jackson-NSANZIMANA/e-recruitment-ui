#!/usr/bin/env node
/**
 * A ten-line static server for the built Storybook, used by the visual gate.
 *
 * WHY NOT `python3 -m http.server`, which run-storybook-a11y.sh uses: that
 * script is bash and can rely on the interpreter, but this server is spawned by
 * Playwright's webServer, which inherits `pnpm`'s PATH and nothing else. A Node
 * server is the one thing guaranteed to exist in that environment, and it
 * removes an OS-level dependency from a gate that must run identically on a
 * contributor's laptop and in CI.
 *
 * WHY NOT `npx serve`: it is a download, and a gate that needs the network is a
 * gate that fails when the registry does.
 *
 * Deliberately minimal: GET, a small set of content types, a directory index of
 * index.html, 404 otherwise. It serves a build artefact to a browser on
 * loopback; it is not a product server and must not grow into one.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? 'storybook-static');
const PORT = Number(process.argv[3] ?? 6007);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.json'))) {
  console.error('[serve-storybook-static] no index.json in ' + ROOT + ' - build Storybook first.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);

  // Path traversal guard: a static server for an artefact still reads from disk,
  // and `../` must not escape the build directory.
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    // The visual gate reuses no server, but a cached stylesheet across a rebuild
    // would be exactly the stale artefact the gate exists to catch.
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log('[serve-storybook-static] ' + ROOT + ' on http://127.0.0.1:' + String(PORT));
});
