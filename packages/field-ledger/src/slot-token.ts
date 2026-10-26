// ══════════════════════════════════════════════════════════════════
// The signed slot invitation, verified OFFLINE (ADR-009, baseline §15.3 rung).
//
//   USRP-SLOT.v1.<base64url(canonicalJson(claims))>.<base64url(ed25519 sig)>
//
// The signature covers "USRP-SLOT.v1.<payload>". Verifying needs only the
// scheduling PUBLIC key already on the device. This module can show that a pass
// is genuine and for which venue and day; it CANNOT spend it, because spending
// is the server's single-use decision (admitAtGate). A valid answer here is
// "route to the supervised lane", never "admitted".
//
// `readSlotClaims` decodes WITHOUT verifying: the claims are for routing a
// capture to the right application. The server re-verifies the ticket on every
// write; nothing decoded here is trusted for a decision.
// ══════════════════════════════════════════════════════════════════

import { fromBase64Url } from './canonical.ts';

export interface SlotClaims {
  readonly v: 1;
  readonly keyId: string;
  readonly ticketId: string;
  readonly applicationId: string;
  readonly applicantId: string;
  readonly agency: string;
  readonly campaignId: string;
  readonly slotId: string;
  readonly venueName: string;
  readonly examDate: string;
  readonly reportingTimeHour: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const NAMESPACE = 'USRP-SLOT';
const VERSION = 'v1';

interface Parsed { readonly signingInput: string; readonly signature: string; readonly claims: SlotClaims }

function isClaims(value: unknown): value is SlotClaims {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  const strings = ['keyId', 'ticketId', 'applicationId', 'agency', 'venueName', 'examDate', 'expiresAt'] as const;
  return c['v'] === 1 && strings.every((k) => typeof c[k] === 'string' && (c[k] as string).length > 0);
}

function parse(token: string): Parsed | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== `${NAMESPACE}.${VERSION}`) return null;
    const claims: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[2]!)));
    if (!isClaims(claims)) return null;
    return { signingInput: `${parts[0]}.${parts[1]}.${parts[2]}`, signature: parts[3]!, claims };
  } catch {
    return null;
  }
}

/** Decode only. NOT a verification. */
export function readSlotClaims(token: string): SlotClaims | null {
  return parse(token)?.claims ?? null;
}

/** A trusted scheduling public key, SPKI PEM. `keyId` null = trusted for any key id in the claims. */
export interface TrustAnchor { readonly keyId: string | null; readonly publicKeyPem: string }

export type SlotVerdict =
  | { readonly valid: true; readonly claims: SlotClaims }
  | { readonly valid: false; readonly reason: 'MALFORMED' | 'NO_TRUST_ANCHOR' | 'BAD_SIGNATURE' | 'EXPIRED'; readonly claims: SlotClaims | null };

function derOf(pem: string): Uint8Array {
  return fromBase64Url(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

export async function verifySlotToken(token: string, anchors: readonly TrustAnchor[], now: Date, subtle: SubtleCrypto = crypto.subtle): Promise<SlotVerdict> {
  const parsed = parse(token);
  if (parsed === null) return { valid: false, reason: 'MALFORMED', claims: null };
  const candidates = anchors.filter((a) => a.keyId === null || a.keyId === parsed.claims.keyId);
  if (candidates.length === 0) return { valid: false, reason: 'NO_TRUST_ANCHOR', claims: parsed.claims };
  let signatureOk = false;
  for (const anchor of candidates) {
    try {
      const key = await subtle.importKey('spki', derOf(anchor.publicKeyPem), { name: 'Ed25519' }, false, ['verify']);
      if (await subtle.verify({ name: 'Ed25519' }, key, fromBase64Url(parsed.signature), new TextEncoder().encode(parsed.signingInput))) { signatureOk = true; break; }
    } catch {
      // an unusable anchor is skipped; no anchor verifying means BAD_SIGNATURE
    }
  }
  if (!signatureOk) return { valid: false, reason: 'BAD_SIGNATURE', claims: parsed.claims };
  const expires = Date.parse(parsed.claims.expiresAt);
  if (Number.isNaN(expires) || expires <= now.getTime()) return { valid: false, reason: 'EXPIRED', claims: parsed.claims };
  return { valid: true, claims: parsed.claims };
}

/** The anchor a device is given: `QR_INVITATION_PUBLIC_KEY_B64`, the base64 of a PEM. Returns null when it is not a public key. */
export function anchorFromBase64(value: string, keyId: string | null = null): TrustAnchor | null {
  try {
    const pem = new TextDecoder().decode(Uint8Array.from(atob(value.trim()), (c) => c.charCodeAt(0)));
    if (!pem.includes('BEGIN PUBLIC KEY') || pem.includes('PRIVATE')) return null;
    return { keyId, publicKeyPem: pem };
  } catch {
    return null;
  }
}
