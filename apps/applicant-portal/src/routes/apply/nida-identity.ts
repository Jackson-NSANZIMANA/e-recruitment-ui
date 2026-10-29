// The NIDA identity block of the apply wizard (ADR-FE-019). PURE: wire -> display rows.
// The platform shows the citizen what NIDA recorded, read-only; it asks only for what NIDA lacks.
import type { MyIdentity } from "@usrp/api-client";

export type NidaRowKey = "full_name" | "sex" | "date_of_birth" | "place_of_birth" | "nationality" | "district";

export interface NidaRow {
  readonly key: NidaRowKey;
  /** null: NIDA's value is not held by the platform, so the wizard asks for it. */
  readonly value: string | null;
}

/** The i18n key of a sex value (never a raw enum on screen). */
export function sexKey(sex: MyIdentity["sex"]): "female" | "male" {
  return sex === "FEMALE" ? "female" : "male";
}

/** A district as a person writes it: GASABO -> Gasabo; NYARUGENGE_X -> Nyarugenge X. */
export function districtLabel(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function nidaRows(identity: MyIdentity): readonly NidaRow[] {
  return [
    { key: "full_name", value: identity.fullName },
    { key: "sex", value: identity.sex },
    { key: "date_of_birth", value: identity.dateOfBirth },
    { key: "place_of_birth", value: identity.placeOfBirth },
    { key: "nationality", value: identity.nationality },
    { key: "district", value: districtLabel(identity.homeDistrict) },
  ];
}

/** What the citizen still has to supply because NIDA's record does not give it. */
export function askedFor(identity: MyIdentity): readonly NidaRowKey[] {
  return nidaRows(identity).filter((row) => row.value === null).map((row) => row.key);
}
