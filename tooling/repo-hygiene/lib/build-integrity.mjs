/**
 * Predicates for the build-integrity gates (verify-font-faces.mjs, verify-bundle-env.mjs).
 * Pure functions over text, so test/build-integrity.test.mjs can prove both directions without a build.
 * Zero dependencies.
 */

/** Split a declaration block on `;`, ignoring semicolons inside parentheses or quotes. */
function declarations(block) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (const ch of block) {
    if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
    });
}

const unquote = (v) => v.replace(/^["']|["']$/g, '');

/**
 * Every `@font-face` rule in a stylesheet, with its descriptors and how often each occurs.
 * `repeated` lists descriptors declared more than once: in one @font-face the last one wins, so a
 * repeated `font-family` or `src` means several faces were merged into one.
 */
export function parseFontFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^{}]*)\}/g)) {
    const counts = {};
    const values = {};
    for (const [name, value] of declarations(m[1])) {
      counts[name] = (counts[name] ?? 0) + 1;
      values[name] = value;
    }
    const urls = [...(values.src ?? '').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((u) => u[1]);
    faces.push({
      family: unquote(values['font-family'] ?? ''),
      style: (values['font-style'] ?? 'normal').toLowerCase(),
      weight: values['font-weight'] ?? 'normal',
      urls,
      repeated: Object.keys(counts).filter((k) => counts[k] > 1),
    });
  }
  return faces;
}

const faceKey = (f) => `${f.family} / ${f.style} / ${f.weight}`;
/** `./files/AtlassianSans.v3.woff2` -> `AtlassianSans.v3`; `/assets/AtlassianSans.v3-CnihQLrr.woff2` -> its file name. */
const stem = (url) => url.split('/').pop().replace(/\.woff2$/, '');

/**
 * Does a build carry every source face as its own rule?
 *   sourceCss    the design system's fonts.css
 *   builtCss     every CSS asset of one app's dist, concatenated
 *   emitted      file names under that dist (e.g. ["assets/AtlassianSans.v3-CnihQLrr.woff2", ...])
 * Returns human-readable findings; an empty list means the fonts survived.
 */
export function fontFaceFindings(sourceCss, builtCss, emitted) {
  const findings = [];
  const source = parseFontFaces(sourceCss);
  const built = parseFontFaces(builtCss);
  if (source.length === 0) findings.push('the source stylesheet declares no @font-face at all');
  for (const f of built) {
    if (f.repeated.length > 0) {
      findings.push(`a built @font-face repeats ${f.repeated.join(', ')} (faces were merged; the browser keeps only the last values): ${faceKey(f)}`);
    }
  }
  for (const want of source) {
    const matches = built.filter((b) => faceKey(b) === faceKey(want));
    if (matches.length !== 1) {
      findings.push(`${faceKey(want)}: expected exactly one built @font-face, found ${matches.length}`);
      continue;
    }
    const wantStem = stem(want.urls[0] ?? '');
    const url = matches[0].urls[0] ?? '';
    const file = url.replace(/^\//, '');
    if (!file.split('/').pop().startsWith(wantStem + '-') && stem(file) !== wantStem) {
      findings.push(`${faceKey(want)}: src ${url} is not the ${wantStem} file`);
    } else if (!emitted.includes(file)) {
      findings.push(`${faceKey(want)}: src ${url} was not emitted into the build`);
    }
  }
  return findings;
}

/**
 * Has Vite inlined the whole `import.meta.env` object into a bundle?
 * A literal `import.meta.env.VITE_X` is replaced by its value, leaving no key behind. A computed or
 * optional access makes Vite substitute the object itself, which then carries every VITE_* variable
 * of the build: `{BASE_URL:"/",DEV:!1,MODE:"production",...,VITE_EDGE_URL:"..."}`.
 * Returns the VITE_* keys found in such objects.
 */
export function inlinedEnvKeys(js) {
  const keys = new Set();
  for (const m of js.matchAll(/\{[^{}]*\bBASE_URL:[^{}]*\}/g)) {
    for (const k of m[0].matchAll(/\b(VITE_[A-Z0-9_]+)\s*:/g)) keys.add(k[1]);
    if (/\bMODE\s*:/.test(m[0])) keys.add('(import.meta.env object)');
  }
  return [...keys];
}

/**
 * The files a browser can actually reach from a build's index.html: its scripts and stylesheets, and
 * every `assets/...` file those reference, transitively (route chunks, their CSS, fonts, images).
 * A Turbo cache restore writes its files over dist/ without removing other builds' files, so dist can
 * hold orphans; a gate must judge what the app loads, not what happens to lie in the directory.
 *   read(path) returns a file's text, or null when it does not exist
 */
export function reachableAssets(indexHtml, read) {
  const seen = new Set();
  const queue = [];
  const add = (ref) => {
    const p = ref.replace(/^\.?\//, '').split(/[?#]/)[0];
    if (p && !seen.has(p) && read(p) !== null) { seen.add(p); queue.push(p); }
  };
  for (const m of indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)) add(m[1]);
  while (queue.length > 0) {
    const p = queue.shift();
    if (!/\.(js|css)$/.test(p)) continue;
    for (const m of read(p).matchAll(/assets\/[A-Za-z0-9._-]+\.[a-z0-9]+/g)) add(m[0]);
  }
  return [...seen];
}
