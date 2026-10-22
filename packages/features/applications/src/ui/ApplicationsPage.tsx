import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Select from '@atlaskit/select';
import TextField from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { httpStatusOf, searchApplications, useSearchApplications, type ApiClient, type ApplicationSearchRow } from '@usrp/api-client';
import type { Agency, ApplicationStatus } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { FreshnessStamp, QueueTable, StateBoundary, listState, type QueueRow } from '@usrp/ui';
import { useNavigate } from 'react-router-dom';
import { APPLICATION_STATUSES } from '@usrp/contracts';
import { EMPTY_FILTERS, filtersActive, searchQueryOf, type ListFilters } from '../model/workspace.js';
import { statusLabelKey } from '../model/status.js';

const STATUS_SET: ReadonlySet<string> = new Set(APPLICATION_STATUSES);

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
  filters: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
  },
  field: { minWidth: '200px' },
});

export interface ApplicationsPageProps {
  readonly client: ApiClient;
  readonly agency: Agency;
}

const PRESETS: readonly ListFilters['preset'][] = ['all', 'needs-officer', 'medical', 'final'];

/**
 * The agency's applications on S04's keyset search. A cursor page is appended to
 * what is shown; the total is the server's. Filters reset the pages.
 */
export function ApplicationsPage({ client, agency }: ApplicationsPageProps): React.ReactElement {
  const { t } = useTranslation('applications');
  const navigate = useNavigate();
  const [filters, setFilters] = React.useState<ListFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = React.useState<ListFilters>(EMPTY_FILTERS);
  // Page one is the query; "load more" appends further cursor pages imperatively.
  const [more, setMore] = React.useState<{ rows: readonly ApplicationSearchRow[]; cursor: string | null } | null>(null);
  const [moreBusy, setMoreBusy] = React.useState(false);
  const [moreFailed, setMoreFailed] = React.useState(false);
  const query = useSearchApplications(client, searchQueryOf(filters));
  const pages: readonly ApplicationSearchRow[] = [...(query.data?.applications ?? []), ...(more?.rows ?? [])];
  const nextCursor = more !== null ? more.cursor : (query.data?.nextCursor ?? null);

  const apply = (next: ListFilters): void => {
    setMore(null);
    setMoreFailed(false);
    setFilters(next);
  };
  const loadMore = async (): Promise<void> => {
    if (nextCursor === null) return;
    setMoreBusy(true);
    setMoreFailed(false);
    try {
      const page = await searchApplications(client, searchQueryOf(filters, nextCursor));
      setMore({ rows: [...(more?.rows ?? []), ...page.applications], cursor: page.nextCursor });
    } catch {
      setMoreFailed(true);
    } finally {
      setMoreBusy(false);
    }
  };

  const state = listState({
    isLoading: query.isLoading,
    errorStatus: query.isError ? httpStatusOf(query.error) : null,
    rowCount: pages.length,
    filtersActive: filtersActive(filters),
  });
  const now = new Date();
  const rows: QueueRow[] = pages.map((a) => ({
    id: a.applicationId,
    primary: a.processingCode,
    secondary: a.category,
    status: STATUS_SET.has(a.status) ? t(statusLabelKey(a.status as ApplicationStatus)) : a.status,
    since: a.submittedAt ?? '',
    transitions: [{ id: 'open', label: t('applications.actions.open') }],
  }));

  return (
    <Box xcss={styles.root}>
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Stack space="space.050">
            <Heading size="xlarge" as="h1">{t('applications.list.title')}</Heading>
            <Text color="color.text.subtle">{t('applications.list.subtitle', { agency })}</Text>
          </Stack>
          {query.dataUpdatedAt > 0 && <FreshnessStamp updatedAt={new Date(query.dataUpdatedAt).toISOString()} now={now} />}
        </Inline>

        <Box xcss={styles.filters}>
          <Inline space="space.200" shouldWrap alignBlock="end">
            <Box xcss={styles.field}>
              <Stack space="space.050">
                <Text size="small" weight="medium" as="span">{t('applications.filters.preset')}</Text>
                <Select
                  inputId="applications-preset"
                  aria-label={t('applications.filters.preset')}
                  options={PRESETS.map((p) => ({ value: p, label: t(`applications.filters.presets.${p}`) }))}
                  value={{ value: draft.preset, label: t(`applications.filters.presets.${draft.preset}`) }}
                  onChange={(o) => { if (o !== null) setDraft({ ...draft, preset: o.value }); }}
                />
              </Stack>
            </Box>
            {(['category', 'campaign', 'district'] as const).map((k) => (
              <Box xcss={styles.field} key={k}>
                <Stack space="space.050">
                  <Text size="small" weight="medium" as="span">{t(`applications.filters.${k}`)}</Text>
                  <TextField
                    name={k}
                    aria-label={t(`applications.filters.${k}`)}
                    value={draft[k]}
                    onChange={(e) => setDraft({ ...draft, [k]: (e.target as HTMLInputElement).value })}
                  />
                </Stack>
              </Box>
            ))}
            <Button appearance="primary" onClick={() => apply(draft)}>{t('applications.filters.apply')}</Button>
          </Inline>
        </Box>

        <StateBoundary
          state={state}
          onRetry={() => void query.refetch()}
          onClearFilters={() => { setDraft(EMPTY_FILTERS); apply(EMPTY_FILTERS); }}
        >
          <Stack space="space.150">
            <Text color="color.text.subtle" testId="applications-total">{t('applications.list.total', { shown: pages.length, total: query.data?.total ?? pages.length })}</Text>
            <QueueTable
              caption={t('applications.list.title')}
              rows={rows}
              now={now}
              onOpen={(id) => navigate(`/applications/${id}`)}
              onTransition={(id) => navigate(`/applications/${id}`)}
              testId="applications-table"
            />
            {nextCursor !== null && (
              <Inline space="space.100" alignBlock="center">
                <Button appearance="default" isDisabled={moreBusy} onClick={() => void loadMore()}>{t('applications.list.more')}</Button>
                {moreFailed && <Text color="color.text.danger">{t('applications.list.moreFailed')}</Text>}
              </Inline>
            )}
          </Stack>
        </StateBoundary>
      </Stack>
    </Box>
  );
}
