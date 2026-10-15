// ═══════════════════════════════════════════════════════════════
// officer-console — Venue gate: single-use admission (BUILD-003, ADR-034)
//
// The screening officer's exam-day screen. Three inputs, one decision:
//   1. this gate's venue (set once, remembered on the device);
//   2. the candidate's exam QR — camera, or a hand-held scanner typing into
//      the field;
//   3. the national ID number typed from the candidate's card.
// The server decides; this screen only shows the answer, and the colour is the
// instruction: green = let them in, anything else = do not.
//
// Nothing about the candidate is shown beyond the processing code and category
// the server returns. The QR text is a credential and is never displayed.
// ═══════════════════════════════════════════════════════════════

import React, { useId, useRef, useState } from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import TextField from "@atlaskit/textfield";
import { ErrorMessage, HelperMessage, Label } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAdmitAtGate, type GateAdmissionResult } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { QrScanner } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { gateMessage, normaliseNationalId, readStoredVenue, storeVenue } from "../gate/outcome.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const MAX_VENUE_LENGTH = 200;
const MAX_TICKET_LENGTH = 4096;

const styles = cssMap({
  page: { maxWidth: "640px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") },
});

export default function GatePage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const admit = useAdmitAtGate(client);
  const ids = { venue: useId(), qr: useId(), nid: useId() };
  const qrInput = useRef<HTMLInputElement | null>(null);
  const nidInput = useRef<HTMLInputElement | null>(null);

  const [venue, setVenue] = useState<string>(() => readStoredVenue());
  const [venueDraft, setVenueDraft] = useState<string>(venue);
  const [editingVenue, setEditingVenue] = useState<boolean>(venue.length === 0);
  const [qr, setQr] = useState("");
  const [nid, setNid] = useState("");
  const [nidError, setNidError] = useState(false);
  const [result, setResult] = useState<GateAdmissionResult | null>(null);

  const allowed = session?.permissions.includes("admission.gate") ?? false;

  const confirmVenue = (): void => {
    const v = venueDraft.trim();
    if (v.length === 0 || v.length > MAX_VENUE_LENGTH) return;
    storeVenue(v);
    setVenue(v);
    setEditingVenue(false);
  };

  const captured = (value: string): void => {
    const v = value.trim();
    // Longer than any ticket we issue: not a ticket; the server would say so too.
    setQr(v.length > MAX_TICKET_LENGTH ? v.slice(0, MAX_TICKET_LENGTH) : v);
    setResult(null);
    nidInput.current?.focus();
  };

  const next = (): void => {
    setQr("");
    setNid("");
    setNidError(false);
    setResult(null);
    admit.reset();
    qrInput.current?.focus();
  };

  const submit = async (): Promise<void> => {
    const nationalId = normaliseNationalId(nid);
    setNidError(nationalId === null);
    if (nationalId === null || qr.length === 0 || venue.length === 0) return;
    try {
      const answer = await admit.mutateAsync({ qrToken: qr, nationalId, gateVenueName: venue });
      setResult(answer);
      if (navigator.vibrate !== undefined) navigator.vibrate(answer.outcome === "ADMITTED" ? [80] : [200, 80, 200]);
    } catch {
      // Shown below from admit.isError; nothing was recorded.
    }
  };

  if (!allowed) {
    return (
      <Box xcss={styles.page}>
        <Stack space="space.400">
          <Heading size="large" as="h1">{t("gate.title")}</Heading>
          <SectionMessage appearance="warning" title={t("gate.no_permission_title")} headingLevel="h2">
            <Text>{t("gate.no_permission_body")}</Text>
          </SectionMessage>
        </Stack>
      </Box>
    );
  }

  const message = result === null ? null : gateMessage(result, t("gate.self"));

  return (
    <Box xcss={styles.page}>
      <Stack space="space.400">
        <Heading size="large" as="h1">{t("gate.title")}</Heading>
        <Text color="color.text.subtle">{t("gate.intro")}</Text>

        {editingVenue ? (
          <Stack space="space.100">
            <Label htmlFor={ids.venue}>{t("gate.venue_label")}</Label>
            <TextField
              id={ids.venue}
              value={venueDraft}
              autoComplete="off"
              onChange={(e) => { setVenueDraft(e.currentTarget.value); }}
              onKeyDown={(e) => { if (e.key === "Enter") confirmVenue(); }}
            />
            <HelperMessage>{t("gate.venue_help")}</HelperMessage>
            <Inline>
              <Button
                appearance="primary"
                onClick={confirmVenue}
                isDisabled={venueDraft.trim().length === 0 || venueDraft.trim().length > MAX_VENUE_LENGTH}
              >
                {t("gate.venue_set")}
              </Button>
            </Inline>
          </Stack>
        ) : (
          <Inline space="space.200" alignBlock="center" shouldWrap>
            <Text weight="bold">{t("gate.venue_current", { venue })}</Text>
            <Button appearance="subtle" onClick={() => { setVenueDraft(venue); setEditingVenue(true); }}>
              {t("gate.venue_change")}
            </Button>
          </Inline>
        )}

        {!editingVenue && message !== null && (
          <SectionMessage appearance={message.appearance} title={t(message.titleKey)} headingLevel="h2" testId="gate-outcome">
            <Stack space="space.200">
              <Text>{t(message.bodyKey, message.values)}</Text>
              <Inline>
                <Button appearance="primary" onClick={next} autoFocus>{t("gate.next")}</Button>
              </Inline>
            </Stack>
          </SectionMessage>
        )}

        {!editingVenue && message === null && (
          <Stack space="space.300">
            {admit.isError && (
              <SectionMessage appearance="error" title={t("gate.failed_title")} headingLevel="h2">
                <Text>{t("gate.failed_body")}</Text>
              </SectionMessage>
            )}

            <Stack space="space.100">
              <Label htmlFor={ids.qr}>{t("gate.qr_label")}</Label>
              {qr.length === 0 ? (
                <>
                  <TextField
                    id={ids.qr}
                    ref={qrInput}
                    type="password"
                    autoComplete="off"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") captured(e.currentTarget.value);
                    }}
                    onBlur={(e) => { if (e.currentTarget.value.trim().length > 0) captured(e.currentTarget.value); }}
                  />
                  <HelperMessage>{t("gate.qr_help")}</HelperMessage>
                  <QrScanner onScan={captured} testId="gate-scanner" />
                </>
              ) : (
                <Inline space="space.200" alignBlock="center">
                  <Text weight="bold" testId="gate-qr-captured">{t("gate.qr_captured")}</Text>
                  <Button appearance="subtle" onClick={() => { setQr(""); }}>{t("gate.qr_rescan")}</Button>
                </Inline>
              )}
            </Stack>

            <Stack space="space.100">
              <Label htmlFor={ids.nid}>{t("gate.nid_label")}</Label>
              <TextField
                id={ids.nid}
                ref={nidInput}
                value={nid}
                inputMode="numeric"
                autoComplete="off"
                isInvalid={nidError}
                onChange={(e) => { setNid(e.currentTarget.value); setNidError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              />
              {nidError ? <ErrorMessage>{t("gate.nid_invalid")}</ErrorMessage> : <HelperMessage>{t("gate.nid_help")}</HelperMessage>}
            </Stack>

            <Inline>
              <LoadingButton
                appearance="primary"
                isLoading={admit.isPending}
                isDisabled={qr.length === 0 || nid.trim().length === 0}
                onClick={() => { void submit(); }}
                testId="gate-admit"
              >
                {t("gate.admit")}
              </LoadingButton>
            </Inline>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
