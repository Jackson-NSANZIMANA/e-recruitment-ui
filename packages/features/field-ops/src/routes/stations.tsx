// ══════════════════════════════════════════════════════════════════
// field-ops — the station picker (ADR-FE-011)
//
// The Field Station's start page. It lists the stations the officer's session
// grants (stationsFor), links the ones this release builds and marks the rest
// "not yet available". It never offers a station the session does not grant.
// ══════════════════════════════════════════════════════════════════

import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { stationsFor } from "../model/stations.ts";

const styles = cssMap({
  page: {
    maxWidth: "960px",
    marginInline: "auto",
    paddingBlock: token("space.500"),
    paddingInline: token("space.400"),
  },
  tile: {
    paddingBlock: token("space.300"),
    paddingInline: token("space.300"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    borderRadius: token("radius.medium"),
  },
});

export default function StationPicker(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const stations = stationsFor(session);

  return (
    <Box xcss={styles.page}>
      <Stack space="space.400">
        <Heading size="large" as="h1">
          {t("field_station.stations_title")}
        </Heading>
        <Text as="p" color="color.text.subtle">
          {t("field_station.stations_intro")}
        </Text>

        {stations.length === 0 ? (
          <SectionMessage appearance="warning" title={t("field_station.no_stations_title")} headingLevel="h2">
            <Text as="p">{t("field_station.no_stations_body")}</Text>
          </SectionMessage>
        ) : (
          <Stack space="space.200" testId="station-list">
            {stations.map((station) => (
              <Box key={station.id} xcss={styles.tile} backgroundColor="color.background.input" testId={`station-${station.id}`}>
                <Inline space="space.300" alignBlock="center" spread="space-between" shouldWrap>
                  <Stack space="space.100">
                    <Heading size="medium" as="h2">
                      {t(`field_station.stations.${station.id}.title`)}
                    </Heading>
                    <Text as="p">{t(`field_station.stations.${station.id}.body`)}</Text>
                  </Stack>
                  {station.path !== null ? (
                    <Button appearance="primary" href={station.path}>
                      {t("field_station.open")}
                    </Button>
                  ) : (
                    <Lozenge>{t("field_station.not_yet_available")}</Lozenge>
                  )}
                </Inline>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
