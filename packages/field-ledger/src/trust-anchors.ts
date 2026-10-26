// The cached scheduling public key(s) (CONTRACT-PENDING: no edge operation
// serves the key, so it is installed at device setup and cached here).
import type { TrustAnchor } from './slot-token.ts';

export interface AnchorStore {
  list(): Promise<readonly TrustAnchor[]>;
  replace(anchors: readonly TrustAnchor[]): Promise<void>;
}

export function createMemoryAnchorStore(initial: readonly TrustAnchor[] = []): AnchorStore {
  let anchors = initial;
  return { list: async () => anchors, replace: async (next) => { anchors = next; } };
}

/** Small and public, so localStorage is enough; a failure reads as "no anchor" (the degraded rung is then unavailable, never wrongly valid). */
export function createLocalAnchorStore(storage: Pick<Storage, 'getItem' | 'setItem'> = globalThis.localStorage, key = 'usrp_slot_trust_anchors'): AnchorStore {
  return {
    list: async () => {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((a): a is TrustAnchor => a !== null && typeof a === 'object' && typeof (a as TrustAnchor).publicKeyPem === 'string') : [];
      } catch {
        return [];
      }
    },
    replace: async (anchors) => { storage.setItem(key, JSON.stringify(anchors)); },
  };
}
