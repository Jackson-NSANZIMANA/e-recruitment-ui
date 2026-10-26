/// <reference path="./assets.d.ts" />
import type { Agency } from "@usrp/contracts";
import coatOfArmsSvg from "./assets/coat-of-arms.svg";
import coatOfArms128 from "./assets/coat-of-arms-128.webp";
import coatOfArms512 from "./assets/coat-of-arms-512.webp";
import rdf128 from "./assets/rdf-emblem-128.webp";
import rdf512 from "./assets/rdf-emblem-512.webp";
import rnp128 from "./assets/rnp-emblem-128.webp";
import rnp512 from "./assets/rnp-emblem-512.webp";
import rcs128 from "./assets/rcs-emblem-128.webp";
import rcs512 from "./assets/rcs-emblem-512.webp";

/**
 * The emblem registry. Every national or agency symbol the product draws comes
 * from here, and every file here is traced in assets/PROVENANCE.md.
 *
 * Two renditions per raster emblem: 128 px for chrome (headers, footers -
 * downloaded on every first visit, so they must be small on a Rwandan mobile
 * plan) and 512 px for documents and watermarks. The coat of arms also ships
 * as the official vector for print and large documents.
 */
export interface EmblemSource {
  /** Small rendition, for display up to 64 CSS px (128 device px at 2x). */
  readonly small: string;
  /** Large rendition, for documents and watermarks. */
  readonly large: string;
  /** Intrinsic aspect ratio, width / height - so layout never jumps while loading. */
  readonly aspect: number;
}

export const COAT_OF_ARMS: EmblemSource & { readonly vector: string } = {
  small: coatOfArms128,
  large: coatOfArms512,
  vector: coatOfArmsSvg,
  aspect: 670.378 / 732.24,
};

export const AGENCY_EMBLEMS: Record<Agency, EmblemSource> = {
  RDF: { small: rdf128, large: rdf512, aspect: 2359 / 2250 },
  RNP: { small: rnp128, large: rnp512, aspect: 1 },
  RCS: { small: rcs128, large: rcs512, aspect: 1 },
};

/**
 * Agency names in each language. Proper names of state institutions: the
 * Kinyarwanda forms are the institutions' own (Ingabo z'u Rwanda, Polisi
 * y'u Rwanda, Urwego rw'Igihugu rushinzwe Igorora).
 */
export const AGENCY_NAMES: Record<Agency, { readonly en: string; readonly rw: string; readonly fr: string }> = {
  RDF: { en: "Rwanda Defence Force", rw: "Ingabo z'u Rwanda", fr: "Forces rwandaises de défense" },
  RNP: { en: "Rwanda National Police", rw: "Polisi y'u Rwanda", fr: "Police nationale du Rwanda" },
  RCS: { en: "Rwanda Correctional Service", rw: "Urwego rw'Igihugu rushinzwe Igorora", fr: "Service correctionnel du Rwanda" },
};

export function agencyNameFor(agency: Agency, language: string): string {
  const names = AGENCY_NAMES[agency];
  const key = language.slice(0, 2);
  return key === "rw" ? names.rw : key === "fr" ? names.fr : names.en;
}
