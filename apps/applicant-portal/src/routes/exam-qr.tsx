// ═══════════════════════════════════════════════════════════════
// applicant-portal — My exam QR (ADR-033)
//
// The page a citizen opens after completing their application. It always
// tells the truth about the state: while vetting is in progress it says so (and
// re-checks on its own); once the exam slot is assigned it shows the QR — the
// signed invitation the venue verifies offline — with the venue, date and
// reporting time, and lets the citizen DOWNLOAD it as a PNG or print it. Once
// the QR has been used at the gate (ADR-034) it is never shown again: the page
// says where and when the citizen was admitted.
//
// The QR is rendered in the browser from the signed payload, byte for byte.
// Nothing about the citizen beyond the public processing code is shown.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { ApiError, createApiClient, useMyExamInvitation, type ExamInvitationView } from "@usrp/api-client";
import { isRehearsalCampaign } from "@usrp/contracts";
import { useTranslation } from "@usrp/i18n";
import { OfficialDocument, isSandboxBuild } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { QR_DARK, QR_LIGHT, QUIET_ZONE, downloadBlob, qrMatrix, qrSvgPath, renderTicketPng, ticketFilename } from "../qr/exam-qr.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = cssMap({
  page: { maxWidth: "560px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") },
  qrFrame: {
    backgroundColor: token("elevation.surface"),
    borderRadius: token("radius.medium"),
    padding: token("space.200"),
    maxWidth: "360px",
    marginInline: "auto",
  },
});

function hour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "2026-11-14" -> "261114", the ICAO 9303 date form for the verification line. */
function yymmdd(isoDate: string): string {
  return isoDate.slice(2, 10).replace(/-/g, "");
}

