// ══════════════════════════════════════════════════════════════════
// SignerPort (ADR-FE-010): WebCrypto Ed25519 with a NON-EXTRACTABLE key.
//
// The private key is generated inside the browser's key store with
// extractable=false: no code path, ours or an attacker's script, can export
// it. Only the public key leaves (raw, base64url) for device enrolment. The
// native wrapper later swaps this for an Android Keystore-backed signer behind
// the same port. Persisting the CryptoKey across reloads (IndexedDB stores a
// CryptoKey by structured clone, still non-extractable) is the adapter's job
// in S08; this port takes a key pair it is given.
// ══════════════════════════════════════════════════════════════════

import { fromBase64Url, toBase64Url } from './canonical.ts';

export interface SignerPort {
  readonly keyId: string;
  /** Raw 32-byte Ed25519 public key, base64url. */
  publicKey(): Promise<string>;
  sign(data: Uint8Array): Promise<string>;
}

export async function ed25519Supported(subtle: SubtleCrypto = crypto.subtle): Promise<boolean> {
  try {
    const pair = (await subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair;
    return pair.privateKey.extractable === false;
  } catch {
    return false;
  }
}

/** A fresh non-extractable Ed25519 key pair. */
export async function generateDeviceKey(subtle: SubtleCrypto = crypto.subtle): Promise<CryptoKeyPair> {
  const pair = (await subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  if (pair.privateKey.extractable) throw new Error('device key must be non-extractable');
  return pair;
}

export function createWebCryptoSigner(pair: CryptoKeyPair, keyId: string, subtle: SubtleCrypto = crypto.subtle): SignerPort {
  if (pair.privateKey.extractable) throw new Error('refusing an extractable private key');
  return {
    keyId,
    publicKey: async () => toBase64Url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey))),
    sign: async (data) => toBase64Url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, data))),
  };
}

/** Verify an Ed25519 signature against a raw base64url public key. */
export async function verifySignature(publicKey: string, data: Uint8Array, signature: string, subtle: SubtleCrypto = crypto.subtle): Promise<boolean> {
  const key = await subtle.importKey('raw', fromBase64Url(publicKey), { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, fromBase64Url(signature), data);
}
