// NOTE THE UNDERSCORE. The namespace root key is `field_ops`, not `field-ops`,
// and every route in this slice calls useTranslation('field_ops'). The package is
// named with a hyphen and the namespace is not; they are different identifiers
// and only the JSON root key matters at runtime.
import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const FIELD_OPS_NAMESPACE = 'field_ops';

const bundles: NamespaceBundles = { en, rw, fr };

/** Call from the host entrypoint BEFORE render. */
export function registerFieldOpsLocales(): void {
  registerNamespace(FIELD_OPS_NAMESPACE, bundles);
}