function ReadyTicket({ view }: { readonly view: ExamInvitationView }): React.ReactElement {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const invitation = view.invitation;
  const matrix = useMemo(() => (invitation === undefined ? null : qrMatrix(invitation.qrPayload)), [invitation]);

  if (invitation === undefined || matrix === null) {
    return <SectionMessage appearance="error" title={t("exam_qr.unavailable_title")} headingLevel="h2"><Text>{t("exam_qr.unavailable_body")}</Text></SectionMessage>;
  }
  const modules = matrix.length + QUIET_ZONE * 2;
  // A pass issued by a sandbox build is practice whatever the campaign is called (ADR-FE-019).
  const rehearsal = isRehearsalCampaign(view) || isSandboxBuild();
  const details: readonly string[] = [
    // First line of the pass, on screen, on paper and in the PNG: a rehearsal
    // pass can be printed and carried to a venue, so it says what it is.
    ...(rehearsal ? [t("rehearsal.pass_marker")] : []),
    `${t("exam_qr.processing_code")}: ${view.processingCode}`,
    `${t("exam_qr.venue")}: ${invitation.venueName}`,
    `${t("exam_qr.date")}: ${invitation.examDate} · ${t("exam_qr.reporting")}: ${hour(invitation.reportingTimeHour)}`,
  ];

  const download = async (): Promise<void> => {
    setDownloading(true);
    setFailed(false);
    try {
      const png = await renderTicketPng(matrix, {
        title: `${view.agency} — ${view.campaignLabel ?? t("exam_qr.title")}`,
        lines: [...details, t("exam_qr.present_at_gate")],
      });
      downloadBlob(png, ticketFilename(view.processingCode));
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Stack space="space.300">
      {rehearsal && (
        <SectionMessage appearance="warning" title={t("rehearsal.pass_title")} headingLevel="h2">
          <Text>{t("rehearsal.pass_body")}</Text>
        </SectionMessage>
      )}
      <SectionMessage appearance="success" title={t("exam_qr.ready_title")} headingLevel="h2">
        <Text>{t("exam_qr.ready_body")}</Text>
      </SectionMessage>
      {/* The pass is an official document (ADR-FE-020): national header, seeded
          guilloche, watermark, serial and a check-digit verification line.
          The QR inside it is unchanged - still the signed payload, byte for byte. */}
      <OfficialDocument
        title={view.campaignLabel ?? t("exam_qr.title")}
        agency={view.agency}
        serial={view.processingCode}
        verificationFields={[yymmdd(invitation.examDate)]}
      >
        <Box xcss={styles.qrFrame}>
          {/* eslint-disable-next-line @atlaskit/design-system/no-html-image -- generated QR vector, not an image asset; must render pixel-exact */}
          <svg
            role="img"
            aria-label={t("exam_qr.qr_alt", { code: view.processingCode })}
            viewBox={`0 0 ${String(modules)} ${String(modules)}`}
            width="100%"
            shapeRendering="crispEdges"
          >
            <rect width={modules} height={modules} fill={QR_LIGHT} />
            <path d={qrSvgPath(matrix)} fill={QR_DARK} />
          </svg>
        </Box>
        <Stack space="space.100">
          {details.map((line) => <Text key={line}>{line}</Text>)}
          <Text size="small" color="color.text.subtle">
            {t("exam_qr.valid_until")}: {new Date(invitation.validUntil).toLocaleString()}
          </Text>
        </Stack>
      </OfficialDocument>
      {failed && <SectionMessage appearance="warning"><Text>{t("exam_qr.download_failed")}</Text></SectionMessage>}
      <Inline space="space.200">
        <Button appearance="primary" isDisabled={downloading} onClick={() => { void download(); }}>
          {downloading ? t("exam_qr.downloading") : t("exam_qr.download")}
        </Button>
        <Button onClick={() => window.print()}>{t("exam_qr.print")}</Button>
      </Inline>
      <Text size="small" color="color.text.subtle">{t("exam_qr.keep_private")}</Text>
    </Stack>
  );
}

export default function ExamQrPage(): React.ReactElement {
  const { t } = useTranslation();
  const params = useParams();
  const applicationId = params["applicationId"] !== undefined && UUID_RE.test(params["applicationId"]) ? params["applicationId"] : null;
  const query = useMyExamInvitation(client, applicationId);

  let body: React.ReactElement;
  if (applicationId === null) {
    body = <SectionMessage appearance="error"><Text>{t("exam_qr.not_found")}</Text></SectionMessage>;
  } else if (query.isPending) {
    body = <Spinner label={t("a11y.loading")} />;
  } else if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.normalised.kind === "notFound";
    body = <SectionMessage appearance={notFound ? "error" : "warning"}><Text>{notFound ? t("exam_qr.not_found") : t("exam_qr.load_failed")}</Text></SectionMessage>;
  } else {
    const view = query.data;
    body =
      view.state === "READY" ? (
        <ReadyTicket view={view} />
      ) : (
        <SectionMessage
          appearance={
            view.state === "ADMITTED" ? "success"
              : view.state === "PENDING" ? "information"
                : view.state === "ON_HOLD" ? "warning"
                  : "discovery"
          }
          title={t(`exam_qr.states.${view.state}.title`)}
          headingLevel="h2"
        >
          <Stack space="space.100">
            <Text>
              {view.state === "ADMITTED" && view.admission !== undefined
                ? t("exam_qr.states.ADMITTED.body", {
                    venue: view.admission.venueName,
                    time: new Date(view.admission.admittedAt).toLocaleString(),
                  })
                : t(`exam_qr.states.${view.state}.body`)}
            </Text>
            <Text size="small" color="color.text.subtle">{t("exam_qr.processing_code")}: {view.processingCode}</Text>
          </Stack>
        </SectionMessage>
      );
  }

  return (
    <Box xcss={styles.page}>
      <Stack space="space.400">
        <Heading size="large" as="h1">{t("exam_qr.title")}</Heading>
        {body}
        <Text><Link to="/status">{t("apply.view_applications")}</Link></Text>
      </Stack>
    </Box>
  );
}
