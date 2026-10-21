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
export const EDGE_BASE_URL: string = import.meta.env.DEV ? "" : requireEnv("VITE_EDGE_URL");

/**
 * Where the Field Station is served (field.<domain> in a deployment; ADR-FE-007).
 * Used only for the "this screen moved" link, never for an API call. Empty when
 * unset in production: the notice then names the app without linking to it.
 */
export const FIELD_STATION_URL: string =
  (import.meta.env as Record<string, string | undefined>)["VITE_FIELD_STATION_URL"] ??
  (import.meta.env.DEV ? "http://localhost:3002" : "");
