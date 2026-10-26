import React, { useId, useState } from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button/new";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";
import LockIcon from "@atlaskit/icon/core/lock-locked";
import GlobeIcon from "@atlaskit/icon/core/globe";
import ShieldIcon from "@atlaskit/icon/core/shield";
import { useTranslation } from "@usrp/i18n";
import { RIB_HOTLINE } from "./identity.js";

const styles = cssMap({
  section: { flexShrink: 0 },
  strip: {
    backgroundColor: token("color.background.neutral"),
    paddingInline: token("space.300"),
    paddingBlock: token("space.050"),
  },
  panel: {
    backgroundColor: token("color.background.neutral"),
    paddingInline: token("space.300"),
    paddingBlockStart: token("space.200"),
    paddingBlockEnd: token("space.300"),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
    gap: token("space.300"),
    maxWidth: "72rem",
  },
  icon: { flexShrink: 0, paddingBlockStart: token("space.025") },
});

/**
 * "An official website of the Government of Rwanda - here's how you know."
 *
 * The pattern is the US Web Design System's government banner, whose research
 * found that people judge a government site's authenticity by its domain, its
 * HTTPS padlock and that banner together - and that the banner only works if
 * its wording never varies, so people learn to look for it. Here it adds the
 * third thing a Rwandan applicant most needs to know to resist a fixer: that
 * recruitment is free and where to report anyone who says otherwise.
 *
 * Collapsed by default to one short line; the explanation is one tap away.
 */
export function OfficialBanner(): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Box as="section" xcss={styles['section']} aria-label={t("national.official_site")}>
      <Box xcss={styles['strip']}>
        <Inline space="space.100" alignBlock="center" shouldWrap>
          <Text size="small">{t("national.official_site")}</Text>
          <Button
            appearance="subtle"
            spacing="compact"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            {...(open ? { "aria-controls": panelId } : {})}
            iconAfter={open ? ChevronUpIcon : ChevronDownIcon}
          >
            {t("national.how_you_know")}
          </Button>
        </Inline>
      </Box>
      {open && (
        <Box id={panelId} xcss={styles['panel']}>
        <Box xcss={styles['grid']}>
          <Inline space="space.150" alignBlock="start">
            <Box xcss={styles['icon']}><GlobeIcon label="" color={token("color.icon.brand")} /></Box>
            <Stack space="space.050">
              <Text weight="bold">{t("national.domain_title")}</Text>
              <Text>{t("national.domain_body")}</Text>
            </Stack>
          </Inline>
          <Inline space="space.150" alignBlock="start">
            <Box xcss={styles['icon']}><LockIcon label="" color={token("color.icon.brand")} /></Box>
            <Stack space="space.050">
              <Text weight="bold">{t("national.https_title")}</Text>
              <Text>{t("national.https_body")}</Text>
            </Stack>
          </Inline>
          <Inline space="space.150" alignBlock="start">
            <Box xcss={styles['icon']}><ShieldIcon label="" color={token("color.icon.brand")} /></Box>
            <Stack space="space.050">
              <Text weight="bold">{t("national.free_title")}</Text>
              <Text>{t("national.free_body", { hotline: RIB_HOTLINE })}</Text>
            </Stack>
          </Inline>
        </Box>
      </Box>
      )}
    </Box>
  );
}
