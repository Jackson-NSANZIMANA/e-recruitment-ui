import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import LockIcon from "@atlaskit/icon/core/lock-locked";
import { useTranslation } from "@usrp/i18n";

const styles = cssMap({
  marking: {
    backgroundColor: token("color.background.warning.bold"),
    paddingInline: token("space.300"),
    paddingBlock: token("space.075"),
    blockSize: "100%",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
});

/**
 * The handling marking across the top of every staff screen - the digital
 * form of the caveat stamped on a restricted file: who may look, under which
 * law the contents are protected, and that what they do is audited.
 *
 * Bold warning yellow with dark text (positive polarity, AGENTS.md §5) so it
 * is unmistakable in sunlight and in a screenshot. The wording says only what
 * the platform actually does: state-changing actions are audited.
 */
export function HandlingMarking(): React.ReactElement {
  const { t, i18n } = useTranslation();
  // Upper-cased in script, per the active language's casing rules, because ADS
  // keeps text-transform out of styles: type belongs to Text and Heading.
  const marking = t("national.restricted").toLocaleUpperCase(i18n.language);
  return (
    <Box xcss={styles['marking']} role="note" aria-label={t("national.restricted")}>
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <LockIcon label="" color={token("color.icon.warning.inverse")} size="small" />
        <Text weight="bold" color="color.text.warning.inverse" size="small">{marking}</Text>
        <Text color="color.text.warning.inverse" size="small">
          {t("national.restricted_body", { law: t("national.law_data_protection") })}
        </Text>
      </Inline>
    </Box>
  );
}
