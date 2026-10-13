import React from 'react';
import Button from '@atlaskit/button';
import DynamicTable from '@atlaskit/dynamic-table';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import TextField from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { ApiError, useApplicationList, type ApiClient } from '@usrp/api-client';
import { APPLICATION_STATUSES } from '@usrp/contracts';
import type { Agency, ApplicationStatus } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { needsOfficer, phaseOf } from '../model/status.js';
import { StatusLozenge } from './StatusLozenge.js';

const STATUS_SET: ReadonlySet<string> = new Set(APPLICATION_STATUSES);
function isApplicationStatus(s: string | null): s is ApplicationStatus {
  return s !== null && STATUS_SET.has(s);
}

const styles = cssMap({
  root: {
    maxWidth: '1200px',
    marginInline: 'auto',
    paddingBlock: token('space.300'),
    paddingInline: token('space.400'),
  },
  toolbar: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.neutral'),
  },
  search: { minWidth: '280px', maxWidth: '420px' },
  stat: {
    minWidth: '150px',
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.neutral'),
  },
});

type FilterMode = 'all' | 'action' | 'closed';

function formatDate(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function friendlyError(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    switch (error.normalised.kind) {
      case 'unauthenticated': return t('applications.errors.session');
      case 'forbidden': return t('applications.errors.forbidden');
      case 'network': return t('applications.errors.network');
      case 'g2gUnavailable': return t('applications.errors.upstream');
      case 'notFound': return t('applications.errors.notFound');
      default: return t('applications.errors.generic');
    }
  }
  return t('applications.errors.generic');
}

export interface ApplicationsPageProps {
  readonly client: ApiClient;
  readonly agency: Agency;
}

export function ApplicationsPage({ client, agency }: ApplicationsPageProps): React.ReactElement {
  const { t } = useTranslation('applications');
  const query = useApplicationList(client, agency);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<FilterMode>('all');

  const rows = React.useMemo(() => query.data ?? [], [query.data]);
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'action' && !isApplicationStatus(row.status)) return false;
      if (filter === 'action' && !needsOfficer(row.status as ApplicationStatus)) return false;
      if (filter === 'closed' && !isApplicationStatus(row.status)) return false;
      if (filter === 'closed' && phaseOf(row.status as ApplicationStatus) !== 'CLOSED') return false;
      if (needle.length === 0) return true;
      return [row.processingCode, row.applicationId, row.category ?? '', row.status]
        .some((value) => value !== null && value.toLowerCase().includes(needle));
    });
  }, [rows, search, filter]);

  const actionCount = rows.filter((row) => isApplicationStatus(row.status) && needsOfficer(row.status)).length;
  const closedCount = rows.filter((row) => isApplicationStatus(row.status) && phaseOf(row.status) === 'CLOSED').length;
  const activeCount = rows.length - closedCount;

  if (query.isLoading) {
    return <Box xcss={styles.root}><Spinner size="large" label={t('applications.loading')} /></Box>;
  }

  if (query.isError) {
    return (
      <Box xcss={styles.root}>
        <SectionMessage appearance="error" title={t('applications.errors.title')} headingLevel="h2">
          <Stack space="space.200">
            <Text as="p">{friendlyError(query.error, t)}</Text>
            <Box><Button appearance="default" onClick={() => void query.refetch()}>{t('applications.actions.retry')}</Button></Box>
          </Stack>
        </SectionMessage>
      </Box>
    );
  }

  const head = {
    cells: [
      { key: 'processingCode', content: t('applications.table.processingCode') },
      { key: 'category', content: t('applications.table.category') },
      { key: 'status', content: t('applications.table.status') },
      { key: 'submittedAt', content: t('applications.table.submittedAt') },
      { key: 'action', content: '' },
    ],
  };

  const tableRows = filtered.map((row, index) => ({
    key: row.applicationId ?? row.processingCode ?? `row-${index}`,
    cells: [
      { key: 'processingCode', content: <Text weight="medium">{row.processingCode}</Text> },
      { key: 'category', content: row.category ?? '—' },
      { key: 'status', content: isApplicationStatus(row.status) ? <StatusLozenge status={row.status} /> : row.status ?? '—' },
      { key: 'submittedAt', content: formatDate(row.submittedAt) },
      { key: 'action', content: <Button appearance="subtle" href={`/applications/${row.applicationId}`}>{t('applications.actions.open')}</Button> },
    ],
  }));

  return (
    <Box xcss={styles.root}>
      <Stack space="space.300">
        <Stack space="space.050">
          <Heading size="xlarge" as="h1">{t('applications.list.title')}</Heading>
          <Text color="color.text.subtle">{t('applications.list.subtitle', { agency })}</Text>
        </Stack>

        <Inline space="space.150" shouldWrap>
          <Box xcss={styles.stat}><Stack space="space.050"><Text size="small" color="color.text.subtle">{t('applications.metrics.total')}</Text><Heading size="large">{rows.length}</Heading></Stack></Box>
          <Box xcss={styles.stat}><Stack space="space.050"><Text size="small" color="color.text.subtle">{t('applications.metrics.action')}</Text><Heading size="large">{actionCount}</Heading></Stack></Box>
          <Box xcss={styles.stat}><Stack space="space.050"><Text size="small" color="color.text.subtle">{t('applications.metrics.active')}</Text><Heading size="large">{activeCount}</Heading></Stack></Box>
          <Box xcss={styles.stat}><Stack space="space.050"><Text size="small" color="color.text.subtle">{t('applications.metrics.closed')}</Text><Heading size="large">{closedCount}</Heading></Stack></Box>
        </Inline>

        <Box xcss={styles.toolbar}>
          <Inline space="space.150" alignBlock="center" shouldWrap>
            <Box xcss={styles.search}>
              <TextField
                value={search}
                onChange={(event) => setSearch((event.target as HTMLInputElement).value)}
                placeholder={t('applications.list.searchPlaceholder')}
                aria-label={t('applications.list.searchLabel')}
              />
            </Box>
            <Inline space="space.050">
              <Button appearance={filter === 'all' ? 'primary' : 'subtle'} onClick={() => setFilter('all')}>{t('applications.filters.all')}</Button>
              <Button appearance={filter === 'action' ? 'primary' : 'subtle'} onClick={() => setFilter('action')}>{t('applications.filters.action')}</Button>
              <Button appearance={filter === 'closed' ? 'primary' : 'subtle'} onClick={() => setFilter('closed')}>{t('applications.filters.closed')}</Button>
            </Inline>
          </Inline>
        </Box>

        {filtered.length === 0 ? (
          <SectionMessage appearance="information" headingLevel="h2" title={rows.length === 0 ? t('applications.empty.title') : t('applications.empty.filteredTitle')}>
            {rows.length === 0 ? t('applications.empty.body') : t('applications.empty.filteredBody')}
          </SectionMessage>
        ) : (
          <DynamicTable head={head} rows={tableRows} />
        )}
      </Stack>
    </Box>
  );
}
