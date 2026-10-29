// ══════════════════════════════════════════════════════════════════
// field-ops — Capture conflicts (S08, kit item 7). The supervisor resolves a
// score the server HELD because two captures disagreed (or a newer one already
// stood). The record shown is this device's signed capture; a reason is
// mandatory; resolving APPENDS an event to the record, it never edits it.
// The server's answer decides: only 200 RESOLVED moves the record.
// ══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Heading from '@atlaskit/heading';
import LoadingButton from '@atlaskit/button/loading-button';
import TextField from '@atlaskit/textfield';
import SectionMessage from '@atlaskit/section-message';
import { ErrorMessage, HelperMessage, Label } from '@atlaskit/form';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { resolveFieldSyncConflict, type ApiClient } from '@usrp/api-client';
import type { StoredRecord } from '@usrp/field-ledger';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { useDeviceRuntime } from '../runtime/context.tsx';
import { PHYSICAL_KIND, type PhysicalPayload } from '../model/field-sync.ts';
import { RESOLUTION_MAX_LENGTH, validateResolution } from '../model/conflict.ts';
import { readResolveAnswer, type ResolveVerdict } from '../model/resolve.ts';
import { StationPage } from '../ui/Page.tsx';
import { RecordFateLozenge } from '../ui/RecordFate.tsx';

const box = cssMap({ b: { padding: token('space.300'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') } });

const HELD = new Set(['STALE_CONFLICT', 'NEEDS_SUPERVISOR']);

export default function ConflictsPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const session = useOfficerSession();
  const state = useDeviceRuntime();
  const runtime = state.status === 'ready' ? state.runtime : null;
  const [held, setHeld] = useState<readonly StoredRecord[]>([]);
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Readonly<Record<string, ResolveVerdict>>>({});
  const [touched, setTouched] = useState<Readonly<Record<string, boolean>>>({});

  const reload = useCallback(async (): Promise<void> => {
    if (runtime === null) return;
    setHeld((await runtime.ledger.list()).filter((r) => r.envelope.kind === PHYSICAL_KIND && HELD.has(r.state)));
  }, [runtime]);
  useEffect(() => { void reload(); }, [reload]);

  const allowed = session?.permissions.includes('field.conflict.resolve') ?? false;
  if (!allowed) {
    return (
      <StationPage title={t('field_ops.conflicts.title')}>
        <SectionMessage appearance="warning" title={t('field_ops.conflicts.no_permission_title')} headingLevel="h2" testId="conflicts-no-permission"><Text as="p">{t('field_ops.conflicts.no_permission_body')}</Text></SectionMessage>
      </StationPage>
    );
  }

  const resolve = async (record: StoredRecord): Promise<void> => {
    const id = record.envelope.recordId;
    setTouched({ ...touched, [id]: true });
    const resolution = (reasons[id] ?? '').trim();
    const applicationId = record.envelope.subject.applicationId;
    if (!validateResolution(resolution).ok || runtime === null || applicationId === undefined || record.scoreId === undefined) return;
    setBusy(id);
    try {
      const verdict = readResolveAnswer(await resolveFieldSyncConflict(client, { applicationId, scoreId: record.scoreId, resolution }));
      setVerdicts({ ...verdicts, [id]: verdict });
      if (verdict === 'RESOLVED') {
        if (record.state === 'STALE_CONFLICT') await runtime.ledger.apply(id, { type: 'ESCALATE' });
        await runtime.ledger.apply(id, { type: 'RESOLVED' });
        await reload();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <StationPage title={t('field_ops.conflicts.title')} intro={t('field_ops.conflicts.intro')} testId="conflicts-page">
      {held.length === 0 ? (
        <Text color="color.text.subtle" testId="conflicts-none">{t('field_ops.conflicts.none')}</Text>
      ) : held.map((record) => {
        const id = record.envelope.recordId;
        const metrics = (record.envelope.payload as Partial<PhysicalPayload> | null)?.metrics;
        const resolution = reasons[id] ?? '';
        const problem = touched[id] === true && !validateResolution(resolution).ok;
        const verdict = verdicts[id];
        return (
          <Box key={id} xcss={box.b} testId={`conflict-${id}`}>
            <Stack space="space.200">
              <Inline spread="space-between" alignBlock="center" shouldWrap>
                <Heading size="small" as="h2">{t('field_ops.conflicts.record', { n: record.envelope.localSequence })}</Heading>
                <RecordFateLozenge state={record.state} />
              </Inline>
              <Text color="color.text.subtle">{t('field_ops.conflicts.local_record', { time: record.envelope.capturedAt.slice(0, 16).replace('T', ' ') })}</Text>
              {metrics !== undefined && (
                <Text testId={`conflict-metrics-${id}`}>{t('field_ops.conflicts.metrics', { height: metrics.heightCm, weight: metrics.weightKg, chest: metrics.chestCm, run: metrics.run3kmTimeSeconds })}</Text>
              )}
              <Text color="color.text.subtle">{t('field_ops.conflicts.server_holds')}</Text>
              {record.scoreId === undefined ? (
                <SectionMessage appearance="warning" title={t('field_ops.conflicts.no_score_title')} headingLevel="h3"><Text as="p">{t('field_ops.conflicts.no_score_body')}</Text></SectionMessage>
              ) : (
                <Stack space="space.100">
                  <Label htmlFor={`res-${id}`}>{t('field_ops.conflicts.reason_label')}</Label>
                  <TextField id={`res-${id}`} value={resolution} autoComplete="off" isInvalid={problem} onChange={(e) => { setReasons({ ...reasons, [id]: e.currentTarget.value }); }} />
                  {problem ? <ErrorMessage>{t('field_ops.conflicts.reason_required', { max: RESOLUTION_MAX_LENGTH })}</ErrorMessage> : <HelperMessage>{t('field_ops.conflicts.reason_help', { max: RESOLUTION_MAX_LENGTH })}</HelperMessage>}
                  {verdict !== undefined && verdict !== 'RESOLVED' && (
                    <SectionMessage appearance="error" title={t('field_ops.conflicts.failed_title')} headingLevel="h3" testId={`conflict-failed-${id}`}><Text as="p">{t(`field_ops.conflicts.verdict.${verdict}`)}</Text></SectionMessage>
                  )}
                  <Box><LoadingButton appearance="primary" isLoading={busy === id} onClick={() => { void resolve(record); }} testId={`conflict-resolve-${id}`}>{t('field_ops.conflicts.resolve')}</LoadingButton></Box>
                </Stack>
              )}
            </Stack>
          </Box>
        );
      })}
    </StationPage>
  );
}
