/// <reference types="vite/client" />

/**
 * Runtime environment for the officer console.
 *
 * Vite replaces `import.meta.env.VITE_*` at build time.
 * We centralise all env reads here so that TypeScript catches missing vars
 * and components never import from import.meta.env directly.
 */

function requireEnv(key: string): string {
  const value =
    (import.meta.env as Record<string, string | undefined>)[key] ?? "";
  if (value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Base URL of the agency BFF — e.g. "https://bff.rdf.usrp.gov.rw/api/v1" */
export const BFF_BASE_URL: string =
  import.meta.env.DEV
    ? "/api"
    : requireEnv("VITE_BFF_URL");
