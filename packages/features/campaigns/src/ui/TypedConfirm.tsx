// campaigns — a ConfirmAction that also makes the officer type the campaign's public code.
// Used for publish and for every lifecycle command: the consequence is stated, then the
// code typed, so a misplaced click can never change a campaign's state.
import React from 'react';
import Textfield from '@atlaskit/textfield';
import { Stack, Text } from '@atlaskit/primitives/compiled';
import { useTranslation } from '@usrp/i18n';
import { ConfirmAction } from '@usrp/ui';

export function TypedConfirm({ isOpen, isPending, publicCode, title, body, consequences, confirmLabel, appearance = 'primary', error, onCancel, onConfirm }: {
  readonly isOpen: boolean; readonly isPending: boolean; readonly publicCode: string; readonly title: string; readonly body: string;
  readonly consequences: readonly string[]; readonly confirmLabel: string; readonly appearance?: 'primary' | 'warning' | 'danger';
  readonly error?: React.ReactNode; readonly onCancel: () => void; readonly onConfirm: () => void;
}): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => { if (!isOpen) setTyped(''); }, [isOpen]);
  return (
    <ConfirmAction
      isOpen={isOpen} isPending={isPending} title={title} body={body} consequences={consequences}
      confirmLabel={confirmLabel} appearance={appearance} canConfirm={typed.trim().toUpperCase() === publicCode}
      onCancel={onCancel} onConfirm={onConfirm}
    >
      <Stack space="space.100">
        <Text as="p" weight="medium">{t('campaigns.confirm.typeCode', { code: publicCode })}</Text>
        <Textfield
          name="confirm-code" aria-label={t('campaigns.confirm.codeLabel')} autoComplete="off" testId="confirm-code"
          value={typed} onChange={(e) => setTyped((e.target as HTMLInputElement).value)}
        />
        {error}
      </Stack>
    </ConfirmAction>
  );
}
