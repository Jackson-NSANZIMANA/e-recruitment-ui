import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import {
  ApiError,
  httpStatusOf,
  useAcceptApplication,
  useAdjudicateApplication,
  useAmberQueue,
  useRecordFinalDecision,
  useSearchApplications,
  type ApiClient,
  type ApplicationSearchRow,
} from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import type { Agency } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { ConfirmAction, QueueTable, StateBoundary, listState, type QueueRow } from '@usrp/ui';
import { useNavigate } from 'react-router-dom';
import { byQueueAge, holdKindOf, type AmberRow, type AmberStatus } from '../model/amber.js';
import { QUEUE_STATUSES, rowTransitions, runBulk, visibleQueues, type BulkResult, type QueueId, type RowTransition } from '../model/queues.js';
import { ForensicsSignal } from './ForensicsSignal.js';

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
  panel: { padding: token('space.300') },
});

type T = ReturnType<typeof useTranslation>['t'];

const label = (t: T, tr: RowTransition): string => t(`adjudication.row.${tr}`);
const appearanceOf = (tr: RowTransition): 'primary' | 'danger' | 'default' => (tr === 'reject' ? 'danger' : tr === 'open' || tr === 'verdict' ? 'default' : 'primary');

function refusalCode(error: unknown): string {
  if (error instanceof ApiError) {
    const n = error.normalised;
    if (n.kind === 'conflict' || n.kind === 'unprocessable') return n.outcome;
    return n.kind.toUpperCase();
  }
  return 'ERROR';
}

interface Pending {
  readonly id: string;
  readonly code: string;
  readonly action: 'clear' | 'reject' | 'shortlist' | 'accept';
}

function amberRows(rows: readonly AmberRow[], kind: 'DOCUMENT' | 'ADJUDICATION', permissions: readonly string[], t: T): QueueRow[] {
  return rows
    .filter((r) => holdKindOf(r) === kind)
    .sort(byQueueAge)
    .map((r) => ({
      id: r.applicationId,
      primary: r.processingCode,
      ...(r.documentType !== null ? { secondary: r.documentType } : {}),
      detail: <ForensicsSignal row={r} />,
      status: t(kind === 'DOCUMENT' ? 'adjudication.queue.status.document' : 'adjudication.queue.status.adjudication'),
      since: r.queuedAt ?? '',
      transitions: rowTransitions(kind === 'DOCUMENT' ? 'amber' : 'holds', r.status, permissions).map((tr) => ({ id: tr, label: label(t, tr), appearance: appearanceOf(tr) })),
    }));
}

function AmberQueue({ client, agency, kind, permissions }: { readonly client: ApiClient; readonly agency: Agency; readonly kind: 'DOCUMENT' | 'ADJUDICATION'; readonly permissions: readonly string[] }): React.ReactElement {
  const { t } = useTranslation('adjudication');
  const navigate = useNavigate();
  const q = useAmberQueue(client, agency);
  const adjudicate = useAdjudicateApplication(client, agency);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const all = (q.data ?? []).filter((e): e is typeof e & { applicationId: string; processingCode: string; status: AmberStatus } => e.applicationId !== null && e.processingCode !== null && (e.status === 'DOCUMENT_REVIEW_AMBER' || e.status === 'ADJUDICATION_REVIEW'));
  const rows = all.map<AmberRow>((e) => ({
    applicationId: e.applicationId, processingCode: e.processingCode, status: e.status,
    documentType: e.documentType as AmberRow['documentType'], forensicsScore: e.forensicsScore,
    forensicsFlags: e.forensicsFlags as AmberRow['forensicsFlags'], queuedAt: e.queuedAt,
  }));
  const shown = amberRows(rows, kind, permissions, t);
  const state = listState({ isLoading: q.isLoading, errorStatus: q.isError ? httpStatusOf(q.error) : null, rowCount: shown.length, filtersActive: false });
  const run = async (): Promise<void> => {
    if (pending === null) return;
    try {
      await adjudicate.mutateAsync({ applicationId: pending.id, decision: pending.action === 'clear' ? 'CLEAR' : 'REJECT' });
      setPending(null);
    } catch { /* shown in the dialog */ }
  };
  return (
    <Stack space="space.200">
      <SectionMessage appearance="information"><Text as="p">{t(kind === 'DOCUMENT' ? 'adjudication.queue.document_hint' : 'adjudication.queue.adjudication_hint')}</Text></SectionMessage>
      <StateBoundary state={state} onRetry={() => void q.refetch()}>
        <QueueTable
          caption={t(kind === 'DOCUMENT' ? 'adjudication.tabs.amber' : 'adjudication.tabs.holds')}
          rows={shown}
          testId={kind === 'DOCUMENT' ? 'queue-amber' : 'queue-holds'}
          onOpen={(id) => navigate(`/applications/${id}`)}
          onTransition={(id, tr) => {
            if (tr === 'open') navigate(`/applications/${id}`);
            else if (tr === 'clear' || tr === 'reject') setPending({ id, code: shown.find((r) => r.id === id)?.primary ?? id, action: tr });
          }}
        />
      </StateBoundary>
      <ConfirmAction
        isOpen={pending !== null}
        isPending={adjudicate.isPending}
        appearance={pending?.action === 'reject' ? 'danger' : 'primary'}
        title={pending?.action === 'reject' ? t('adjudication.confirm.rejectTitle', { code: pending?.code ?? '' }) : t('adjudication.confirm.clearTitle', { code: pending?.code ?? '' })}
        body={pending?.action === 'reject' ? t('adjudication.confirm.rejectBody') : t('adjudication.confirm.clearBody')}
        confirmLabel={pending?.action === 'reject' ? t('adjudication.row.reject') : t('adjudication.row.clear')}
        onCancel={() => { setPending(null); adjudicate.reset(); }}
        onConfirm={() => void run()}
      >
        {adjudicate.isError && <SectionMessage appearance="error"><Text as="p">{t('adjudication.errors.refused', { code: refusalCode(adjudicate.error) })}</Text></SectionMessage>}
      </ConfirmAction>
    </Stack>
  );
}

