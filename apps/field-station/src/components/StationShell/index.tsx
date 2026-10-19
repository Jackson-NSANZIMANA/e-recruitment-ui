import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import Lozenge from "@atlaskit/lozenge";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useAuth, useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { ConnectionStatus } from "../ConnectionStatus/index.js";

const styles = cssMap({
  bar: {
    paddingBlock: token("space.150"),
    paddingInline: token("space.300"),
    borderBlockEndWidth: token("border.width"),
    borderBlockEndStyle: "solid",
    borderBlockEndColor: token("color.border"),
  },
});

export interface StationShellProps {
  readonly children: React.ReactNode;
}

/**
 * The Field Station shell (ADR-FE-011): one bar, no side navigation.
 *
 * A station is a single task done many times in a row with gloves on, in
 * sunlight, so the shell carries only what every station needs: which app and
 * agency this is, a way back to the station list, sign-out, and the
 * connectivity banner. Deliberately NOT @atlaskit/navigation-system: the
 * desktop navigation is the officer console's, and leaving it out keeps this
 * bundle inside its tighter budget.
 */
export function StationShell({ children }: StationShellProps): React.ReactElement {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const session = useOfficerSession();

  return (
    <Stack>
      <Box as="header" xcss={styles.bar} backgroundColor="color.background.neutral.subtle">
        <Inline space="space.200" alignBlock="center" spread="space-between" shouldWrap>
          <Inline space="space.200" alignBlock="center">
            <Text weight="bold">{t("field_station.app_title")}</Text>
            {session !== null && <Lozenge appearance="inprogress">{session.agency}</Lozenge>}
          </Inline>
          <Inline space="space.100" alignBlock="center">
            <Button appearance="subtle" href="/stations">
              {t("field_station.all_stations")}
            </Button>
            <Button appearance="subtle" onClick={() => { void signOut(); }}>
              {t("nav.logout")}
            </Button>
          </Inline>
        </Inline>
      </Box>
      <Box as="main">
        <ConnectionStatus />
        {children}
      </Box>
    </Stack>
  );
}
