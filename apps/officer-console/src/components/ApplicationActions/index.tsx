import React, { useCallback, useState } from "react";
import ModalDialog, {
  CloseButton,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import SectionMessage from "@atlaskit/section-message";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import {
  ApiError,
  createApiClient,
  useAcceptApplication,
  useAdjudicateApplication,
  type TransitionResult,
} from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { EDGE_BASE_URL } from "../../env.js";

interface ApplicationActionsProps {
  readonly applicationId: string;
  readonly onActionComplete: (outcome: TransitionResult["outcome"]) => void;
  readonly testId?: string;
}

type ActionFeedback = "success" | "no_change" | "conflict" | "error" | null;

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const toolbarStyles = cssMap({ base: { paddingBlock: token("space.200") } });

function feedbackKey(
  feedback: Exclude<ActionFeedback, null>,
): "officer_actions.action_completed" | "officer_actions.no_change" | "officer_actions.conflict" | "errors.generic" {
  switch (feedback) {
    case "success":
      return "officer_actions.action_completed";
    case "no_change":
      return "officer_actions.no_change";
    case "conflict":
      return "officer_actions.conflict";
    default:
      return "errors.generic";
  }
}

type Translate = ReturnType<typeof useTranslation>["t"];

function receiptText(result: TransitionResult, t: Translate): string {
  return t("officer_actions.transition_receipt", {
    outcome: result.outcome,
    fromStatus: result.fromStatus ?? "—",
    status: result.status ?? "—",
  });
}

export function ApplicationActions({
  applicationId,
  onActionComplete,
  testId,
}: ApplicationActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const accept = useAcceptApplication(client, agency);
  const adjudicate = useAdjudicateApplication(client, agency);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const [transition, setTransition] = useState<TransitionResult | null>(null);
  const isPending = accept.isPending || adjudicate.isPending;
  const isDisabled = isPending || session === null;

  const handleFailure = useCallback((error: unknown): void => {
    setTransition(null);
    setFeedback(
      error instanceof ApiError && error.normalised.kind === "conflict"
        ? "conflict"
        : "error",
    );
  }, []);

  const handleSuccess = useCallback((result: TransitionResult): void => {
    setTransition(result);
    setFeedback(result.outcome === "NO_CHANGE" ? "no_change" : "success");
    // The parent may show a separate refresh notice, but it receives the exact
    // backend outcome so NO_CHANGE is never described as an update.
    onActionComplete(result.outcome);
  }, [onActionComplete]);

  const handleApprove = useCallback(async (): Promise<void> => {
    setFeedback(null);
    try {
      const result = await accept.mutateAsync({ applicationId });
      handleSuccess(result);
    } catch (error) {
      handleFailure(error);
    }
  }, [accept, applicationId, handleFailure, handleSuccess]);

  const handleConfirmReject = useCallback(async (): Promise<void> => {
    setFeedback(null);
    try {
      const result = await adjudicate.mutateAsync({ applicationId, decision: "REJECT" });
      setIsRejectModalOpen(false);
      handleSuccess(result);
    } catch (error) {
      handleFailure(error);
    }
  }, [adjudicate, applicationId, handleFailure, handleSuccess]);

  return (
    <Stack space="space.200" {...(testId === undefined ? {} : { testId })}>
      {feedback !== null && (
        <SectionMessage
          appearance={feedback === "success" || feedback === "no_change" ? "success" : "error"}
          title={t(feedbackKey(feedback))}
          headingLevel="h3"
          aria-live="polite"
        >
          <Stack space="space.100">
            {feedback === "success" && t("officer_actions.action_completed_description")}
            {feedback === "no_change" && t("officer_actions.no_change_description")}
            {feedback === "conflict" && t("officer_actions.conflict_description")}
            {feedback === "error" && t("errors.generic")}
            {transition !== null && (feedback === "success" || feedback === "no_change") && (
              <Text size="small">{receiptText(transition, t)}</Text>
            )}
          </Stack>
        </SectionMessage>
      )}

      <Inline
        space="space.200"
        xcss={toolbarStyles.base}
        {...(testId === undefined ? {} : { testId: `${testId}-toolbar` })}
      >
        <LoadingButton
          appearance="primary"
          isLoading={accept.isPending}
          isDisabled={isDisabled}
          onClick={() => void handleApprove()}
        >
          {t("actions.approve")}
        </LoadingButton>
        <Button appearance="danger" isDisabled={isDisabled} onClick={() => setIsRejectModalOpen(true)}>
          {t("actions.reject")}
        </Button>
      </Inline>

      <ModalTransition>
        {isRejectModalOpen && (
          <ModalDialog onClose={() => setIsRejectModalOpen(false)} width="small">
            <ModalHeader>
              <ModalTitle appearance="danger">{t("officer_actions.reject_confirm_title")}</ModalTitle>
              <CloseButton onClick={() => setIsRejectModalOpen(false)} />
            </ModalHeader>
            <ModalBody>
              <Stack space="space.200">
                <Text>{t("officer_actions.reject_confirm_body")}</Text>
                <Text color="color.text.subtle" size="small">
                  {t("application.id")}: {applicationId}
                </Text>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Inline space="space.200" alignInline="end">
                <Button appearance="subtle" onClick={() => setIsRejectModalOpen(false)} isDisabled={isPending}>
                  {t("actions.cancel")}
                </Button>
                <LoadingButton
                  appearance="danger"
                  isLoading={adjudicate.isPending}
                  isDisabled={isDisabled}
                  onClick={() => void handleConfirmReject()}
                >
                  {t("actions.confirm")}
                </LoadingButton>
              </Inline>
            </ModalFooter>
          </ModalDialog>
        )}
      </ModalTransition>
    </Stack>
  );
}