function searchRows(rows: readonly ApplicationSearchRow[], queue: QueueId, permissions: readonly string[], t: T, statusLabel: (s: string) => string): QueueRow[] {
  return rows.map((a) => ({
    id: a.applicationId,
    primary: a.processingCode,
    secondary: a.category,
    status: statusLabel(a.status),
    since: a.submittedAt ?? '',
    transitions: rowTransitions(queue, a.status, permissions).map((tr) => ({ id: tr, label: label(t, tr), appearance: appearanceOf(tr) })),
  }));
}

function SearchQueue({ client, agency, queue, permissions }: { readonly client: ApiClient; readonly agency: Agency; readonly queue: 'medical' | 'final'; readonly permissions: readonly string[] }): React.ReactElement {
  const { t } = useTranslation('adjudication');
  const navigate = useNavigate();
  const q = useSearchApplications(client, { status: QUEUE_STATUSES[queue], limit: 100 });
  const finalDecision = useRecordFinalDecision(client, agency);
  const accept = useAcceptApplication(client, agency);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [bulk, setBulk] = React.useState<{ action: 'shortlist' | 'reject' } | null>(null);
  const [results, setResults] = React.useState<readonly (BulkResult & { readonly code: string; readonly label: string })[]>([]);
  const [running, setRunning] = React.useState(false);
  const statusLabel = (s: string): string => t(`adjudication.status.${s}`, { defaultValue: s });
  const apps = q.data?.applications ?? [];
  const rows = searchRows(apps, queue, permissions, t, statusLabel);
  const state = listState({ isLoading: q.isLoading, errorStatus: q.isError ? httpStatusOf(q.error) : null, rowCount: rows.length, filtersActive: false });
  const mutation = pending?.action === 'accept' ? accept : finalDecision;

  const run = async (): Promise<void> => {
    if (pending === null) return;
    try {
      if (pending.action === 'accept') await accept.mutateAsync({ applicationId: pending.id });
      else await finalDecision.mutateAsync({ applicationId: pending.id, decision: pending.action === 'shortlist' ? 'SHORTLIST' : 'REJECT' });
      setPending(null);
    } catch { /* shown in the dialog */ }
  };

  const runAll = async (): Promise<void> => {
    if (bulk === null) return;
    const targets = apps.filter((a) => a.status === 'MEDICAL_REVIEW');
    setRunning(true);
    setResults([]);
    await runBulk(
      targets.map((a) => a.applicationId),
      async (id) => {
        try {
          await finalDecision.mutateAsync({ applicationId: id, decision: bulk.action === 'shortlist' ? 'SHORTLIST' : 'REJECT' });
          return { ok: true, code: 'APPLIED' };
        } catch (e) {
          return { ok: false, code: refusalCode(e) };
        }
      },
      (r) => setResults((prev) => [...prev, { ...r, label: targets.find((a) => a.applicationId === r.id)?.processingCode ?? r.id }]),
    );
    setRunning(false);
    setBulk(null);
  };

  const canBulk = queue === 'final' && permissions.includes('decision.final') && apps.some((a) => a.status === 'MEDICAL_REVIEW');
  return (
    <Stack space="space.200">
      {q.data !== undefined && q.data.total > apps.length && (
        <SectionMessage appearance="warning" testId="queue-truncated"><Text as="p">{t('adjudication.queue.truncated', { shown: apps.length, total: q.data.total })}</Text></SectionMessage>
      )}
      {canBulk && (
        <Inline space="space.100" shouldWrap alignBlock="center">
          <Button appearance="primary" isDisabled={running} onClick={() => setBulk({ action: 'shortlist' })}>{t('adjudication.bulk.shortlistAll')}</Button>
          <Button appearance="danger" isDisabled={running} onClick={() => setBulk({ action: 'reject' })}>{t('adjudication.bulk.rejectAll')}</Button>
        </Inline>
      )}
      {results.length > 0 && (
        <Stack space="space.050" testId="bulk-results">
          <Text weight="medium">{t('adjudication.bulk.resultsTitle')}</Text>
          {results.map((r) => (
            <Text key={r.id} color={r.ok ? 'color.text.success' : 'color.text.danger'}>{`${r.label}: ${r.ok ? t('adjudication.bulk.applied') : t('adjudication.bulk.refused', { code: r.code })}`}</Text>
          ))}
        </Stack>
      )}
      <StateBoundary state={state} onRetry={() => void q.refetch()}>
        <QueueTable
          caption={t(queue === 'medical' ? 'adjudication.tabs.medical' : 'adjudication.tabs.final')}
          rows={rows}
          testId={queue === 'medical' ? 'queue-medical' : 'queue-final'}
          onOpen={(id) => navigate(`/applications/${id}`)}
          onTransition={(id, tr) => {
            if (tr === 'open' || tr === 'verdict') navigate(`/applications/${id}`);
            else if (tr === 'shortlist' || tr === 'reject' || tr === 'accept') setPending({ id, code: rows.find((r) => r.id === id)?.primary ?? id, action: tr });
          }}
        />
      </StateBoundary>
      <ConfirmAction
        isOpen={pending !== null}
        isPending={mutation.isPending}
        appearance={pending?.action === 'reject' ? 'danger' : 'primary'}
        title={t(`adjudication.confirm.${pending?.action ?? 'shortlist'}Title`, { code: pending?.code ?? '' })}
        body={t(`adjudication.confirm.${pending?.action ?? 'shortlist'}Body`)}
        confirmLabel={label(t, pending?.action ?? 'shortlist')}
        onCancel={() => { setPending(null); finalDecision.reset(); accept.reset(); }}
        onConfirm={() => void run()}
      >
        {mutation.isError && <SectionMessage appearance="error"><Text as="p">{t('adjudication.errors.refused', { code: refusalCode(mutation.error) })}</Text></SectionMessage>}
      </ConfirmAction>
      <ConfirmAction
        isOpen={bulk !== null}
        isPending={running}
        appearance={bulk?.action === 'reject' ? 'danger' : 'primary'}
        title={t(bulk?.action === 'reject' ? 'adjudication.bulk.confirmRejectTitle' : 'adjudication.bulk.confirmShortlistTitle')}
        body={t('adjudication.bulk.confirmBody', { count: apps.filter((a) => a.status === 'MEDICAL_REVIEW').length })}
        consequences={[t('adjudication.bulk.oneByOne'), apps.filter((a) => a.status === 'MEDICAL_REVIEW').map((a) => a.processingCode).join(', ')]}
        confirmLabel={t(bulk?.action === 'reject' ? 'adjudication.row.reject' : 'adjudication.row.shortlist')}
        onCancel={() => setBulk(null)}
        onConfirm={() => void runAll()}
      />
    </Stack>
  );
}

