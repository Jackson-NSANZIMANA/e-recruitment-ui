import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/contracts";
import { useTranslation } from "@usrp/i18n";
import { AgencyEmblem, CoatOfArms } from "./Emblem.js";
import { agencyNameFor } from "./emblems.js";
import { FlagRule } from "./FlagRule.js";
import { ImigongoBand } from "./ImigongoBand.js";
import { NATIONAL_MOTTO, RIB_HOTLINE, stateNameFor } from "./identity.js";

const AGENCIES: readonly Agency[] = ["RDF", "RNP", "RCS"];

const styles = cssMap({
  footer: { backgroundColor: token("elevation.surface.sunken"), marginBlockStart: token("space.600"), flexShrink: 0 },
  inner: {
    maxWidth: "80rem",
    marginInline: "auto",
    paddingInline: token("space.300"),
    paddingBlock: token("space.500"),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
    gap: token("space.400"),
  },
  base: {
    borderBlockStartWidth: token("border.width"),
    borderBlockStartStyle: "solid",
    borderBlockStartColor: token("color.border"),
    paddingBlockStart: token("space.200"),
    marginBlockStart: token("space.400"),
  },
});

/**
 * The statutory footer (RISA layout guideline: about, legal, contact,
 * copyright). Three blocks, each a thing an applicant might genuinely need:
 * who runs this, what happens to their data and under which law, and where
 * to report a fixer.
 *
 * No links to pages that do not exist yet. When the privacy notice and the
 * accessibility statement are published, they are linked from here.
 */
export function NationalFooter(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <Box as="footer" xcss={styles['footer']}>
      <ImigongoBand />
      <Box xcss={styles['inner']}>
        <Box xcss={styles['grid']}>
          <Stack space="space.200">
            <Inline space="space.150" alignBlock="center">
              <CoatOfArms height={40} alt="" />
              <Heading size="xsmall" as="h2">{stateNameFor(i18n.language)}</Heading>
            </Inline>
            <Text>{t("national.footer_about")}</Text>
            <Inline space="space.200" alignBlock="center" shouldWrap>
              {AGENCIES.map((agency) => {
                const name = agencyNameFor(agency, i18n.language);
                return <AgencyEmblem key={agency} agency={agency} height={40} alt={t("national.emblem_alt", { agency: name })} />;
              })}
            </Inline>
          </Stack>
          <Stack space="space.100">
            <Heading size="xsmall" as="h2">{t("national.footer_data_title")}</Heading>
            <Text>{t("national.footer_data_body", { law: t("national.law_data_protection") })}</Text>
          </Stack>
          <Stack space="space.100">
            <Heading size="xsmall" as="h2">{t("national.footer_fraud_title")}</Heading>
            <Text>{t("national.footer_fraud_body", { hotline: RIB_HOTLINE })}</Text>
            <Text size="large" weight="bold">RIB · {RIB_HOTLINE}</Text>
          </Stack>
        </Box>
        <Box xcss={styles['base']}>
          <Inline space="space.200" spread="space-between" shouldWrap>
            <Text size="small" color="color.text.subtle">{t("national.footer_rights", { year })}</Text>
            <span lang="rw">
              <Text as="em" size="small" color="color.text.subtle">{NATIONAL_MOTTO}</Text>
            </span>
          </Inline>
        </Box>
      </Box>
      <FlagRule weight="thick" />
    </Box>
  );
}
