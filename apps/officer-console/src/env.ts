/// <reference types="vite/client" />

/**
 * Runtime environment for the officer console.
 *
 * The browser talks to the single edge origin. It never targets a service,
 * agency BFF, or system-token endpoint directly.
 */
function requireEnv(key: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key] ?? "";
  if (value === "") throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

/** Base URL of the browser-facing edge gateway. */
export const EDGE_BASE_URL: string = import.meta.env.DEV ? "/edge" : requireEnv("VITE_EDGE_URL");
