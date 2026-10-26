import React from "react";
import { Box, Stack } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
// LinkButton, not the legacy Button: it renders through AppProvider's
// routerLinkComponent, so an in-app href is a client-side navigation (no full
// reload that would drop station state or re-probe the session offline).
import LinkButton from "@atlaskit/button/link";
import { useAuth, useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { ConnectionStatus, HandlingMarking, LanguageSwitcher, NationalHeader } from "@usrp/ui";

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
 *
 * Identity (ADR-FE-020): the handling marking, then the compact national
 * lockup with the agency's emblem - the device in a candidate's line of sight
 * at the gate says, before anything else, which state and which force it
 * belongs to.
 */
export function StationShell({ children }: StationShellProps): React.ReactElement {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const session = useOfficerSession();

  return (
    <Stack>
      <HandlingMarking />
      <NationalHeader
        compact
        serviceName={t("field_station.app_title")}
        agency={session?.agency ?? null}
        end={
          <>
            <LanguageSwitcher />
            <LinkButton appearance="subtle" href="/stations">
              {t("field_station.all_stations")}
            </LinkButton>
            <Button appearance="subtle" onClick={() => { void signOut(); }}>
              {t("nav.logout")}
            </Button>
          </>
        }
      />
      <Box as="main">
        <ConnectionStatus />
        {children}
      </Box>
    </Stack>
  );
}
