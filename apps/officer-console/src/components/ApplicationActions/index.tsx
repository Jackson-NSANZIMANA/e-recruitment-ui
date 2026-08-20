import React, { useCallback, useState } from "react";
import ModalDialog, {
  ModalTransition,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useTransitionApplication } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import type { ApplicationStatus } from "@usrp/shared-types";
import { TERMINAL_STATUSES } from "@usrp/shared-types";
import { BFF_BASE_URL } from "../../env.js";

interface ApplicationActionsProps {
  readonly applicationId: string;
  readonly currentStatus: ApplicationStatus;
  readonly onActionComplete: () => void;
  readonly testId?: string;
}

// Module-scope API client — same pattern as application-detail.tsx.
const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-scope styles.
const toolbarStyles = cssMap({
  base: {
    paddingBlock: token("space.200"),
  },
});

/**
 * ApplicationActions toolbar — appears on the application detail page.
 *
 * Approve / Request documents / Reject.  Reject requires a confirmation
 * modal before the BFF is called.  All buttons are disabled while any
 * mutation is in flight.
 *
 * Status transitions used:
 *   Approve          → SHORTLISTED  (move forward in the pipeline)
 *   Request documents → UNDER_REVIEW (flag for doc collection; note attached)
 *   Reject           → REJECTED     (terminal; requires confirmation)
 */
export function ApplicationActions({
  applicationId,
  currentStatus,
  onActionComplete,
  testId,
}: ApplicationActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useTransitionApplication(client);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Disable all actions once in a terminal state.
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);
  const isDisabled = isPending || isTerminal;

  const handleApprove = useCallback(async (): Promise<void> => {
    await mutateAsync({
      applicationId,
      toStatus: "SHORTLISTED",
    });
    onActionComplete();
  }, [applicationId, mutateAsync, onActionComplete]);

  const handleRequestDocuments = useCallback(async (): Promise<void> => {
    await mutateAsync({
      applicationId,
      toStatus: "UNDER_REVIEW",
      note: "Additional documents requested by officer.",
    });
    onActionComplete();
  }, [applicationId, mutateAsync, onActionComplete]);

  const openRejectModal = useCallback((): void => {
    setIsRejectModalOpen(true);
  }, []);

  const closeRejectModal = useCallback((): void => {
    setIsRejectModalOpen(false);
  }, []);

  const handleConfirmReject = useCallback(async (): Promise<void> => {
    setIsRejectModalOpen(false);
    await mutateAsync({
      applicationId,
      toStatus: "REJECTED",
    });
    onActionComplete();
  }, [applicationId, mutateAsync, onActionComplete]);

  return (
    <>
      <Inline
        space="space.200"
        xcss={toolbarStyles.base}
        {...(testId !== undefined ? { testId } : {})}
      >
        <Button
          appearance="primary"
          isDisabled={isDisabled}
          onClick={() => {
            void handleApprove();
          }}
        >
          {t("actions.approve")}
        </Button>

        <Button
          appearance="default"
          isDisabled={isDisabled}
          onClick={() => {
            void handleRequestDocuments();
          }}
        >
          {t("officer_actions.request_documents")}
        </Button>

        <Button
          appearance="danger"
          isDisabled={isDisabled}
          onClick={openRejectModal}
        >
          {t("actions.reject")}
        </Button>
      </Inline>

      {/* Reject confirmation modal */}
      <ModalTransition>
        {isRejectModalOpen && (
          <ModalDialog
            onClose={closeRejectModal}
            width="small"
          >
            <ModalHeader>
              <ModalTitle appearance="danger">
                {t("officer_actions.reject_confirm_title")}
              </ModalTitle>
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
                  onClick={closeRejectModal}
                  isDisabled={isPending}
                >
                  {t("actions.cancel")}
                </Button>
                <LoadingButton
                  appearance="danger"
                  isLoading={isPending}
                  onClick={() => {
                    void handleConfirmReject();
                  }}
                >
                  {t("actions.confirm")}
                </LoadingButton>
              </Inline>
            </ModalFooter>
          </ModalDialog>
        )}
      </ModalTransition>
    </>
  );
}
