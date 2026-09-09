// The namespace root key in locales/*.json is `identity`, and the routes call
// useTranslation('identity'). Both must match or every key renders as itself.
import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const IDENTITY_NAMESPACE = 'identity';

const bundles: NamespaceBundles = { en, rw, fr };

/** Call from the host entrypoint BEFORE render. See @usrp/i18n registerNamespace. */
export function registerIdentityLocales(): void {
  registerNamespace(IDENTITY_NAMESPACE, bundles);
}
