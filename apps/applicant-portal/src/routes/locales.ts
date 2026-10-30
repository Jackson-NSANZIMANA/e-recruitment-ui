// The citizen's apply and documents screens keep their copy in their own namespace, registered when
// either route's chunk loads. In the shared `common` namespace it would ride in the entry chunk of every
// page (about 14 KB of the 300 KB entry budget), for routes most visits never open.
import { registerNamespace, type NamespaceBundles } from "@usrp/i18n";
import en from "@usrp/i18n/locales/en/citizen_apply.json" with { type: "json" };
import fr from "@usrp/i18n/locales/fr/citizen_apply.json" with { type: "json" };
import rw from "@usrp/i18n/locales/rw/citizen_apply.json" with { type: "json" };

export const CITIZEN_APPLY_NAMESPACE = "citizen_apply";

/** Keys resolve in `citizen_apply` first, then fall back to `common`: call sites keep their key paths. */
export const CITIZEN_APPLY_NAMESPACES: readonly string[] = [CITIZEN_APPLY_NAMESPACE, "common"];

const bundles: NamespaceBundles = { en, rw, fr };

// Idempotent for the same bundle object, so both routes can import this module.
registerNamespace(CITIZEN_APPLY_NAMESPACE, bundles);
