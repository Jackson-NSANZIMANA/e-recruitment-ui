import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/shared-types";
import { agencyTokens } from "../../tokens/usrp-tokens.js";
import type { BackgroundColor, TextColor } from "@atlaskit/primitives/compiled";

interface AgencyLogoProps {
  readonly agency: Agency;
  /** "sm" (24 px) | "md" (40 px) | "lg" (64 px) */
  readonly size?: "sm" | "md" | "lg";
  /** When true renders only the badge without agency name text. */
  readonly compact?: boolean;
  readonly testId?: string;
}

const SIZE_PX: Record<NonNullable<AgencyLogoProps["size"]>, number> = {
  sm: 24,
  md: 40,
  lg: 64,
};

const AGENCY_NAMES: Record<Agency, string> = {
  RDF: "Rwanda Defence Force",
  RNP: "Rwanda National Police",
  RCS: "Rwanda Correctional Service",
};

// Static badge styles — dynamic width/height are applied via the `style` prop
// because they depend on a runtime prop value. The @compiled babel plugin
// cannot extract template-literal dimensions at build time.
const badgeStyles = cssMap({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: token("radius.full"),
  },
});

/**
 * Agency identity badge.
 *
 * Design constraint: agency branding must be clearly distinguishable so that
 * officers can instantly confirm they are acting in the correct agency context
 * — a cognitive safeguard against cross-agency data entry errors.
 *
 * Dynamic dimensions (width/height) use the `style` prop as an escape hatch —
 * the ADS-endorsed pattern when values cannot be expressed as design tokens.
 */
export function AgencyLogo({
  agency,
  size = "md",
  compact = false,
  testId,
}: AgencyLogoProps): React.ReactElement {
  const tokens = agencyTokens[agency];
  const px = SIZE_PX[size];

  // These token values are narrowly typed in agencyTokens — safe to assert.
  const bg = tokens.background as BackgroundColor;
  const textColor = tokens.text as TextColor;

  const badge = (
    <Box
      backgroundColor={bg}
      xcss={badgeStyles['base']}
      // width/height are dynamic (runtime prop) — style prop is correct here.
      style={{ width: `${px}px`, height: `${px}px` }}
      {...(testId !== undefined ? { testId } : {})}
    >
      <Text
        size={size === "lg" ? "large" : "small"}
        weight="bold"
        color={textColor}
      >
        {agency}
      </Text>
    </Box>
  );

  if (compact) return badge;

  // Inline is the correct primitive for a horizontal flex row — replaces
  // the old `Box display="flex"` pattern which is not a Box prop in compiled.
  return (
    <Inline space="space.150" alignBlock="center">
      {badge}
      <Text size={size === "sm" ? "small" : "medium"} weight="semibold">
        {AGENCY_NAMES[agency]}
      </Text>
    </Inline>
  );
}
