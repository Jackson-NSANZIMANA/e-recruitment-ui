// ══════════════════════════════════════════════════════════════════
// field-ops — the on-device runtime: identity, signer, ledger, probes (S08)
//
// One per tab. Opens the persisted non-extractable key, the IndexedDB ledger
// and the trust-anchor cache. OFFLINE_CAPTURE_CAN_SYNC is the ledger's
// offlineQueue policy: false, so an unsent record stays LOCAL_ONLY.
// ══════════════════════════════════════════════════════════════════

import {
  createIndexedDbIdentityStore, createIndexedDbStorage, createLedger, createLocalAnchorStore, createWebCryptoSigner,
  ed25519Supported, loadOrCreateIdentity, markEnrolled, publicKeySpkiPem,
  type AnchorStore, type DeviceIdentity, type IdentityStore, type Ledger, type SignerPort, type StoragePort,
} from '@usrp/field-ledger';
import { OFFLINE_CAPTURE_CAN_SYNC } from '../api/transport.ts';
import { clockConfidenceOf, clockSkewFromDate, evaluateReadiness, type Readiness } from '../model/readiness.ts';
import { readVenueDay, type VenueDay } from '../model/venue.ts';

export interface DeviceRuntime {
  identity: DeviceIdentity;
  readonly signer: SignerPort;
  readonly ledger: Ledger;
  readonly storage: StoragePort;
  readonly anchors: AnchorStore;
  readonly identityStore: IdentityStore;
  clockSkewMs: number | null;
  /** Measure device clock against the edge `Date` header (a HEAD-free GET of the session). */
  measureClock(edgeBaseUrl: string): Promise<number | null>;
  probe(sessionAgency: string): Promise<Readiness>;
  enrolmentBody(): Promise<{ readonly deviceId: string; readonly publicKeyPem: string }>;
  acknowledgeEnrolment(agency: string): Promise<void>;
  venueDay(): VenueDay | null;
}

export async function openDeviceRuntime(): Promise<DeviceRuntime> {
  const identityStore = createIndexedDbIdentityStore();
  const identity = await loadOrCreateIdentity(identityStore);
  const signer = createWebCryptoSigner(identity.pair, identity.keyId);
  const storage = createIndexedDbStorage();
  const anchors = createLocalAnchorStore();
  const rt: DeviceRuntime = {
    identity,
    signer,
    storage,
    anchors,
    identityStore,
    clockSkewMs: null,
    ledger: createLedger({
      storage,
      signer,
      deviceId: identity.deviceId,
      clock: { now: () => new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, confidence: () => clockConfidenceOf(rt.clockSkewMs) },
      policy: { offlineQueue: OFFLINE_CAPTURE_CAN_SYNC },
    }),
    async measureClock(edgeBaseUrl) {
      try {
        const before = Date.now();
        const response = await fetch(`${edgeBaseUrl}/edge/v1/session`, { credentials: 'include', headers: { accept: 'application/json' } });
        const mid = (before + Date.now()) / 2;
        rt.clockSkewMs = clockSkewFromDate(response.headers.get('date'), new Date(mid));
      } catch {
        rt.clockSkewMs = null;
      }
      return rt.clockSkewMs;
    },
    async probe(sessionAgency) {
      const health = await storage.health().catch(() => ({ persisted: false, quotaBytes: null, usageBytes: null }));
      return evaluateReadiness({
        ed25519: await ed25519Supported(),
        persisted: health.persisted,
        quotaBytes: health.quotaBytes,
        usageBytes: health.usageBytes,
        clockSkewMs: rt.clockSkewMs,
        enrolled: rt.identity.enrolledAt !== null && rt.identity.enrolledAgency === sessionAgency,
        venueDayConfirmed: readVenueDay() !== null,
        trustAnchorCached: (await anchors.list()).length > 0,
      });
    },
    enrolmentBody: async () => ({ deviceId: rt.identity.deviceId, publicKeyPem: await publicKeySpkiPem(rt.identity.pair) }),
    async acknowledgeEnrolment(agency) {
      rt.identity = await markEnrolled(identityStore, rt.identity, agency);
    },
    venueDay: () => readVenueDay(),
  };
  return rt;
}
