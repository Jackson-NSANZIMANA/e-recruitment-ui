// ══════════════════════════════════════════════════════════════════
// field-ops — Physical test station (S08, kit item 4)
//
// One candidate at a time. The result is written to the device ledger FIRST
// (LOCAL_ONLY, signed), then sent with syncFieldScores, and the screen says what
// the SERVER answered for THIS record:
//   acknowledged   green, "the server has it"
//   waiting        the paper prompt: nothing reached the server, write the results
//                  on the paper sheet; sending again is the officer's deliberate
//                  press (nothing is retried by itself, OFFLINE_CAPTURE_CAN_SYNC
//                  is false)
//   refused / conflict   named, never "saved"
// ══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Heading from '@atlaskit/heading';
import Button from '@atlaskit/button';
import LinkButton from '@atlaskit/button/link';
import LoadingButton from '@atlaskit/button/loading-button';
import TextField from '@atlaskit/textfield';
import SectionMessage from '@atlaskit/section-message';
import { ErrorMessage, HelperMessage, Label } from '@atlaskit/form';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { syncFieldScores, type ApiClient } from '@usrp/api-client';
import type { StoredRecord } from '@usrp/field-ledger';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { useDeviceRuntime, useOnline } from '../runtime/context.tsx';
import { capturePhysical, fateOf, isKnownRejectReason, isServerAcknowledged, stationActorId, recoverInterrupted, sendRecords, summarise, PHYSICAL_KIND } from '../model/field-sync.ts';
import { PHYSICAL_BOUNDS, PHYSICAL_FIELDS, readPhysicalForm, type PhysicalField, type PhysicalForm } from '../model/physical.ts';
import { ticketFit, type TicketRef } from '../model/ticket.ts';
import { readVenueDay } from '../model/venue.ts';
import type { Readiness } from '../model/readiness.ts';
import { StationPage } from '../ui/Page.tsx';
import { TicketInput } from '../ui/TicketInput.tsx';
import { RecordFateLozenge } from '../ui/RecordFate.tsx';

