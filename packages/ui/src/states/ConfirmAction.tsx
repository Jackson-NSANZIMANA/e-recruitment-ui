import React from "react";
import Button from "@atlaskit/button/new";
import ModalDialog, { CloseButton, ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";

export interface ConfirmActionProps {
  readonly isOpen: boolean;
  readonly isPending?: boolean;
  readonly title: string;
  readonly body: string;
  /** What will happen, one line each ("this officer will be signed out now"). */
  readonly consequences?: readonly string[];
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly appearance?: "primary" | "warning" | "danger";
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  /** A required field (reason, grounds) rendered between body and footer. */
  readonly children?: React.ReactNode;
  /** The confirm button stays disabled until true (e.g. a mandatory reason is chosen). */
  readonly canConfirm?: boolean;
}

/**
 * Lifted from ApplicationDetailPage. Mounted inside ModalTransition (the
 * documented ADS pattern) so the dialog animates out. A state-changing write
 * goes through this; it never retries (the caller's mutation has retry: false).
 */
export function ConfirmAction({
  isOpen, isPending = false, title, body, consequences, confirmLabel, cancelLabel, appearance = "primary",
  onCancel, onConfirm, children, canConfirm = true,
}: ConfirmActionProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <ModalTransition>
      {isOpen && (
        <ModalDialog onClose={onCancel} width="small" testId="confirm-action">
          <ModalHeader>
            <ModalTitle {...(appearance === "primary" ? {} : { appearance })}>{title}</ModalTitle>
            <CloseButton onClick={onCancel} />
          </ModalHeader>
          <ModalBody>
            <Stack space="space.150">
              <Text as="p">{body}</Text>
              {consequences !== undefined && consequences.length > 0 && (
                <Stack space="space.050">
                  {consequences.map((c) => <Text as="p" key={c} weight="medium">{c}</Text>)}
                </Stack>
              )}
              {children}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Inline space="space.100" alignInline="end">
              <Button appearance="subtle" isDisabled={isPending} onClick={onCancel}>{cancelLabel ?? t("ui.confirm.cancel")}</Button>
              <Button appearance={appearance} isDisabled={isPending || !canConfirm} onClick={onConfirm} testId="confirm-action-confirm">{confirmLabel}</Button>
            </Inline>
          </ModalFooter>
        </ModalDialog>
      )}
    </ModalTransition>
  );
}
