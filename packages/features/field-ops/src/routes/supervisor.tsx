// ══════════════════════════════════════════════════════════════════
// field-ops — Supervisor station (S08, kit item 7)
//
//   live counts   getVenueLiveCounts for the confirmed venue day
//   sync centre   this device's ledger: depth, per-record fate, last success
//   fleet         the agency's tablets (listFieldDevices), read only
//   conflicts     the held scores, resolved on /conflicts
// Manual identity confirmation is the gate's typed national-ID lane (ADR-037:
// a biometric NO_MATCH is never a refusal; B2 adds the hand-off to it).
// ══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Heading from '@atlaskit/heading';
import Button from '@atlaskit/button';
import LinkButton from '@atlaskit/button/link';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { getVenueLiveCounts, listFieldDevices, syncFieldScores, type ApiClient } from '@usrp/api-client';
import type { StoredRecord } from '@usrp/field-ledger';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { useDeviceRuntime } from '../runtime/context.tsx';
import { useEdgeRead } from '../runtime/hooks.ts';
import { isServerAcknowledged, PHYSICAL_KIND, sendRecords, summarise } from '../model/field-sync.ts';
import { readVenueDay } from '../model/venue.ts';
import { StationPage } from '../ui/Page.tsx';
import { RecordFateLozenge } from '../ui/RecordFate.tsx';

const box = cssMap({ b: { padding: token('space.300'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') } });

export default function SupervisorPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const session = useOfficerSession();
  const state = useDeviceRuntime();
  const runtime = state.status === 'ready' ? state.runtime : null;
  const day = readVenueDay();
  const [records, setRecords] = useState<readonly StoredRecord[]>([]);
  const [sending, setSending] = useState(false);

  const counts = useEdgeRead(day === null ? null : () => getVenueLiveCounts(client, day), `counts:${day?.campaign ?? ''}:${day?.examDate ?? ''}`);
  const canFleet = session?.permissions.includes('field.device.manage') ?? false;
  const fleet = useEdgeRead(canFleet ? () => listFieldDevices(client) : null, 'fleet');

  const reloadLedger = useCallback(async (): Promise<void> => {
    if (runtime === null) return;
    setRecords((await runtime.ledger.list()).filter((r) => r.envelope.kind === PHYSICAL_KIND));
  }, [runtime]);
  useEffect(() => { void reloadLedger(); }, [reloadLedger]);

  const summary = summarise(records);
  const sendWaiting = async (): Promise<void> => {
    if (runtime === null) return;
    setSending(true);
    try {
      await sendRecords(runtime.ledger, runtime.signer, (wires) => syncFieldScores(client, wires), records.filter((r) => !isServerAcknowledged(r.state)));
      await reloadLedger();
      counts.reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <StationPage title={t('field_ops.supervisor.title')} intro={t('field_ops.supervisor.intro')} testId="supervisor-page">
      <Box xcss={box.b}>
        <Stack space="space.150">
          <Heading size="small" as="h2">{t('field_ops.supervisor.counts_title')}</Heading>
          {day === null ? (
            <Stack space="space.100"><Text color="color.text.subtle">{t('field_ops.supervisor.no_venue_day')}</Text><Box><LinkButton href="/setup">{t('field_ops.physical.open_setup')}</LinkButton></Box></Stack>
          ) : counts.load.status === 'ready' ? (
            <Stack space="space.050" testId="supervisor-counts">
              <Text weight="bold">{day.venueName} · {day.examDate}</Text>
              <Text>{t('field_ops.supervisor.counts', { ...counts.load.data.counts })}</Text>
            </Stack>
          ) : counts.load.status === 'failed' ? (
            <Text testId="supervisor-counts-failed">{counts.load.offline ? t('field_ops.supervisor.read_offline') : t('field_ops.supervisor.read_failed')}</Text>
          ) : <Text>{t('field_ops.check_in.loading')}</Text>}
          <Inline><Button onClick={counts.reload}>{t('field_ops.supervisor.reload')}</Button></Inline>
        </Stack>
      </Box>

      <Box xcss={box.b}>
        <Stack space="space.150">
          <Heading size="small" as="h2">{t('field_ops.supervisor.sync_title')}</Heading>
          <Text testId="supervisor-sync-summary">{t('field_ops.supervisor.sync_summary', { total: summary.total, acknowledged: summary.acknowledged, waiting: summary.waiting, refused: summary.refused, conflicts: summary.conflicts })}</Text>
          <Text color="color.text.subtle">{summary.lastAcknowledgedAt === null ? t('field_ops.supervisor.last_none') : t('field_ops.supervisor.last_ack', { time: summary.lastAcknowledgedAt.slice(11, 16) })}</Text>
          {records.slice(-8).reverse().map((r) => (
            <Inline key={r.envelope.recordId} space="space.200" alignBlock="center" spread="space-between">
              <Text>{t('field_ops.physical.record_line', { n: r.envelope.localSequence, time: r.envelope.capturedAt.slice(11, 16) })}</Text>
              <RecordFateLozenge state={r.state} />
            </Inline>
          ))}
          <Inline space="space.200" shouldWrap>
            {summary.waiting > 0 && <Button appearance="primary" isDisabled={sending} onClick={() => { void sendWaiting(); }} testId="supervisor-send-waiting">{t('field_ops.physical.send_waiting')}</Button>}
            <LinkButton href="/conflicts" testId="supervisor-to-conflicts">{t('field_ops.supervisor.to_conflicts', { count: summary.conflicts })}</LinkButton>
          </Inline>
        </Stack>
      </Box>

      <Box xcss={box.b}>
        <Stack space="space.150">
          <Heading size="small" as="h2">{t('field_ops.supervisor.fleet_title')}</Heading>
          {!canFleet ? <Text color="color.text.subtle">{t('field_ops.supervisor.fleet_no_permission')}</Text>
            : fleet.load.status === 'ready' ? (
              fleet.load.data.devices.length === 0 ? <Text>{t('field_ops.supervisor.fleet_none')}</Text> : (
                <Stack space="space.100" testId="supervisor-fleet">
                  {fleet.load.data.devices.map((d) => (
                    <Inline key={d.deviceId} space="space.200" alignBlock="center" spread="space-between" shouldWrap testId={`fleet-${d.deviceId}`}>
                      <Stack space="space.0">
                        <Text weight="bold">{d.deviceId.slice(0, 8)}</Text>
                        <Text color="color.text.subtle">{d.lastSyncAt === null ? t('field_ops.supervisor.never_synced') : t('field_ops.supervisor.last_sync', { time: d.lastSyncAt.slice(0, 16).replace('T', ' ') })}{d.assignment === null ? '' : ` · ${d.assignment.district} ${d.assignment.examDate}`}</Text>
                      </Stack>
                      <Lozenge appearance={d.revokedAt === null ? 'success' : 'removed'}>{d.revokedAt === null ? t('field_ops.supervisor.device_active') : t('field_ops.supervisor.device_revoked')}</Lozenge>
                    </Inline>
                  ))}
                </Stack>
              )
            ) : fleet.load.status === 'failed' ? (
              <SectionMessage appearance="warning" title={t('field_ops.supervisor.read_failed')} headingLevel="h3"><Button onClick={fleet.reload}>{t('field_ops.supervisor.reload')}</Button></SectionMessage>
            ) : <Text>{t('field_ops.check_in.loading')}</Text>}
        </Stack>
      </Box>

      <Text color="color.text.subtle">{t('field_ops.supervisor.manual_identity')}</Text>
    </StationPage>
  );
}
