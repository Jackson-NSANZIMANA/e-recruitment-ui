export {
  default as i18n,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  COMMON_NAMESPACE,
  registerNamespace,
  registeredNamespaces,
  assertNamespaceRegistered,
} from "./config.js";
export type { SupportedLanguage, NamespaceBundle, NamespaceBundles } from "./config.js";
export { useTranslation, Trans } from "react-i18next";
