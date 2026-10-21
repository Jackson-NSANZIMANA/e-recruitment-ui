import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { FIELD_STATION_URL } from "../env.js";

const styles = cssMap({
  page: { maxWidth: "640px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") },
});

/**
 * Where /gate and /walk-in land since S02 (ADR-FE-007).
 *
 * The venue gate and the walk-in desk are exam-day station work with a
 * different device, threat model and release cadence from this console, so
 * they run on apps/field-station. Bookmarks and muscle memory still arrive
 * here; they get a plain answer instead of a 404.
 */
export default function FieldStationNotice(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box xcss={styles.page}>
      <Stack space="space.400">
        <Heading size="large" as="h1">{t("field_station.moved_title")}</Heading>
        <SectionMessage appearance="information" headingLevel="h2" title={t("field_station.app_title")} testId="field-station-notice">
          <Stack space="space.200">
            <Text as="p">{t("field_station.moved_body")}</Text>
            {FIELD_STATION_URL !== "" && (
              <Box>
                <Button appearance="primary" href={FIELD_STATION_URL}>{t("field_station.moved_link")}</Button>
              </Box>
            )}
          </Stack>
        </SectionMessage>
      </Stack>
    </Box>
  );
}
