import React from 'react';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { ApiError, httpStatusOf, useDecideErasure, useErasureQueue, type ApiClient } from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { ConfirmAction, FreshnessStamp, QueueTable, StateBoundary, listState, type QueueRow } from '@usrp/ui';
import { ERASURE_PERMISSIONS, refusalReasonKey, type RefusalGround } from '../model/erasure.ts';
import { DeclineGroundsDialog } from './DeclineGroundsDialog.tsx';

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
});

type T = ReturnType<typeof useTranslation>['t'];

/** The refusal in words: the two retention refusals have their own copy, a stale request says so. */
function failureText(error: unknown, t: T): string {
  if (error instanceof ApiError) {
    const n = error.normalised;
    if (n.kind === 'conflict') {
      if (n.outcome === 'REFUSED_ACTIVE_APPLICATION' || n.outcome === 'REFUSED_ACCEPT_LOCKED') return t(refusalReasonKey(n.outcome as RefusalGround));
      if (n.outcome === 'NOT_PENDING') return t('compliance.errors.notPending');
      return t('compliance.errors.refused', { code: n.outcome });
    }
    if (n.kind === 'notFound') return t('compliance.errors.notFound');
    if (n.kind === 'badRequest') return t('compliance.errors.groundsRequired');
  }
  return t('compliance.errors.generic');
}

/** The DPO's queue (ADR-020): request id and age only, decline with written grounds, erase with consequences. */
export function DpoQueuePage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('compliance');
  const session = useOfficerSession();
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes(ERASURE_PERMISSIONS.read);
  const canDecide = permissions.includes(ERASURE_PERMISSIONS.decide);
  const q = useErasureQueue(client, canRead);
  const decide = useDecideErasure(client);
  const [declining, setDeclining] = React.useState<string | null>(null);
  const [erasing, setErasing] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const requests = q.data?.requests ?? [];
  const state = !canRead ? 'forbidden' : listState({ isLoading: q.isLoading, errorStatus: q.isError ? httpStatusOf(q.error) : null, rowCount: requests.length, filtersActive: false });
  const rows: QueueRow[] = requests.map((r) => ({
    id: r.requestId,
    primary: r.requestId.slice(0, 8),
    status: t('compliance.queue.status'),
    since: r.requestedAt,
    transitions: canDecide ? [{ id: 'decline', label: t('compliance.row.decline') }, { id: 'execute', label: t('compliance.row.execute'), appearance: 'danger' }] : [],
  }));

  const close = (): void => { setDeclining(null); setErasing(null); decide.reset(); };
  const submitDecline = async (note: string): Promise<void> => {
    if (declining === null) return;
    try {
      await decide.mutateAsync({ requestId: declining, decision: 'DECLINE', grounds: note });
      setDone(t('compliance.done.DECLINED'));
      close();
    } catch { /* shown in the dialog */ }
  };
  const submitErase = async (): Promise<void> => {
    if (erasing === null) return;
    try {
      await decide.mutateAsync({ requestId: erasing, decision: 'EXECUTE' });
      setDone(t('compliance.done.EXECUTED'));
      close();
    } catch { /* shown in the dialog */ }
  };

  return (
    <Box xcss={styles.root}>
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="xlarge" as="h1">{t('compliance.queue.title')}</Heading>
          {q.dataUpdatedAt > 0 && <FreshnessStamp updatedAt={new Date(q.dataUpdatedAt).toISOString()} />}
        </Inline>
        <Text as="p">{t('compliance.queue.lead')}</Text>
        <Text as="p" color="color.text.subtle">{t('compliance.queue.anonymous_by_design')}</Text>
        {done !== null && <SectionMessage appearance="success" testId="dpo-done"><Text as="p">{done}</Text></SectionMessage>}
        <StateBoundary state={state} onRetry={() => void q.refetch()}>
          <QueueTable
            caption={t('compliance.queue.title')}
            rows={rows}
            testId="queue-erasure"
            onTransition={(id, tr) => {
              setDone(null);
              if (tr === 'decline') setDeclining(id);
              else if (tr === 'execute') setErasing(id);
            }}
          />
        </StateBoundary>
        {declining !== null && (
          <>
            <DeclineGroundsDialog onCancel={close} onConfirm={(note) => void submitDecline(note)} />
            {decide.isError && <SectionMessage appearance="error" testId="dpo-error"><Text as="p">{failureText(decide.error, t)}</Text></SectionMessage>}
          </>
        )}
        <ConfirmAction
          isOpen={erasing !== null}
          isPending={decide.isPending}
          appearance="danger"
          title={t('compliance.execute.title')}
          body={t('compliance.execute.body')}
          consequences={[t('compliance.execute.irreversible')]}
          confirmLabel={t('compliance.execute.confirm')}
          onCancel={close}
          onConfirm={() => void submitErase()}
        >
          {decide.isError && <SectionMessage appearance="error" testId="dpo-error"><Text as="p">{failureText(decide.error, t)}</Text></SectionMessage>}
        </ConfirmAction>
      </Stack>
    </Box>
  );
}
