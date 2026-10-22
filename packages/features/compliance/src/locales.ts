import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const COMPLIANCE_NAMESPACE = 'compliance';

const bundles: NamespaceBundles = { en, rw, fr };

/**
 * Call from the host entrypoint BEFORE render.
 *
 * The old authority-gap banner is gone: since S04 (ADR-039) the edge enforces
 * erasure.queue.read and erasure.decide, so only the DPO post reaches this queue.
 */
export function registerComplianceLocales(): void {
  registerNamespace(COMPLIANCE_NAMESPACE, bundles);
}
