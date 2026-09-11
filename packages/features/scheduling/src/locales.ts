import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const SCHEDULING_NAMESPACE = 'scheduling';

const bundles: NamespaceBundles = { en, rw, fr };

/**
 * Call from the host entrypoint BEFORE render.
 *
 * Note `scheduling.slot.ASSIGNED_DETAILS_UNAVAILABLE` in this bundle. It tells a
 * citizen outright that the platform cannot yet give them the venue or the time.
 * That string is the correct answer to the citizen slot gap and it should not be
 * replaced with a placeholder date.
 */
export function registerSchedulingLocales(): void {
  registerNamespace(SCHEDULING_NAMESPACE, bundles);
}
