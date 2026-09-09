import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const COMPLIANCE_NAMESPACE = 'compliance';

const bundles: NamespaceBundles = { en, rw, fr };

/**
 * Call from the host entrypoint BEFORE render.
 *
 * `compliance.erasure.authority_gap` in this bundle states that any authenticated
 * officer can read the erasure queue and decline a request, because no DPO role
 * check exists in the platform and the queue is not agency-scoped. Keep it. A
 * compliance surface that hides its own authority gap is worse than one that has
 * no surface.
 */
export function registerComplianceLocales(): void {
  registerNamespace(COMPLIANCE_NAMESPACE, bundles);
}
