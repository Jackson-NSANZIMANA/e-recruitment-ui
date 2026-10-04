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
} from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { EDGE_BASE_URL } from "../../env.js";

interface ApplicationActionsProps {
  readonly applicationId: string;
  readonly onActionComplete: () => void;
  readonly testId?: string;
}

type ActionFeedback = "success" | "conflict" | "error" | null;

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const toolbarStyles = cssMap({ base: { paddingBlock: token("space.200") } });

function feedbackKey(
  feedback: Exclude<ActionFeedback, null>,
): "officer_actions.action_completed" | "officer_actions.conflict" | "errors.generic" {
  switch (feedback) {
    case "success":
      return "officer_actions.action_completed";
    case "conflict":
      return "officer_actions.conflict";
    default:
      return "errors.generic";
  }
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
  const isPending = accept.isPending || adjudicate.isPending;
  const isDisabled = isPending || session === null;

  const handleFailure = useCallback((error: unknown): void => {
    setFeedback(
      error instanceof ApiError && error.normalised.kind === "conflict"
        ? "conflict"
        : "error",
    );
  }, []);

  const handleApprove = useCallback(async (): Promise<void> => {
    setFeedback(null);
    try {
      await accept.mutateAsync({ applicationId });
      setFeedback("success");
      onActionComplete();
    } catch (error) {
      handleFailure(error);
    }
  }, [accept, applicationId, handleFailure, onActionComplete]);

  const handleConfirmReject = useCallback(async (): Promise<void> => {
    setFeedback(null);
    try {
      await adjudicate.mutateAsync({ applicationId, decision: "REJECT" });
      setIsRejectModalOpen(false);
      setFeedback("success");
      onActionComplete();
    } catch (error) {
      handleFailure(error);
    }
  }, [adjudicate, applicationId, handleFailure, onActionComplete]);

  return (
    <Stack space="space.200" {...(testId === undefined ? {} : { testId })}>
      {feedback !== null && (
        <SectionMessage
          appearance={feedback === "success" ? "success" : "error"}
          title={t(feedbackKey(feedback))}
          headingLevel="h3"
          aria-live="polite"
        >
          {feedback === "success"
            ? t("officer_actions.action_completed_description")
            : feedback === "conflict"
              ? t("officer_actions.conflict_description")
              : t("errors.generic")}
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
        <Button
          appearance="danger"
          isDisabled={isDisabled}
          onClick={() => setIsRejectModalOpen(true)}
        >
          {t("actions.reject")}
        </Button>
      </Inline>

      <ModalTransition>
        {isRejectModalOpen && (
          <ModalDialog onClose={() => setIsRejectModalOpen(false)} width="small">
            <ModalHeader>
              <ModalTitle appearance="danger">
                {t("officer_actions.reject_confirm_title")}
              </ModalTitle>
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
                <Button
                  appearance="subtle"
                  onClick={() => setIsRejectModalOpen(false)}
                  isDisabled={isPending}
                >
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