const box = cssMap({ b: { padding: token('space.300'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') } });

const EMPTY: PhysicalForm = { heightCm: '', weightKg: '', chestCm: '', run3kmTimeSeconds: '', remeasureReason: '' };

export default function PhysicalPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const session = useOfficerSession();
  const state = useDeviceRuntime();
  const online = useOnline();
  const reasonId = useId();
  const fieldIds = { heightCm: useId(), weightKg: useId(), chestCm: useId(), run3kmTimeSeconds: useId() };
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [ticket, setTicket] = useState<TicketRef | null>(null);
  const [form, setForm] = useState<PhysicalForm>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState<StoredRecord | null>(null);
  const [records, setRecords] = useState<readonly StoredRecord[]>([]);
  const runtime = state.status === 'ready' ? state.runtime : null;
  const agency = session?.agency ?? '';
  const day = readVenueDay();

  const reload = useCallback(async (): Promise<readonly StoredRecord[]> => {
    if (runtime === null) return [];
    const all = (await runtime.ledger.list()).filter((r) => r.envelope.kind === PHYSICAL_KIND);
    setRecords(all);
    return all;
  }, [runtime]);

  useEffect(() => {
    if (runtime === null) return;
    void (async () => {
      await recoverInterrupted(runtime.ledger);
      await runtime.measureClock(client.baseUrl);
      setReadiness(await runtime.probe(agency));
      await reload();
    })();
  }, [runtime, agency, client.baseUrl, reload]);

  const send = useCallback(async (targets: readonly StoredRecord[]): Promise<void> => {
    if (runtime === null) return;
    await sendRecords(runtime.ledger, runtime.signer, (wires) => syncFieldScores(client, wires), targets);
    const all = await reload();
    setCurrent((prev) => (prev === null ? prev : all.find((r) => r.envelope.recordId === prev.envelope.recordId) ?? prev));
  }, [runtime, client, reload]);

  const reading = readPhysicalForm(form);

  const save = async (): Promise<void> => {
    setTouched(true);
    if (runtime === null || session === null || ticket === null || day === null || reading.metrics === null) return;
    if (ticketFit(ticket, day, agency) !== 'MATCHES') return;
    setBusy(true);
    setFailed(false);
    try {
      const record = await capturePhysical(runtime.ledger, { ticket, metrics: reading.metrics, day, officerSubject: stationActorId() });
      setCurrent(record);
      await send([record]);
    } catch {
      // The device could not write or send (storage full or aborted): nothing may be claimed. Paper.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const next = (): void => { setTicket(null); setForm(EMPTY); setTouched(false); setCurrent(null); setFailed(false); };

  if (state.status === 'failed') {
    return (
      <StationPage title={t('field_ops.physical.title')}>
        <SectionMessage appearance="error" title={t('field_ops.setup.runtime_failed_title')} headingLevel="h2"><Text as="p">{t('field_ops.setup.runtime_failed_body')}</Text></SectionMessage>
      </StationPage>
    );
  }
  if (readiness?.blocked === true || (readiness !== null && day === null)) {
    return (
      <StationPage title={t('field_ops.physical.title')}>
        <SectionMessage appearance="error" title={t('field_ops.physical.blocked_title')} headingLevel="h2" testId="physical-blocked">
          <Stack space="space.200">
            <Text as="p">{t('field_ops.physical.blocked_body')}</Text>
            <Box><LinkButton appearance="primary" href="/setup">{t('field_ops.physical.open_setup')}</LinkButton></Box>
          </Stack>
        </SectionMessage>
      </StationPage>
    );
  }

  const fate = current === null ? null : fateOf(current.state);
  const fit = ticket === null ? null : ticketFit(ticket, day, agency);
  const summary = summarise(records);
  const fieldLabel = (f: PhysicalField): string => (f === 'heightCm' ? t('field_ops.physical.height') : f === 'weightKg' ? t('field_ops.physical.weight') : f === 'chestCm' ? t('field_ops.physical.chest') : t('field_ops.physical.run'));
  const problemText = (f: PhysicalField): string | null => {
    const p = reading.problems[f];
    if (p === 'required') return t('field_ops.physical.required');
    if (p === 'not_a_number') return t('field_ops.physical.not_a_number');
    if (reading.outOfRange.includes(f)) return t('field_ops.physical.out_of_range', { min: PHYSICAL_BOUNDS[f].min, max: PHYSICAL_BOUNDS[f].max });
    return null;
  };
  const reason = current?.reason;
  const reasonText = isKnownRejectReason(reason) ? t(`field_ops.physical.reasons.${reason}`) : t('field_ops.physical.reasons.UNKNOWN');

  return (
    <StationPage title={t('field_ops.physical.title')} intro={t('field_ops.physical.intro')} testId="physical-page">
      {!online && (
        <SectionMessage appearance="warning" title={t('field_ops.physical.offline_title')} headingLevel="h2" testId="physical-offline">
          <Text as="p">{t('field_ops.physical.offline_body')}</Text>
        </SectionMessage>
      )}

      {failed && (
        <SectionMessage appearance="error" title={t('field_ops.physical.device_failed_title')} headingLevel="h2" testId="physical-device-failed">
          <Text as="p">{t('field_ops.physical.device_failed_body')}</Text>
        </SectionMessage>
      )}

      {current !== null && fate !== null ? (
        <SectionMessage
          appearance={fate === 'ACKNOWLEDGED' || fate === 'DUPLICATE' || fate === 'RESOLVED' ? 'success' : fate === 'WAITING' || fate === 'SENDING' ? 'warning' : 'error'}
          title={
            fate === 'ACKNOWLEDGED' || fate === 'RESOLVED' ? t('field_ops.physical.acknowledged_title')
              : fate === 'DUPLICATE' ? t('field_ops.physical.duplicate_title')
              : fate === 'WAITING' || fate === 'SENDING' ? t('field_ops.physical.waiting_title')
              : fate === 'REFUSED' ? t('field_ops.physical.refused_title')
              : t('field_ops.physical.conflict_title')
          }
          headingLevel="h2"
          testId="physical-outcome"
        >
          <Stack space="space.200">
            {fate === 'ACKNOWLEDGED' || fate === 'RESOLVED' ? <Text as="p">{t('field_ops.physical.acknowledged_body')}</Text> : null}
            {fate === 'DUPLICATE' ? <Text as="p">{t('field_ops.physical.duplicate_body')}</Text> : null}
            {fate === 'WAITING' || fate === 'SENDING' ? <Text as="p" testId="physical-paper-prompt">{t('field_ops.physical.paper_prompt')}</Text> : null}
            {fate === 'REFUSED' ? <Text as="p">{reasonText}</Text> : null}
            {fate === 'CONFLICT' || fate === 'WITH_SUPERVISOR' ? <Text as="p">{t('field_ops.physical.conflict_body')}</Text> : null}
            <Inline space="space.200" shouldWrap>
              {(fate === 'WAITING') && (
                <LoadingButton appearance="primary" isLoading={busy} onClick={() => { setBusy(true); void send([current]).catch(() => { setFailed(true); }).finally(() => { setBusy(false); }); }} testId="physical-send-again">{t('field_ops.physical.send_again')}</LoadingButton>
              )}
              <Button appearance={fate === 'WAITING' ? 'default' : 'primary'} onClick={next} testId="physical-next">{t('field_ops.physical.next')}</Button>
            </Inline>
          </Stack>
        </SectionMessage>
      ) : (
        <Stack space="space.300">
          <TicketInput ticket={ticket} testId="physical-scanner" onTicket={(tk) => { setTicket(tk); }} onClear={() => { setTicket(null); }} />
          {fit !== null && fit !== 'MATCHES' && (
            <SectionMessage appearance="warning" title={t('field_ops.ticket.not_this_venue_title')} headingLevel="h3" testId="ticket-misfit">
              <Text as="p">{fit === 'OTHER_AGENCY' ? t('field_ops.ticket.other_agency') : fit === 'OTHER_DAY' ? t('field_ops.ticket.other_day') : t('field_ops.ticket.other_venue')}</Text>
            </SectionMessage>
          )}
          {ticket !== null && (
            <Stack space="space.200">
              {PHYSICAL_FIELDS.map((f) => (
                <Stack space="space.050" key={f}>
                  <Label htmlFor={fieldIds[f]}>{fieldLabel(f)}</Label>
                  <TextField
                    id={fieldIds[f]}
                    value={form[f]}
                    inputMode="decimal"
                    autoComplete="off"
                    isInvalid={touched && reading.problems[f] !== undefined}
                    onChange={(e) => { setForm({ ...form, [f]: e.currentTarget.value }); }}
                  />
                  {problemText(f) !== null && (touched || reading.outOfRange.includes(f)) ? <ErrorMessage>{problemText(f)}</ErrorMessage> : <HelperMessage>{t('field_ops.physical.bounds', { min: PHYSICAL_BOUNDS[f].min, max: PHYSICAL_BOUNDS[f].max })}</HelperMessage>}
                </Stack>
              ))}
              {reading.outOfRange.length > 0 && (
                <Stack space="space.050">
                  <Label htmlFor={reasonId}>{t('field_ops.physical.reason_label')}</Label>
                  <TextField id={reasonId} value={form.remeasureReason} autoComplete="off" isInvalid={touched && reading.needsReason} onChange={(e) => { setForm({ ...form, remeasureReason: e.currentTarget.value }); }} />
                  {touched && reading.needsReason ? <ErrorMessage>{t('field_ops.physical.reason_required')}</ErrorMessage> : <HelperMessage>{t('field_ops.physical.reason_help')}</HelperMessage>}
                </Stack>
              )}
              <Inline>
                <LoadingButton appearance="primary" isLoading={busy} isDisabled={runtime === null || day === null || (fit !== null && fit !== 'MATCHES')} onClick={() => { void save(); }} testId="physical-save">{t('field_ops.physical.save')}</LoadingButton>
              </Inline>
            </Stack>
          )}
        </Stack>
      )}

      <Box xcss={box.b}>
        <Stack space="space.150">
          <Heading size="small" as="h2">{t('field_ops.physical.recent')}</Heading>
          <Text color="color.text.subtle" testId="physical-summary">{t('field_ops.physical.summary', { acknowledged: summary.acknowledged, waiting: summary.waiting })}</Text>
          {records.length === 0 ? <Text color="color.text.subtle">{t('field_ops.physical.none_yet')}</Text> : records.slice(-5).reverse().map((r) => (
            <Inline key={r.envelope.recordId} space="space.200" alignBlock="center" spread="space-between">
              <Text>{t('field_ops.physical.record_line', { n: r.envelope.localSequence, time: r.envelope.capturedAt.slice(11, 16) })}</Text>
              <RecordFateLozenge state={r.state} />
            </Inline>
          ))}
          {summary.waiting > 0 && fate === null && (
            <Inline><Button onClick={() => { void send(records.filter((r) => !isServerAcknowledged(r.state))); }} testId="physical-send-all">{t('field_ops.physical.send_waiting')}</Button></Inline>
          )}
        </Stack>
      </Box>
    </StationPage>
  );
}
