import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useApplication } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { useParams } from "react-router-dom";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-level — xcss prop requires cssMap output, not css().
const pageStyles = cssMap({
  base: {
    maxWidth: "900px",
    marginInline: "auto",
    paddingBlock: token("space.400"),
    paddingInline: token("space.500"),
  },
});

/**
 * Application detail — the single application view for an officer.
 *
 * "Procedural Justice UI": every status in the history is shown with actor,
 * timestamp, and note — so the officer understands the full story and can
 * give a reasoned explanation to an applicant who queries a decision.
 */
export default function ApplicationDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: app, isLoading, isError } = useApplication(client, id ?? "");

  if (isLoading)
    return (
      <Box xcss={pageStyles.base}>
        <Spinner label={t("a11y.loading")} />
      </Box>
    );

  if (isError || app === undefined)
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="error" title={t("errors.not_found")}>
          {t("errors.not_found")}
        </SectionMessage>
      </Box>
    );

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.100">
            <Heading size="large" as="h1">
              {app.applicantName}
            </Heading>
            <Text color="color.text.subtle" size="small">
              {t("application.id")}: {app.id}
            </Text>
          </Stack>
          <ApplicationStatusBadge status={app.status} />
        </Inline>

        <SectionMessage title={t("application.history")}>
          <Stack space="space.100">
            {app.history.map((ev) => (
              <Inline key={ev.id} space="space.150" alignBlock="start">
                <Text size="small" color="color.text.subtle">
                  {new Date(ev.timestamp).toLocaleString()}
                </Text>
                <Text size="small">
                  {ev.actorRole} → {ev.toStatus}
                  {ev.note !== null ? ` — ${ev.note}` : ""}
                </Text>
              </Inline>
            ))}
          </Stack>
        </SectionMessage>

        <Inline space="space.200">
          <Button appearance="primary" href={`/applications`}>
            {t("actions.back")}
          </Button>
        </Inline>
      </Stack>
    </Box>
  );
}
