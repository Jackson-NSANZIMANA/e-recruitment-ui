// campaigns — Rwanda's administrative geography as the control plane validates it.
// Transcribed from the backend shared-types (DISTRICTS, DISTRICT_TO_PROVINCE). PURE.

export const DISTRICT_TO_PROVINCE = {
  NYARUGENGE: 'KIGALI_CITY', KICUKIRO: 'KIGALI_CITY', GASABO: 'KIGALI_CITY',
  GICUMBI: 'NORTHERN_PROVINCE', BURERA: 'NORTHERN_PROVINCE', MUSANZE: 'NORTHERN_PROVINCE', GAKENKE: 'NORTHERN_PROVINCE', RULINDO: 'NORTHERN_PROVINCE',
  NYAMAGABE: 'SOUTHERN_PROVINCE', NYARUGURU: 'SOUTHERN_PROVINCE', GISAGARA: 'SOUTHERN_PROVINCE', HUYE: 'SOUTHERN_PROVINCE',
  NYANZA: 'SOUTHERN_PROVINCE', RUHANGO: 'SOUTHERN_PROVINCE', MUHANGA: 'SOUTHERN_PROVINCE', KAMONYI: 'SOUTHERN_PROVINCE',
  KIREHE: 'EASTERN_PROVINCE', NGOMA: 'EASTERN_PROVINCE', NYAGATARE: 'EASTERN_PROVINCE', GATSIBO: 'EASTERN_PROVINCE',
  KAYONZA: 'EASTERN_PROVINCE', RWAMAGANA: 'EASTERN_PROVINCE', BUGESERA: 'EASTERN_PROVINCE',
  RUSIZI: 'WESTERN_PROVINCE', NYAMASHEKE: 'WESTERN_PROVINCE', KARONGI: 'WESTERN_PROVINCE', RUTSIRO: 'WESTERN_PROVINCE',
  RUBAVU: 'WESTERN_PROVINCE', NYABIHU: 'WESTERN_PROVINCE', NGORORERO: 'WESTERN_PROVINCE',
} as const;

export type District = keyof typeof DISTRICT_TO_PROVINCE;
export type Province = (typeof DISTRICT_TO_PROVINCE)[District];
export const DISTRICTS = Object.keys(DISTRICT_TO_PROVINCE) as readonly District[];

export function isDistrict(value: string): value is District {
  return Object.hasOwn(DISTRICT_TO_PROVINCE, value);
}

/** The province that owns `district`, or null for an unrecognised value. */
export function provinceOf(district: string): Province | null {
  return isDistrict(district) ? DISTRICT_TO_PROVINCE[district] : null;
}

/** "NYARUGENGE" → "Nyarugenge": display only; the wire value stays upper-case. */
export function districtLabel(district: string): string {
  return district.charAt(0) + district.slice(1).toLowerCase();
}

/**
 * Walk-in registration on exam day (WALKIN_POLICY in the backend shared-types).
 * The Studio offers the switch only where the policy allows it; the server stays
 * authoritative. RCS stays false here until S12c settles its 2026 officer exception.
 */
export const WALKIN_POLICY = { RDF: true, RNP: false, RCS: false } as const;

export function walkInOffered(agency: string): boolean {
  return agency === 'RDF' ? WALKIN_POLICY.RDF : agency === 'RNP' ? WALKIN_POLICY.RNP : agency === 'RCS' ? WALKIN_POLICY.RCS : false;
}
