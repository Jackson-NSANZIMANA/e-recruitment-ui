import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

const styles = cssMap({
  banner: {
    backgroundColor: token("color.background.danger.bold"),
    paddingInline: token("space.300"),
    paddingBlock: token("space.075"),
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
});

/**
 * The persistent SANDBOX banner (ADR-FE-019). Rendered above everything in all
 * three apps when the build is a sandbox build, so nobody mistakes a practice
 * environment for the live service. It is a status, not a decoration: role="note"
 * and the same wording in every app and language.
 */
export function SandboxBanner(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const label = t("national.sandbox").toLocaleUpperCase(i18n.language);
  return (
    <Box xcss={styles["banner"]} role="note" aria-label={t("national.sandbox")} testId="sandbox-banner">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Text weight="bold" color="color.text.inverse" size="small">{label}</Text>
        <Text color="color.text.inverse" size="small">{t("national.sandbox_body")}</Text>
      </Inline>
    </Box>
  );
}

/** True for a sandbox build: VITE_USRP_SANDBOX=1 is set by the sandbox serving images, never by production. */
export function isSandboxBuild(): boolean {
  return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.["VITE_USRP_SANDBOX"] === "1";
}
