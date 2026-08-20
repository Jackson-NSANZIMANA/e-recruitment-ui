/// <reference types="vite/client" />

/**
 * Runtime environment for the applicant portal.
 */

function requireEnv(key: string): string {
  const value =
    (import.meta.env as Record<string, string | undefined>)[key] ?? "";
  if (value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Base URL of the applicant-facing BFF endpoint. */
export const BFF_BASE_URL: string =
  import.meta.env.DEV
    ? "/api"
    : requireEnv("VITE_BFF_URL");
