// The namespace root key in locales/*.json is `campaigns`.
import { registerNamespace, type NamespaceBundles } from '@usrp/i18n';
import en from '../locales/en.json' with { type: 'json' };
import rw from '../locales/rw.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

export const CAMPAIGNS_NAMESPACE = 'campaigns';

const bundles: NamespaceBundles = { en, rw, fr };

/** Call from the host entrypoint BEFORE render. */
export function registerCampaignsLocales(): void {
  registerNamespace(CAMPAIGNS_NAMESPACE, bundles);
}
