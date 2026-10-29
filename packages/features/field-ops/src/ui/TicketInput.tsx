// The pass a station reads: camera scan or a hand-held scanner / typed text.
// The credential is held in state only to extract the ticket; it is never shown.
import React, { useId, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Button from '@atlaskit/button';
import TextField from '@atlaskit/textfield';
import { HelperMessage, Label } from '@atlaskit/form';
import { useTranslation } from '@usrp/i18n';
import { QrScanner } from '@usrp/ui';
import { ticketFromToken, type TicketRef } from '../model/ticket.ts';

export function TicketInput({ onTicket, onClear, ticket, testId }: {
  readonly onTicket: (ticket: TicketRef, token: string) => void;
  readonly onClear: () => void;
  readonly ticket: TicketRef | null;
  readonly testId: string;
}): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const id = useId();
  const [unreadable, setUnreadable] = useState(false);
  const take = (value: string): void => {
    const parsed = ticketFromToken(value.trim());
    setUnreadable(parsed === null);
    if (parsed !== null) onTicket(parsed, value.trim());
  };
  if (ticket !== null) {
    return (
      <Inline space="space.200" alignBlock="center" shouldWrap>
        <Text weight="bold" testId={`${testId}-captured`}>{t('field_ops.ticket.read')}</Text>
        <Button appearance="subtle" onClick={onClear}>{t('field_ops.ticket.rescan')}</Button>
      </Inline>
    );
  }
  return (
    <Stack space="space.100">
      <Label htmlFor={id}>{t('field_ops.ticket.label')}</Label>
      <TextField
        id={id}
        type="password"
        autoComplete="off"
        isInvalid={unreadable}
        onKeyDown={(e) => { if (e.key === 'Enter') take(e.currentTarget.value); }}
        onBlur={(e) => { if (e.currentTarget.value.trim().length > 0) take(e.currentTarget.value); }}
      />
      <HelperMessage>{unreadable ? t('field_ops.ticket.unreadable') : t('field_ops.ticket.help')}</HelperMessage>
      <QrScanner onScan={take} testId={testId} />
    </Stack>
  );
}
