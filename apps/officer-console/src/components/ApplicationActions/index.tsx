import React, { useCallback, useState } from "react";
import ModalDialog, { ModalTransition, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAcceptApplication, useAdjudicateApplication } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { EDGE_BASE_URL } from "../../env.js";

interface ApplicationActionsProps {
  readonly applicationId: string;
  readonly onActionComplete: () => void;
  readonly testId?: string;
}

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const toolbarStyles = cssMap({ base: { paddingBlock: token("space.200") } });

export function ApplicationActions({ applicationId, onActionComplete, testId }: ApplicationActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const accept = useAcceptApplication(client, agency);
  const adjudicate = useAdjudicateApplication(client, agency);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const isPending = accept.isPending || adjudicate.isPending;
  const isDisabled = isPending || session === null;

  const handleApprove = useCallback(async (): Promise<void> => {
    await accept.mutateAsync({ applicationId });
    onActionComplete();
  }, [accept, applicationId, onActionComplete]);

  const handleConfirmReject = useCallback(async (): Promise<void> => {
    setIsRejectModalOpen(false);
    await adjudicate.mutateAsync({ applicationId, decision: "REJECT" });
    onActionComplete();
  }, [adjudicate, applicationId, onActionComplete]);

  return (
    <>
      <Inline space="space.200" xcss={toolbarStyles.base} {...(testId !== undefined ? { testId } : {})}>
        <Button appearance="primary" isDisabled={isDisabled} onClick={() => { void handleApprove(); }}>{t("actions.approve")}</Button>
        <Button appearance="danger" isDisabled={isDisabled} onClick={() => setIsRejectModalOpen(true)}>{t("actions.reject")}</Button>
      </Inline>
      <ModalTransition>
        {isRejectModalOpen && (
          <ModalDialog onClose={() => setIsRejectModalOpen(false)} width="small">
            <ModalHeader><ModalTitle appearance="danger">{t("officer_actions.reject_confirm_title")}</ModalTitle></ModalHeader>
            <ModalBody><Stack space="space.200"><Text>{t("officer_actions.reject_confirm_body")}</Text><Text color="color.text.subtle" size="small">{t("application.id")}: {applicationId}</Text></Stack></ModalBody>
            <ModalFooter><Inline space="space.200" alignInline="end"><Button appearance="subtle" onClick={() => setIsRejectModalOpen(false)} isDisabled={isPending}>{t("actions.cancel")}</Button><LoadingButton appearance="danger" isLoading={isPending} onClick={() => { void handleConfirmReject(); }}>{t("actions.confirm")}</LoadingButton></Inline></ModalFooter>
          </ModalDialog>
        )}
      </ModalTransition>
    </>
  );
}
