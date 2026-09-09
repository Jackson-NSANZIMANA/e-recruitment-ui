import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const ADJUDICATION_NAMESPACE = 'adjudication';

const bundles: NamespaceBundles = { en, rw, fr };

/** Call from the host entrypoint BEFORE render. */
export function registerAdjudicationLocales(): void {
  registerNamespace(ADJUDICATION_NAMESPACE, bundles);
}
