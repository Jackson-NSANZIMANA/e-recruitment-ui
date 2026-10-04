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
  type ApplicationRecord,
} from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { useParams } from "react-router-dom";
import { ApplicationActions } from "../components/ApplicationActions/index.js";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

const pageStyles = cssMap({
  base: {
    maxWidth: "1100px",
    marginInline: "auto",
    paddingBlock: token("space.400"),
    paddingInline: token("space.500"),
  },
  field: {
    minWidth: "220px",
    flex: "1 1 220px",
  },
  value: {
    overflowWrap: "anywhere",
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

function formatDate(value: string | null, locale: string, missing: string): string {
  if (value === null) return missing;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatValue(
  value: string | number | Readonly<Record<string, unknown>> | null,
  missing: string,
): string {
  if (value === null) return missing;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface DetailFieldProps {
  readonly label: string;
  readonly value: string;
}

function DetailField({ label, value }: DetailFieldProps): React.ReactElement {
  return (
    <Box xcss={pageStyles.field}>
      <Text size="small" color="color.text.subtle">{label}</Text>
      <Text xcss={pageStyles.value}>{value}</Text>
    </Box>
  );
}

function DetailGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <SectionMessage title={title} headingLevel="h2">
      <Inline space="space.300" shouldWrap alignBlock="start">
        {children}
      </Inline>
    </SectionMessage>
  );
}

function ApplicationSummary({
  application,
  locale,
  missing,
  t,
}: {
  readonly application: ApplicationRecord;
  readonly locale: string;
  readonly missing: string;
  readonly t: ReturnType<typeof useTranslation>["t"];
}): React.ReactElement {
  return (
    <Stack space="space.200">
      <DetailGroup title={t("application.summary")}>
        <DetailField label={t("application.category")} value={formatValue(application.category, missing)} />
        <DetailField label={t("application.submitted")} value={formatDate(application.submittedAt, locale, missing)} />
        <DetailField label={t("application.last_updated")} value={formatDate(application.updatedAt, locale, missing)} />
        <DetailField label={t("application.academic_status")} value={formatValue(application.academicStatus, missing)} />
        <DetailField label={t("application.age_status")} value={formatValue(application.ageEligibilityStatus, missing)} />
        <DetailField label={t("application.criminal_clearance")} value={formatValue(application.criminalClearanceStatus, missing)} />
      </DetailGroup>

      <DetailGroup title={t("application.evidence")}>
        <DetailField label={t("application.nesa_index")} value={formatValue(application.nesaIndexNumber, missing)} />
        <DetailField label={t("application.hec_registration")} value={formatValue(application.hecRegistrationNumber, missing)} />
        <DetailField label={t("application.specialist_field")} value={formatValue(application.declaredSpecialistField, missing)} />
        <DetailField label={t("application.academic_eligibility_detail")} value={formatValue(application.academicEligibilityDetail, missing)} />
        <DetailField label={t("application.age_eligibility_detail")} value={formatValue(application.ageEligibilityDetail, missing)} />
        <DetailField label={t("application.criminal_clearance_at")} value={formatDate(application.criminalClearanceAt, locale, missing)} />
        <DetailField label={t("application.document_lane")} value={formatValue(application.documentLane, missing)} />
        <DetailField label={t("application.document_forensics_score")} value={formatValue(application.documentForensicsScore, missing)} />
        <DetailField label={t("application.document_forensics_flags")} value={formatValue(application.documentForensicsFlags, missing)} />
        <DetailField label={t("application.document_review_decision")} value={formatValue(application.documentReviewDecision, missing)} />
        <DetailField label={t("application.document_reviewed_at")} value={formatDate(application.documentReviewedAt, locale, missing)} />
      </DetailGroup>

      <DetailGroup title={t("application.assignment_and_decision")}>
        <DetailField label={t("application.assigned_district")} value={formatValue(application.assignedDistrict, missing)} />
        <DetailField label={t("application.assigned_venue")} value={formatValue(application.assignedVenueName, missing)} />
        <DetailField label={t("application.physical_test_scheduled")} value={formatDate(application.physicalTestScheduledAt, locale, missing)} />
        <DetailField label={t("application.physical_test_completed")} value={formatDate(application.physicalTestCompletedAt, locale, missing)} />
        <DetailField label={t("application.final_decision_at")} value={formatDate(application.finalDecisionAt, locale, missing)} />
        <DetailField label={t("application.final_decision_notes")} value={formatValue(application.finalDecisionNotes, missing)} />
      </DetailGroup>
    </Stack>
  );
}

export default function ApplicationDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const session = useOfficerSession();
  const [actionCompleted, setActionCompleted] = useState(false);
  const { data, error, isLoading, isError, refetch } = useApplicationDetail(
    client,
    id ?? "",
    session !== null,
  );
  const errorCopy = useMemo(() => t(errorTranslationKey(error)), [error, t]);
  const missing = t("application.not_provided");

  if (id === undefined || id.length === 0) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="error" title={t("errors.not_found")} headingLevel="h1">
          {t("errors.not_found")}
        </SectionMessage>
      </Box>
    );
  }

  if (session === null || isLoading) {
    return (
      <Box xcss={pageStyles.base} aria-live="polite" role="status">
        <Spinner label={t("a11y.loading_application")} />
      </Box>
    );
  }

  if (isError || data === undefined) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="error" title={errorCopy} headingLevel="h1">
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

  const application = data.application;
  const applicationId = application.applicationId;
  // The current edge contract guarantees an array here. Keep a defensive
  // partial state for an invalid 200 payload without fabricating a history
  // envelope or hiding the application projection that did arrive.
  const historyValue: unknown = data.history;
  const partial = !Array.isArray(historyValue);
  const history = partial ? [] : data.history;

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Stack space="space.100">
            <Heading size="large" as="h1">
              {application.processingCode ?? applicationId ?? t("application.untitled")}
            </Heading>
            <Text color="color.text.subtle" size="small">
              {t("application.id")}: {applicationId ?? missing}
            </Text>
          </Stack>
          <ApplicationStatusBadge status={application.status} />
        </Inline>

        {actionCompleted && (
          <SectionMessage appearance="success" title={t("officer_actions.action_completed")} headingLevel="h2" aria-live="polite">
            {t("officer_actions.action_completed_description")}
          </SectionMessage>
        )}

        <ApplicationSummary application={application} locale={i18n.language} missing={missing} t={t} />

        {partial && (
          <SectionMessage appearance="warning" title={t("application.partial_title")} headingLevel="h2" aria-live="polite">
            {t("application.partial_description")}
          </SectionMessage>
        )}

        <SectionMessage title={t("application.history")} headingLevel="h2" aria-live="polite">
          {history.length === 0 ? (
            <Text>{t("application.no_history")}</Text>
          ) : (
            <Stack space="space.100">
              {history.map((event, index) => {
                const status = event.status ?? event.toStatus;
                const statusLabel = status === null
                  ? missing
                  : t(`status.${status}`, { defaultValue: status });
                return (
                  <Inline key={event.entryId ?? `${event.occurredAt ?? "event"}-${index}`} space="space.150" alignBlock="start" shouldWrap>
                    <Text size="small" color="color.text.subtle">
                      {formatDate(event.occurredAt, i18n.language, missing)}
                    </Text>
                    <Text size="small">
                      {event.actorKind ?? missing} → {statusLabel}
                      {event.note === null ? "" : `: ${event.note}`}
                    </Text>
                  </Inline>
                );
              })}
            </Stack>
          )}
        </SectionMessage>

        <Stack space="space.200">
          <Heading size="small" as="h2">{t("application.actions")}</Heading>
          {applicationId === null ? (
            <SectionMessage appearance="warning" title={t("application.actions_unavailable")} headingLevel="h3">
              {t("application.identifier_unavailable")}
            </SectionMessage>
          ) : (
            <ApplicationActions
              applicationId={applicationId}
              onActionComplete={(outcome) => setActionCompleted(outcome === "APPLIED")}
              testId="application-actions"
            />
          )}
        </Stack>

        <Button appearance="subtle" href="/applications">{t("actions.back")}</Button>
      </Stack>
    </Box>
  );
}
