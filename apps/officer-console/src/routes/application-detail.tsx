import React, { useMemo, useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import {
  ApiError,
  createApiClient,
  useApplicationDetail,
} from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { useParams } from "react-router-dom";
import { ApplicationActions } from "../components/ApplicationActions/index.js";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

const pageStyles = cssMap({
  base: {
    maxWidth: "900px",
    marginInline: "auto",
    paddingBlock: token("space.400"),
    paddingInline: token("space.500"),
  },
});

function errorTranslationKey(error: unknown):
  | "errors.not_found"
  | "errors.forbidden"
  | "errors.network"
  | "errors.generic" {
  if (!(error instanceof ApiError)) return "errors.generic";
  switch (error.normalised.kind) {
    case "notFound":
      return "errors.not_found";
    case "forbidden":
      return "errors.forbidden";
    case "network":
      return "errors.network";
    default:
      return "errors.generic";
  }
}

export default function ApplicationDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [actionCompleted, setActionCompleted] = useState(false);
  const { data, error, isLoading, isError, refetch } = useApplicationDetail(
    client,
    id ?? "",
  );
  const errorCopy = useMemo(() => t(errorTranslationKey(error)), [error, t]);

  if (isLoading) {
    return (
      <Box xcss={pageStyles.base} aria-live="polite" role="status">
        <Spinner label={t("a11y.loading_application")} />
      </Box>
    );
  }

  if (isError || data === undefined) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage
          appearance="error"
          title={errorCopy}
          headingLevel="h1"
        >
          <Stack space="space.200">
            <Text>{errorCopy}</Text>
            <Button appearance="default" onClick={() => void refetch()}>
              {t("actions.try_again")}
            </Button>
          </Stack>
        </SectionMessage>
      </Box>
    );
  }

  const application = data.application.application;
  const history = data.history?.history ?? [];

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Stack space="space.100">
            <Heading size="large" as="h1">
              {application.processingCode}
            </Heading>
            <Text color="color.text.subtle" size="small">
              {t("application.id")}: {application.id}
            </Text>
          </Stack>
          <ApplicationStatusBadge status={application.status} />
        </Inline>

        {actionCompleted && (
          <SectionMessage
            appearance="success"
            title={t("officer_actions.action_completed")}
            headingLevel="h2"
            aria-live="polite"
          >
            {t("officer_actions.action_completed_description")}
          </SectionMessage>
        )}

        <SectionMessage
          title={t("application.history")}
          headingLevel="h2"
          aria-live="polite"
        >
          {history.length === 0 ? (
            <Text>{t("application.no_history")}</Text>
          ) : (
            <Stack space="space.100">
              {history.map((event, index) => (
                <Inline
                  key={`${event.at}-${index}`}
                  space="space.150"
                  alignBlock="start"
                >
                  <Text size="small" color="color.text.subtle">
                    {new Date(event.at).toLocaleString()}
                  </Text>
                  <Text size="small">
                    {event.actorKind} → {t(`status.${event.toStatus}`)}
                    {event.reason !== null ? `: ${event.reason}` : ""}
                  </Text>
                </Inline>
              ))}
            </Stack>
          )}
        </SectionMessage>

        {data.partial.length > 0 && (
          <SectionMessage
            appearance="warning"
            title={t("application.partial_title")}
            headingLevel="h2"
            aria-live="polite"
          >
            {t("application.partial_description")}
          </SectionMessage>
        )}

        <Stack space="space.200">
          <Heading size="small" as="h2">
            {t("application.actions")}
          </Heading>
          <ApplicationActions
            applicationId={application.id}
            onActionComplete={() => setActionCompleted(true)}
            testId="application-actions"
          />
        </Stack>

        <Button appearance="subtle" href="/applications">
          {t("actions.back")}
        </Button>
      </Stack>
    </Box>
  );
}
