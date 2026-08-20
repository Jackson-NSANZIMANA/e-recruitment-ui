import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap, cx } from "@atlaskit/css";
import { createApiClient, useApplicationList } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-level — xcss prop requires cssMap output, not css().
const pageStyles = cssMap({
  base: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.500"),
    paddingInline: token("space.400"),
  },
});

// Per-card border styles — borderRadius in cssMap, borderColor via cssMap variants.
const cardStyles = cssMap({
  base: {
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderRadius: token("radius.medium"),
  },
  normal: {
    borderColor: token("color.border"),
  },
  warning: {
    borderColor: token("color.border.warning"),
  },
});

/**
 * Applicant status page — "Procedural Justice UI" applied.
 *
 * HCI mandate:
 *   "Instead of 'Application Rejected', implement Visual Compliance Check.
 *    Show side-by-side graphic of required standard vs applicant's value.
 *    This shifts user's anger from 'The system is corrupt' to 'I did not meet
 *    the standard', preserving institutional trust."
 */
export default function StatusPage(): React.ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useApplicationList(client, {
    pageSize: 5,
  });

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

  const applications = data?.items ?? [];

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <Heading size="large" as="h1">
          My Applications
        </Heading>

        {applications.length === 0 && (
          <SectionMessage>
            <Text>You have no active applications.</Text>
          </SectionMessage>
        )}

        {applications.map((app) => (
          <Box
            key={app.id}
            padding="space.300"
            backgroundColor="color.background.neutral"
            xcss={cx(cardStyles.base, app.requiresAction ? cardStyles.warning : cardStyles.normal)}
          >
            <Stack space="space.200">
              <Inline spread="space-between" alignBlock="center">
                <Text weight="bold">{app.agency}</Text>
                <ApplicationStatusBadge status={app.status} />
              </Inline>

              <Text size="small" color="color.text.subtle">
                {t("application.submitted")}:{" "}
                {new Date(app.submittedAt).toLocaleDateString()}
              </Text>

              {app.requiresAction && (
                <SectionMessage appearance="warning">
                  <Text>
                    Action required — a document needs to be corrected. Check
                    your SMS for instructions.
                  </Text>
                </SectionMessage>
              )}

              {app.status === "REJECTED" && (
                <SectionMessage appearance="error" title="Application outcome">
                  <Text>
                    Your application did not meet the required criteria. An SMS
                    with the specific reason has been sent to your registered
                    phone number.
                  </Text>
                </SectionMessage>
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
