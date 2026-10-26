// ─── National identity layer (ADR-FE-020) ──────────────────────────────────────
export {
  NATIONAL_COLOURS,
  NATIONAL_THEME,
  FLAG_RIBBON,
  LOCKUP,
  LEGAL,
  RIB_HOTLINE,
  GOV_DOMAIN_SUFFIX,
  STATE_NAME,
  NATIONAL_MOTTO,
  stateNameFor,
} from "./identity.js";
export type { NationalColour, StateNameLanguage } from "./identity.js";
export { COAT_OF_ARMS, AGENCY_EMBLEMS, AGENCY_NAMES, agencyNameFor } from "./emblems.js";
export type { EmblemSource } from "./emblems.js";
export { CoatOfArms, AgencyEmblem } from "./Emblem.js";
export { FlagRule } from "./FlagRule.js";
export { ImigongoBand } from "./ImigongoBand.js";
export { OfficialBanner } from "./OfficialBanner.js";
export { NationalLockup } from "./NationalLockup.js";
export { LanguageSwitcher } from "./LanguageSwitcher.js";
export { NationalHeader } from "./NationalHeader.js";
export { NationalFooter } from "./NationalFooter.js";
export { HandlingMarking } from "./HandlingMarking.js";
export { SessionWatermark } from "./SessionWatermark.js";
export { OfficialDocument, verificationLineFor } from "./OfficialDocument.js";
export { NationalFrame } from "./NationalFrame.js";
