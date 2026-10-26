import React from "react";
import { Inline, Text } from "@atlaskit/primitives/compiled";
import type { Agency } from "@usrp/contracts";
import { useTranslation } from "@usrp/i18n";
import { AgencyEmblem } from "../../national/Emblem.js";
import { agencyNameFor } from "../../national/emblems.js";

interface AgencyLogoProps {
  readonly agency: Agency;
  /** "sm" (24 px) | "md" (40 px) | "lg" (64 px) */
  readonly size?: "sm" | "md" | "lg";
  /** When true renders only the emblem without the agency's name. */
  readonly compact?: boolean;
  readonly testId?: string;
}

const SIZE_PX: Record<NonNullable<AgencyLogoProps["size"]>, number> = {
  sm: 24,
  md: 40,
  lg: 64,
};

/**
 * Agency identity: the agency's official emblem (ADR-FE-020), with its name in
 * the reader's language unless `compact`.
 *
 * Design constraint: agency branding must be clearly distinguishable so an
 * officer can confirm at a glance which agency context they are acting in. That
 * is a cognitive safeguard against cross-agency data entry, NOT a security
 * control - agency isolation is enforced by FORCE'd row-level security in
 * PostgreSQL, and this component defends nothing.
 *
 * Before ADR-FE-020 this drew the agency's initials in a coloured circle, which
 * overflowed at 24 px ("RNP" does not fit) and used a status colour for RCS.
 */
export function AgencyLogo({
  agency,
  size = "md",
  compact = false,
  testId,
}: AgencyLogoProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const name = agencyNameFor(agency, i18n.language);
  const px = SIZE_PX[size];

  if (compact) {
    return <AgencyEmblem agency={agency} height={px} alt={t("national.emblem_alt", { agency: name })} {...(testId !== undefined ? { testId } : {})} />;
  }

  return (
    <Inline space="space.150" alignBlock="center" {...(testId !== undefined ? { testId } : {})}>
      <AgencyEmblem agency={agency} height={px} alt="" />
      <Text size={size === "sm" ? "small" : "medium"} weight="semibold">
        {name}
      </Text>
    </Inline>
  );
}
