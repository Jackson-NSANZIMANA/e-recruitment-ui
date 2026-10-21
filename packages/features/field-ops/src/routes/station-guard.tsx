// ══════════════════════════════════════════════════════════════════
// field-ops — the station route guard (ADR-FE-011)
//
// A station's route renders only for a session that stationsFor() grants, by
// the same derivation the picker uses: the walk-in desk is RDF-only (ADR-012)
// and needs a walk-in permission; the gate needs admission.gate. A routing
// guard, never authorization: the edge and the service still refuse.
// ══════════════════════════════════════════════════════════════════

import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import LinkButton from "@atlaskit/button/link";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { mayOpenStation } from "../model/stations.ts";

const styles = cssMap({
  page: { maxWidth: "640px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") },
});

export function StationGuard({ path, children }: { readonly path: string; readonly children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  if (mayOpenStation(session, path)) return <>{children}</>;
  return (
    <Box xcss={styles.page}>
      <SectionMessage appearance="warning" title={t("field_station.station_unavailable_title")} headingLevel="h1" testId="station-unavailable">
        <Stack space="space.200">
          <Text as="p">{t("field_station.station_unavailable_body")}</Text>
          <Box>
            <LinkButton appearance="primary" href="/stations">{t("field_station.back_to_stations")}</LinkButton>
          </Box>
        </Stack>
      </SectionMessage>
    </Box>
  );
}
