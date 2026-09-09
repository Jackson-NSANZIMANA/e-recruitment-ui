import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const APPLICATIONS_NAMESPACE = 'applications';

const bundles: NamespaceBundles = { en, rw, fr };

/**
 * Call from the host entrypoint BEFORE render.
 *
 * This bundle carries all 19 real status labels including the four WALK_IN_*
 * states, which the shared `common` bundle was missing entirely. `statusLabelKey`
 * in model/status.ts resolves into it.
 */
export function registerApplicationsLocales(): void {
  registerNamespace(APPLICATIONS_NAMESPACE, bundles);
}
