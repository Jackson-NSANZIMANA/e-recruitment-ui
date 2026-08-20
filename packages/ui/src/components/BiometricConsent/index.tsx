import React, { useCallback } from "react";
import ModalDialog, {
  ModalTransition,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button";
import { Inline, Stack } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { AudioTooltip } from "../AudioTooltip/index.js";

interface BiometricConsentProps {
  readonly isOpen: boolean;
  readonly agencyName: string;
  readonly onConsent: () => void;
  readonly onDecline: () => void;
  readonly testId?: string;
}

/**
 * Full-screen consent modal required before biometric collection.
 *
 * HCI mandate: the AudioTooltip gives a Kinyarwanda voice reading of the
 * consent text for semi-literate applicants (see research section 3).
 *
 * Audio asset expected at /audio/rw/biometric-consent.mp3 — place the file
 * in the app's public/ directory so Vite serves it at that path.
 */
export function BiometricConsent({
  isOpen,
  agencyName,
  onConsent,
  onDecline,
  testId,
}: BiometricConsentProps): React.ReactElement {
  const { t } = useTranslation();

  // ModalDialog onClose passes (event, analyticsEvent) — we only need onDecline.
  const handleClose = useCallback(() => {
    onDecline();
  }, [onDecline]);

  return (
    <ModalTransition>
      {isOpen && (
        <ModalDialog
          onClose={handleClose}
          width="large"
          {...(testId !== undefined ? { testId } : {})}
        >
          <ModalHeader>
            <ModalTitle>{t("biometric_consent.title")}</ModalTitle>
          </ModalHeader>

          <ModalBody>
            <Stack space="space.300">
              <p>{t("biometric_consent.body", { agencyName })}</p>

              {/* Kinyarwanda voice reading — HCI mandate for semi-literate applicants */}
              <AudioTooltip
                audioSrc="/audio/rw/biometric-consent.mp3"
                label={t("biometric_consent.audio_label")}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Inline space="space.200" alignInline="end">
              <Button appearance="subtle" onClick={onDecline}>
                {t("biometric_consent.decline")}
              </Button>
              <Button appearance="primary" onClick={onConsent}>
                {t("biometric_consent.agree")}
              </Button>
            </Inline>
          </ModalFooter>
        </ModalDialog>
      )}
    </ModalTransition>
  );
}
