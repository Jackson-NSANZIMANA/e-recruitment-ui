/// <reference types="vite/client" />

// The variables this app reads, declared so they are read as literal members (see below).
declare global {
  interface ImportMetaEnv {
    readonly VITE_EDGE_URL?: string;
  }
}

/**
 * Runtime environment for the applicant portal.
 *
 * The browser talks to the single edge origin. It never targets a service,
 * agency BFF, or system-token endpoint directly.
 */
function requireEnv(key: string, value: string | undefined): string {
  if ((value ?? "") === "") throw new Error(`Missing required environment variable: ${key}`);
  return value as string;
}

// Every variable is read as a literal `import.meta.env.VITE_*` member, never by computed key:
// Vite replaces a literal member with its value, but a computed or cast-wrapped access makes it
// inline the WHOLE env object (every VITE_* variable of the build) into the bundle.

/** Base URL of the browser-facing edge gateway. */
export const EDGE_BASE_URL: string = import.meta.env.DEV ? "" : requireEnv("VITE_EDGE_URL", import.meta.env.VITE_EDGE_URL);
