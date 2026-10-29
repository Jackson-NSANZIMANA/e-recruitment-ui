// ══════════════════════════════════════════════════════════════════
// field-ops — Medical station (S08, kit item 5; ADR-013)
//
// The mode comes from the SESSION's agency, never from a choice on screen:
//   RDF       BOARD        the in-house board's verdict, FIT or UNFIT
//   RNP, RCS  CERTIFICATE  a government physician's certificate, with the name
// The candidate is identified by the pass (application id read from its claims).
// The screen shows what the server answered; a 422 detail is never rendered.
// ══════════════════════════════════════════════════════════════════

import React, { useId, useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Button from '@atlaskit/button';
import LoadingButton from '@atlaskit/button/loading-button';
import TextField from '@atlaskit/textfield';
import SectionMessage from '@atlaskit/section-message';
import { ErrorMessage, Label } from '@atlaskit/form';
import { ApiError, recordMedicalReview, type ApiClient } from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { choicesFor, medicalInputFor, medicalModeFor, type MedicalChoice } from '../model/medical.ts';
import { ticketFit, type TicketRef } from '../model/ticket.ts';
import { readVenueDay } from '../model/venue.ts';
import { StationPage } from '../ui/Page.tsx';
import { TicketInput } from '../ui/TicketInput.tsx';

type Outcome = { readonly kind: 'recorded'; readonly choice: MedicalChoice } | { readonly kind: 'refused'; readonly why: 'not_applicable' | 'not_found' | 'forbidden' | 'invalid' | 'other' } | { readonly kind: 'offline' };

export default function MedicalPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const session = useOfficerSession();
  const nameId = useId();
  const [ticket, setTicket] = useState<TicketRef | null>(null);
  const [choice, setChoice] = useState<MedicalChoice | null>(null);
  const [physician, setPhysician] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const mode = medicalModeFor(session?.agency ?? '');
  const day = readVenueDay();

  if (mode === null) {
    return (
      <StationPage title={t('field_ops.medical.title')}>
        <SectionMessage appearance="warning" title={t('field_ops.medical.no_mode_title')} headingLevel="h2" testId="medical-no-mode"><Text as="p">{t('field_ops.medical.no_mode_body')}</Text></SectionMessage>
      </StationPage>
    );
  }

  const fit = ticket === null ? null : ticketFit(ticket, day, session?.agency ?? '');
  const built = ticket === null || choice === null ? null : medicalInputFor(mode, ticket.applicationId, choice, physician);
  const needsPhysician = choice === 'CERT_VERIFIED';

  const record = async (): Promise<void> => {
    setTouched(true);
    if (built === null || !('input' in built)) return;
    if (fit !== null && fit !== 'MATCHES') return;
    setBusy(true);
    try {
      await recordMedicalReview(client, built.input);
      setOutcome({ kind: 'recorded', choice: choice as MedicalChoice });
    } catch (error) {
      const n = error instanceof ApiError ? error.normalised : null;
      setOutcome(
        n?.kind === 'network' ? { kind: 'offline' }
          : { kind: 'refused', why: n?.kind === 'conflict' ? 'not_applicable' : n?.kind === 'notFound' ? 'not_found' : n?.kind === 'forbidden' ? 'forbidden' : n?.kind === 'badRequest' || n?.kind === 'unprocessable' ? 'invalid' : 'other' },
      );
    } finally {
      setBusy(false);
    }
  };

  const next = (): void => { setTicket(null); setChoice(null); setPhysician(''); setTouched(false); setOutcome(null); };

  return (
    <StationPage title={t('field_ops.medical.title')} intro={t(`field_ops.medical.intro_${mode}`)} testId="medical-page">
      {outcome !== null ? (
        <SectionMessage
          appearance={outcome.kind === 'recorded' ? 'success' : outcome.kind === 'offline' ? 'warning' : 'error'}
          title={outcome.kind === 'recorded' ? t('field_ops.medical.recorded_title') : outcome.kind === 'offline' ? t('field_ops.medical.offline_title') : t('field_ops.medical.refused_title')}
          headingLevel="h2"
          testId="medical-outcome"
        >
          <Stack space="space.200">
            <Text as="p">
              {outcome.kind === 'recorded' ? t(`field_ops.medical.recorded_${outcome.choice}`) : outcome.kind === 'offline' ? t('field_ops.medical.offline_body') : t(`field_ops.medical.refused_${outcome.why}`)}
            </Text>
            <Inline space="space.200" shouldWrap>
              <Button appearance="primary" onClick={next} testId="medical-next">{t('field_ops.medical.next')}</Button>
            </Inline>
          </Stack>
        </SectionMessage>
      ) : (
        <Stack space="space.300">
          <TicketInput ticket={ticket} testId="medical-scanner" onTicket={(tk) => { setTicket(tk); }} onClear={() => { setTicket(null); }} />
          {fit !== null && fit !== 'MATCHES' && (
            <SectionMessage appearance="warning" title={t('field_ops.ticket.not_this_venue_title')} headingLevel="h3" testId="ticket-misfit">
              <Text as="p">{fit === 'OTHER_AGENCY' ? t('field_ops.ticket.other_agency') : fit === 'OTHER_DAY' ? t('field_ops.ticket.other_day') : fit === 'OTHER_VENUE' ? t('field_ops.ticket.other_venue') : t('field_ops.ticket.no_venue_day')}</Text>
            </SectionMessage>
          )}
          {ticket !== null && (
            <Stack space="space.200">
              <Text weight="bold">{t(`field_ops.medical.choose_${mode}`)}</Text>
              <Inline space="space.200" shouldWrap>
                {choicesFor(mode).map((c) => (
                  <Button key={c} appearance={choice === c ? 'primary' : 'default'} isSelected={choice === c} onClick={() => { setChoice(c); }} testId={`medical-choice-${c}`}>{t(`field_ops.medical.choice.${c}`)}</Button>
                ))}
              </Inline>
              {needsPhysician && (
                <Stack space="space.050">
                  <Label htmlFor={nameId}>{t('field_ops.medical.physician')}</Label>
                  <TextField id={nameId} value={physician} autoComplete="off" isInvalid={touched && built !== null && 'problem' in built} onChange={(e) => { setPhysician(e.currentTarget.value); }} />
                  {touched && built !== null && 'problem' in built && <ErrorMessage>{physician.trim().length === 0 ? t('field_ops.medical.physician_required') : t('field_ops.medical.physician_too_long')}</ErrorMessage>}
                </Stack>
              )}
              <Box>
                <LoadingButton appearance="primary" isLoading={busy} isDisabled={choice === null || (fit !== null && fit !== 'MATCHES')} onClick={() => { void record(); }} testId="medical-record">{t('field_ops.medical.record')}</LoadingButton>
              </Box>
            </Stack>
          )}
        </Stack>
      )}
    </StationPage>
  );
}