export interface QueuesPageProps {
  readonly client: ApiClient;
  readonly initial?: QueueId;
}

export function QueuesPage({ client, initial = 'amber' }: QueuesPageProps): React.ReactElement {
  const { t } = useTranslation('adjudication');
  const session = useOfficerSession();
  const permissions = session?.permissions ?? [];
  const agency: Agency = session?.agency ?? 'RDF';
  const visible = visibleQueues(permissions);
  if (visible.length === 0) return <Box xcss={styles.root}><StateBoundary state="forbidden"><span /></StateBoundary></Box>;
  const selected = Math.max(0, visible.indexOf(initial));
  return (
    <Box xcss={styles.root}>
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="xlarge" as="h1">{t('adjudication.queue.title')}</Heading>
        </Inline>
        <Tabs id="officer-queues" defaultSelected={selected}>
          <TabList>
            {visible.map((id) => <Tab key={id}>{t(`adjudication.tabs.${id}`)}</Tab>)}
          </TabList>
          {visible.map((id) => (
            <TabPanel key={id}>
              <Box xcss={styles.panel}>
                {id === 'amber' && <AmberQueue client={client} agency={agency} kind="DOCUMENT" permissions={permissions} />}
                {id === 'holds' && <AmberQueue client={client} agency={agency} kind="ADJUDICATION" permissions={permissions} />}
                {(id === 'medical' || id === 'final') && <SearchQueue client={client} agency={agency} queue={id} permissions={permissions} />}
              </Box>
            </TabPanel>
          ))}
        </Tabs>
      </Stack>
    </Box>
  );
}


