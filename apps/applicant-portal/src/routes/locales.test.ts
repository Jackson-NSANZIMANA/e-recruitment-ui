import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The apply and documents copy lives in the citizen_apply namespace, registered by the lazy routes. A component
// that calls a bare useTranslation() looks only in `common` and renders the RAW KEY: the surface gate cannot see
// this, because it resolves a key against every bundle. These checks pin the call sites instead.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string => readFileSync(join(HERE, rel), "utf8");

describe("citizen_apply namespace call sites", () => {
  it.each(["documents/index.tsx", "apply/CategoryRules.tsx"])("%s never calls a bare useTranslation()", (file) => {
    const source = read(file);
    expect(source).toContain("CITIZEN_APPLY_NAMESPACES");
    expect(source).not.toMatch(/useTranslation\(\s*\)/);
  });

  it("the NIDA block in apply/index.tsx reads its copy from the namespace", () => {
    const source = read("apply/index.tsx");
    const start = source.indexOf("function NidaIdentityBlock");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 400);
    expect(body).toContain("useTranslation(CITIZEN_APPLY_NAMESPACES)");
  });
});
