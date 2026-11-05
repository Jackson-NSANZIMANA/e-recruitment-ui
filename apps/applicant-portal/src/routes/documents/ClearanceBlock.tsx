import React, { useEffect, useRef, useState } from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import TextField from "@atlaskit/textfield";
import { ApiError, useAttachMyClearanceCertificate, type ApiClient, type ClearanceState, type DocumentChecklist } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { clearanceCopyKey, isClearanceNumberShape, normaliseClearanceNumber, wantsNumber } from "./model.js";

const POLL_MS = 4_000;
/** How long the block waits for an accepted number to show up in the checklist before offering the field again. */
const SENT_WAIT_MS = 60_000;
/** How each clearance state is drawn: never colour alone (the words differ), but the tone follows the state. */
const TONE: Record<ClearanceState, "success" | "warning" | "information"> = {
  NUMBER_REQUIRED: "information",
  VERIFYING: "information",
  CORRECTION_NEEDED: "warning",
  UNDER_OFFICER_REVIEW: "information",
  VERIFIED: "success",
};

/**
 * The IremboGov criminal-record certificate number field and its states (ADR-048 section 2.3).
 * The citizen types the certificate's application number; background-vetting-service asks
 * Irembo whether it is in force, binds it to the applicant's identity and checks the type and
 * validity window. Used on the documents page AND in the apply journey's documents panel.
 */
export function ClearanceBlock({ client, applicationId, clearance, refresh }: { readonly client: ApiClient; readonly applicationId: string; readonly clearance: NonNullable<DocumentChecklist["items"][number]["clearance"]>; readonly refresh: () => void }): React.ReactElement {
  const { t } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  const attach = useAttachMyClearanceCertificate(client);
  const [value, setValue] = useState("");
  const [shapeError, setShapeError] = useState(false);
  const sent = attach.isSuccess;
  const error = attach.error instanceof ApiError ? attach.error.normalised : null;
  const closed = error !== null && error.kind === "conflict";
  const { reset } = attach;

  // "Sent" describes the attempt in flight. Once the registry answers that the number needs
  // correcting, that attempt is over and the citizen must get the field back without a reload.
  useEffect(() => {
    if (wantsNumber(clearance.state)) reset();
  }, [clearance.state, reset]);

  // The edge accepts the number before a consumer records it, so the next read can still look
  // unchanged, and the page-level poll only runs during VERIFYING. Keep reading until it moves.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const awaitingRecord = sent && wantsNumber(clearance.state);
  useEffect(() => {
    if (!awaitingRecord) return undefined;
    const poll = setInterval(() => { refreshRef.current(); }, POLL_MS);
    const giveUp = setTimeout(reset, SENT_WAIT_MS);
    return () => { clearInterval(poll); clearTimeout(giveUp); };
  }, [awaitingRecord, reset]);

  const submit = (): void => {
    if (!isClearanceNumberShape(value)) { setShapeError(true); return; }
    setShapeError(false);
    attach.mutate({ applicationId, clearanceCertificateNumber: normaliseClearanceNumber(value) });
  };

  return (
    <Stack space="space.100" testId="clearance-block">
      <SectionMessage appearance={TONE[clearance.state]}>
        <Text size="large" testId="clearance-state">{t(clearanceCopyKey(clearance))}</Text>
      </SectionMessage>
      {wantsNumber(clearance.state) && !sent && (
        <Stack space="space.100">
          <label htmlFor={`clearance-number-${applicationId}`}><Text size="large" weight="medium">{t("citizen_docs.clearance.field_label")}</Text></label>
          <Text size="large" color="color.text.subtle">{t("citizen_docs.clearance.hint")}</Text>
          <TextField
            id={`clearance-number-${applicationId}`}
            name="clearanceCertificateNumber"
            value={value}
            autoComplete="off"
            inputMode="text"
            isInvalid={shapeError}
            onChange={(e) => { setValue((e.target as HTMLInputElement).value); setShapeError(false); }}
          />
          {shapeError && <div role="alert"><Text size="large" color="color.text.danger">{t("citizen_docs.clearance.shape")}</Text></div>}
          {error !== null && <div role="alert"><Text size="large" color="color.text.danger">{closed ? t("citizen_docs.clearance.closed") : t("citizen_docs.clearance.failed")}</Text></div>}
          <Inline>
            <Button appearance="primary" isDisabled={attach.isPending} onClick={submit}>
              {attach.isPending ? t("citizen_docs.clearance.sending") : t("citizen_docs.clearance.submit")}
            </Button>
          </Inline>
        </Stack>
      )}
      {sent && <div role="status"><Text size="large" color="color.text.success">{t("citizen_docs.clearance.sent")}</Text></div>}
    </Stack>
  );
}
