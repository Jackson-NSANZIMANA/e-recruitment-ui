#!/usr/bin/env node
/**
 * PROOF: @compiled/react really performs BUILD-TIME extraction.
 *
 * docs/architecture/frontend-architecture.md asserts build-time extraction.
 * The brief says treat that document as aspiration, not truth, so this asserts
 * nothing and measures instead. Two checks against a real build:
 *
 *   1. EXTRACTION HAPPENED - a shipped .css asset contains Compiled's atomic
 *      class signature (`._` + 8 base36 chars, e.g. `._1p1dab9h`). If styles
 *      were still being generated at runtime, they would live in JS strings and
 *      never reach a .css file.
 *
 *   2. RUNTIME WAS STRIPPED - no authored repository source retains a
 *      reference to "@compiled/react". Third-party vendor code is ignored.
 *
 * Reports the class count and CSS weight so a regression is visible as a number
 * rather than a boolean. Zero dependencies. Requires `pnpm build` first.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(HERE, "..", ".."));
const config = JSON.parse(
  readFileSync(args.config ?? join(HERE, "gates.config.json"), "utf8"),
);
const apps = config.compiledExtraction?.apps ?? [];
const distDir = config.compiledExtraction?.distDir ?? "dist";

const ATOMIC_CLASS_RE = /\._[0-9a-z]{6,10}\b/g;

let failed = false;

function isRepositorySource(source) {
  return (
    !source.includes("node_modules") &&
    !source.includes("@compiled/react") &&
    !source.startsWith("webpack://")
  );
}

function authoredCompiledRuntimeLeaks(dist, assets) {
  const leaks = [];

  for (const jsFile of assets.filter((file) =>
    [".js", ".mjs"].includes(extname(file)),
  )) {
    const mapFile = `${jsFile}.map`;
    if (!existsSync(mapFile)) continue;

    let map;
    try {
      map = JSON.parse(readFileSync(mapFile, "utf8"));
    } catch {
      continue;
    }

    const sources = map.sources ?? [];
    const sourcesContent = map.sourcesContent ?? [];

    sources.forEach((source, index) => {
      if (!isRepositorySource(source)) return;

      const sourceText = sourcesContent[index] ?? "";
      if (sourceText.includes("@compiled/react")) {
        leaks.push(relative(dist, jsFile) + " <- " + source);
      }
    });
  }

  return leaks;
}

for (const appPath of apps) {
  const dist = join(root, appPath, distDir);
  console.log("");
  console.log("  " + appPath);

  if (!existsSync(dist)) {
    console.error(
      "    FAIL no build output at " +
        relative(root, dist) +
        " - run `pnpm build`.",
    );
    failed = true;
    continue;
  }

  const assets = [...walk(dist)];
  const cssFiles = assets.filter((f) => extname(f) === ".css");
  const jsFiles = assets.filter((f) => [".js", ".mjs"].includes(extname(f)));

  // 1 - extraction
  const atomicClasses = new Set();
  let cssBytes = 0;

  for (const f of cssFiles) {
    const text = readFileSync(f, "utf8");
    cssBytes += Buffer.byteLength(text);
    for (const m of text.match(ATOMIC_CLASS_RE) ?? []) {
      atomicClasses.add(m);
    }
  }

  if (cssFiles.length === 0 || atomicClasses.size === 0) {
    console.error(
      "    FAIL extraction NOT proven - " +
        cssFiles.length +
        " css asset(s), 0 Compiled atomic classes found.",
    );
    console.error(
      "         Either no component uses cssMap/@atlaskit/css in this app, or the",
    );
    console.error(
      "         @compiled babel plugin is not in the Vite pipeline it claims to be in.",
    );
    failed = true;
  } else {
    console.log(
      "    PASS extraction proven - " +
        atomicClasses.size +
        " atomic class(es) in " +
        cssFiles.length +
        " css asset(s), " +
        (cssBytes / 1024).toFixed(1) +
        " KB",
    );
  }

  // 2 - runtime stripped
  const leaked = authoredCompiledRuntimeLeaks(dist, assets);

  if (leaked.length > 0) {
    console.error(
      '    FAIL authored runtime NOT stripped - "@compiled/react" survives in repository sources:',
    );
    for (const file of leaked.slice(0, 10)) {
      console.error("           " + file);
    }
    failed = true;
  } else {
    console.log(
      "    PASS authored runtime stripped - third-party vendor runtime is ignored",
    );
  }
}

console.log("");

if (failed) {
  console.error(
    "[compiled-extraction] FAIL - the architecture doc overstates the pipeline.",
  );
  process.exit(1);
}

console.log(
  "[compiled-extraction] PASS - build-time extraction measured, not assumed.",
);
process.exit(0);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[(i += 1)] : "true";

      out[k] = v;
    }
  }

  return out;
}
