import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import ModalDialog, { CloseButton, ModalBody, ModalFooter, ModalHeader, ModalTitle } from '@atlaskit/modal-dialog';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { useTranslation } from '@usrp/i18n';
import { activationSheetHtml } from '../model/staff.ts';

const styles = cssMap({
  code: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.neutral'),
  },
});

export interface ReleaseDialogProps {
  readonly handle: string;
  readonly code: string;
  readonly expiresAt: string;
  readonly onClose: () => void;
}

/**
 * The one-time activation code, shown ONCE to the administrator who released it
 * (never the creator): copy and print, then close. The code lives only in this
 * component's props; closing discards it and nothing stores it.
 */
export function ReleaseDialog({ handle, code, expiresAt, onClose }: ReleaseDialogProps): React.ReactElement {
  const { t } = useTranslation('identity');
  const [copied, setCopied] = React.useState<'idle' | 'ok' | 'failed'>('idle');
  const expires = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(expiresAt));

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };
  const print = (): void => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=640,height=480');
    if (w === null) return;
    w.document.open();
    w.document.write(activationSheetHtml({
      title: t('identity.release.sheetTitle'), handleLabel: t('identity.release.handle'), handle,
      codeLabel: t('identity.release.code'), code, expiresLabel: t('identity.release.expires'), expires,
      note: t('identity.release.sheetNote'),
    }));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <ModalDialog onClose={onClose} width="medium" testId="release-dialog">
      <ModalHeader>
        <ModalTitle>{t('identity.release.title')}</ModalTitle>
        <CloseButton onClick={onClose} />
      </ModalHeader>
      <ModalBody>
        <Stack space="space.200">
          <Text as="p">{t('identity.release.body', { handle })}</Text>
          <Box xcss={styles['code']}><Heading size="large" as="span" testId="activation-code">{code}</Heading></Box>
          <Text as="p" color="color.text.subtle">{t('identity.release.expiresAt', { when: expires })}</Text>
          <SectionMessage appearance="warning" title={t('identity.release.onceTitle')} headingLevel="h3">
            <Text as="p">{t('identity.release.onceBody')}</Text>
          </SectionMessage>
          {copied === 'ok' && <Text color="color.text.success" role="status">{t('identity.release.copied')}</Text>}
          {copied === 'failed' && <Text color="color.text.danger" role="status">{t('identity.release.copyFailed')}</Text>}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Inline space="space.100" alignInline="end">
          <Button appearance="default" onClick={() => void copy()}>{t('identity.release.copy')}</Button>
          <Button appearance="default" onClick={print}>{t('identity.release.print')}</Button>
          <Button appearance="primary" onClick={onClose}>{t('identity.release.done')}</Button>
        </Inline>
      </ModalFooter>
    </ModalDialog>
  );
}
