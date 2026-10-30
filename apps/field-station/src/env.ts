/// <reference types="vite/client" />

/**
 * Runtime environment for the Field Station (the exam-day tablet app).
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
 * Optional: the scheduling public key (base64 of the PEM, `QR_INVITATION_PUBLIC_KEY_B64`) baked into the
 * build so a tablet can check a pass offline without a paste. A public key, never a secret.
 */
export const SLOT_TRUST_ANCHOR_B64: string | undefined =
  (import.meta.env as Record<string, string | undefined>)["VITE_SLOT_TRUST_ANCHOR_B64"] || undefined;
