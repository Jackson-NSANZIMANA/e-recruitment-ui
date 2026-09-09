import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useMyApplications } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

const pageStyles = cssMap({
  base: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.500"),
    paddingInline: token("space.400"),
  },
});

const cardStyles = cssMap({
  base: {
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    borderRadius: token("radius.medium"),
  },
});

/**
 * The citizen's own applications, across all three agencies.
 *
 * Reads GET /edge/v1/me/applications. There is no per-agency variant and no
 * pagination: the citizen surface is a single cross-agency list, capped upstream.
 */
export default function StatusPage(): React.ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useMyApplications(client);

  if (isLoading) {
    return (
      <Box xcss={pageStyles.base}>
        <Spinner label={t("a11y.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="error">{t("errors.generic")}</SectionMessage>
      </Box>
    );
  }

  const applications = data?.applications ?? [];

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <Heading size="large" as="h1">{t("nav.applications")}</Heading>

        {applications.length === 0 && (
          <SectionMessage>
            <Text>You have no applications on file.</Text>
          </SectionMessage>
        )}

        {applications.map((application) => (
          <Box
            key={application.applicationId}
            padding="space.300"
            backgroundColor="color.background.neutral"
            xcss={cardStyles.base}
          >
            <Stack space="space.200">
              <Inline spread="space-between" alignBlock="center">
                <Text weight="bold">{application.agency}</Text>
                <ApplicationStatusBadge status={application.status} />
              </Inline>

              <Text size="small" color="color.text.subtle">
                {t("application.id")}: {application.processingCode}
              </Text>

              <Text size="small" color="color.text.subtle">
                {t("application.submitted")}:{" "}
                {new Date(application.submittedAt).toLocaleDateString()}
              </Text>
            </Stack>
          </Box>
        ))}

        {/*
          Stated rather than hidden: the transition trail this platform built for
          Procedural Justice is officer-only today. Claiming a reason was sent
          would be inventing a message we cannot see.
        */}
        {applications.length > 0 && (
          <SectionMessage appearance="information">
            <Text>
              A detailed decision history is not yet available to applicants. If a
              status is unclear, contact the agency handling your application.
            </Text>
          </SectionMessage>
        )}
      </Stack>
    </Box>
  );
}
