import React from 'react';
import Button, { LinkButton } from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import Heading from '@atlaskit/heading';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { httpStatusOf, useAgencyCampaigns, type ApiClient, type CampaignStatus } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { FreshnessStamp, StateBoundary, listState } from '@usrp/ui';
import { CAMPAIGN_STATES } from '../model/lifecycle.ts';
import { formatKigali } from '../model/kigali.ts';
import { CampaignStatusLozenge } from './CampaignStatusLozenge.tsx';
import { Field, useCampaignPermissions, type Opt, Page } from './shared.tsx';

export function CampaignListPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const perms = useCampaignPermissions();
  const [text, setText] = React.useState('');
  const [statuses, setStatuses] = React.useState<readonly CampaignStatus[]>([]);
  const q = useAgencyCampaigns(client, { ...(text.trim() === '' ? {} : { q: text.trim() }), ...(statuses.length === 0 ? {} : { status: statuses }), limit: 50 }, perms.read);
  const rows = q.data?.campaigns ?? [];
  const filtersActive = text.trim() !== '' || statuses.length > 0;
  const state = !perms.read ? 'forbidden' : listState({ isLoading: q.isLoading, errorStatus: q.isError ? httpStatusOf(q.error) : null, rowCount: rows.length, filtersActive });
  const options: Opt[] = CAMPAIGN_STATES.map((s) => ({ value: s, label: t(`campaigns.states.${s}`) }));

  const head = { cells: [
    { key: 'label', content: t('campaigns.list.cols.label') },
    { key: 'status', content: t('campaigns.list.cols.status') },
    { key: 'registration', content: t('campaigns.list.cols.registration') },
    { key: 'exam', content: t('campaigns.list.cols.exam') },
    { key: 'sessions', content: t('campaigns.list.cols.sessions') },
    { key: 'registered', content: t('campaigns.list.cols.registered') },
    { key: 'open', content: t('campaigns.list.cols.open') },
  ] };
  const tableRows = rows.map((c) => ({
    key: c.publicCode,
    cells: [
      { key: 'label', content: <Stack space="space.0"><Text weight="medium">{c.campaignLabel}</Text><Text size="small" color="color.text.subtle">{c.publicCode}</Text></Stack> },
      { key: 'status', content: <CampaignStatusLozenge state={c.status} /> },
      { key: 'registration', content: <Text size="small">{formatKigali(c.registrationOpensAt)} → {formatKigali(c.registrationClosesAt)}</Text> },
      { key: 'exam', content: <Text size="small">{c.examinationStartDate} → {c.examinationEndDate}</Text> },
      { key: 'sessions', content: <Text size="small">{t('campaigns.list.sessionsOf', { sessions: c.occupancy.sessionCount, districts: c.targetDistricts.length })}</Text> },
      { key: 'registered', content: <Text size="small">{c.occupancy.registeredTotal}</Text> },
      { key: 'open', content: <LinkButton href={`/campaigns/${encodeURIComponent(c.publicCode)}`} aria-label={`${t('campaigns.list.open')}: ${c.publicCode}`}>{t('campaigns.list.open')}</LinkButton> },
    ],
  }));

  return (
    <Page>
      <Stack space="space.250">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="xlarge" as="h1">{t('campaigns.list.title')}</Heading>
          <Inline space="space.200" alignBlock="center" shouldWrap>
            {q.dataUpdatedAt > 0 && <FreshnessStamp updatedAt={new Date(q.dataUpdatedAt).toISOString()} />}
            {perms.create && <LinkButton appearance="primary" href="/campaigns/new">{t('campaigns.list.new')}</LinkButton>}
          </Inline>
        </Inline>
        <Text as="p">{t('campaigns.list.lead', { agency: perms.agency })}</Text>
        {perms.read && (
          <Inline space="space.200" shouldWrap alignBlock="end">
            <Field label={t('campaigns.list.search')}>
              <Textfield name="q" aria-label={t('campaigns.list.search')} value={text} onChange={(e) => setText((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label={t('campaigns.list.statusFilter')}>
              <Select<Opt, true>
                isMulti inputId="status-filter" aria-label={t('campaigns.list.statusFilter')} options={options}
                value={options.filter((o) => statuses.includes(o.value as CampaignStatus))}
                onChange={(sel) => setStatuses(sel.map((o) => o.value as CampaignStatus))}
                placeholder={t('campaigns.list.allStates')}
              />
            </Field>
          </Inline>
        )}
        <StateBoundary
          state={state} onRetry={() => void q.refetch()} onClearFilters={() => { setText(''); setStatuses([]); }}
          copy={{ empty: { title: t('campaigns.list.empty.title'), body: t('campaigns.list.empty.body') } }}
        >
          <div data-testid="campaign-table"><DynamicTable caption={t('campaigns.list.title')} head={head} rows={tableRows} /></div>
          {q.data !== undefined && q.data.nextCursor !== null && <Text size="small" color="color.text.subtle" testId="campaign-more">{t('campaigns.list.more', { shown: rows.length, total: q.data.total })}</Text>}
        </StateBoundary>
      </Stack>
    </Page>
  );
}
