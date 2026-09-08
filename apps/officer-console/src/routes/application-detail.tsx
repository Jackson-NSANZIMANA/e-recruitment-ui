import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useApplicationDetail } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { useParams } from "react-router-dom";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const pageStyles = cssMap({ base: { maxWidth: "900px", marginInline: "auto", paddingBlock: token("space.400"), paddingInline: token("space.500") } });

export default function ApplicationDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError } = useApplicationDetail(client, id ?? "");
  if (isLoading) return <Box xcss={pageStyles.base}><Spinner label={t("a11y.loading")} /></Box>;
  if (isError || data === undefined) return <Box xcss={pageStyles.base}><SectionMessage appearance="error" title={t("errors.not_found")}>{t("errors.not_found")}</SectionMessage></Box>;
  const application = data.application.application;
  const history = data.history?.history ?? [];
  return <Box xcss={pageStyles.base}><Stack space="space.500">
    <Inline spread="space-between" alignBlock="center"><Stack space="space.100"><Heading size="large" as="h1">{application.processingCode}</Heading><Text color="color.text.subtle" size="small">{t("application.id")}: {application.id}</Text></Stack><ApplicationStatusBadge status={application.status} /></Inline>
    <SectionMessage title={t("application.history")}><Stack space="space.100">{history.map((event, index) => <Inline key={`${event.at}-${index}`} space="space.150" alignBlock="start"><Text size="small" color="color.text.subtle">{new Date(event.at).toLocaleString()}</Text><Text size="small">{event.actorKind} → {event.toStatus}{event.reason !== null ? `: ${event.reason}` : ""}</Text></Inline>)}</Stack></SectionMessage>
    {data.partial.length > 0 && <SectionMessage appearance="warning">{t("errors.generic")}</SectionMessage>}
    <Button appearance="primary" href="/applications">{t("actions.back")}</Button>
  </Stack></Box>;
}
