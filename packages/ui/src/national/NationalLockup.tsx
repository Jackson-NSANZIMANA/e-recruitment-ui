import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/contracts";
import { useTranslation } from "@usrp/i18n";
import { AgencyEmblem, CoatOfArms } from "./Emblem.js";
import { agencyNameFor } from "./emblems.js";
import { stateNameFor } from "./identity.js";

const styles = cssMap({
  divider: {
    alignSelf: "stretch",
    borderInlineStartWidth: token("border.width"),
    borderInlineStartStyle: "solid",
    borderInlineStartColor: token("color.border"),
  },
});

interface NationalLockupProps {
  /** Name of the service under the state name. Defaults to the portal's name. */
  readonly serviceName?: string;
  /** Adds the agency emblem and name after a divider (officer and field apps). */
  readonly agency?: Agency | null;
  /** Smaller symbol and type, for dense tool chrome. */
  readonly compact?: boolean;
}

/**
 * The Government of Rwanda lockup - coat of arms, then the state's name - as
 * RISA specifies it for every GoR website, followed by the service name and,
 * where the user acts for one, the agency.
 *
 * The coat of arms carries alt="" because the words beside it already say
 * "Republic of Rwanda"; the visible name is the accessible name.
 */
export function NationalLockup({ serviceName, agency = null, compact = false }: NationalLockupProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const symbol = compact ? 36 : 48;

  return (
    <Inline space={compact ? "space.150" : "space.200"} alignBlock="center">
      <CoatOfArms height={symbol} alt="" />
      <Stack space="space.025">
        {/* RISA lockup: name about half the symbol's height, a third of it apart.
            At the 48px symbol that is the 20-24px heading step and a 16px gap. */}
        <Heading size={compact ? "xsmall" : "small"} as="span">{stateNameFor(i18n.language)}</Heading>
        {/* Compact chrome (a tool's top bar) keeps to one line: the agency
            beside it already says whose service this is. */}
        {!compact && <Text size="small" color="color.text.subtle">{serviceName ?? t("national.service_name")}</Text>}
      </Stack>
      {agency !== null && (
        <>
          <Box xcss={styles['divider']} aria-hidden />
          <Inline space="space.100" alignBlock="center">
            <AgencyEmblem agency={agency} height={symbol} alt="" />
            <Text weight="semibold" size={compact ? "small" : "medium"}>{agencyNameFor(agency, i18n.language)}</Text>
          </Inline>
        </>
      )}
    </Inline>
  );
}
