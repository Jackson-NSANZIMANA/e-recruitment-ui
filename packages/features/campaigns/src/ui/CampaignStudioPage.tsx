import React from 'react';
import Button, { LinkButton } from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { useParams } from 'react-router-dom';
import { httpStatusOf, useCampaignAdminDetail, type ApiClient, type CampaignAdminDetail } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { FreshnessStamp, StateBoundary } from '@usrp/ui';
import { formatKigali } from '../model/kigali.ts';
import { districtLabel } from '../model/geography.ts';
import type { CampaignState } from '../model/lifecycle.ts';
import type { StudioStep } from '../model/preflight.ts';
import { CampaignStatusLozenge } from './CampaignStatusLozenge.tsx';
import { LifecycleStep } from './LifecycleStep.tsx';
import { PolicyStep } from './PolicyStep.tsx';
import { PublishStep } from './PublishStep.tsx';
import { SessionsStep } from './SessionsStep.tsx';
import { useCampaignPermissions, Page, Panel, Cell } from './shared.tsx';

const STEPS = ['basics', 'policy', 'sessions', 'publish', 'lifecycle'] as const;

function Basics({ detail }: { readonly detail: CampaignAdminDetail }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const s = detail.summary;
  const rows: readonly (readonly [string, string])[] = [
    [t('campaigns.fields.publicCode'), s.publicCode],
    [t('campaigns.fields.campaignLabel'), s.campaignLabel],
    [t('campaigns.fields.targetCategories'), s.targetCategories.map((c) => t(`campaigns.categories.${c}`, { defaultValue: c })).join(', ')],
    [t('campaigns.fields.targetDistricts'), s.targetDistricts.map(districtLabel).join(', ')],
    [t('campaigns.fields.registrationOpensAt'), formatKigali(s.registrationOpensAt)],
    [t('campaigns.fields.registrationClosesAt'), formatKigali(s.registrationClosesAt)],
    [t('campaigns.fields.examinationStartDate'), s.examinationStartDate],
    [t('campaigns.fields.examinationEndDate'), s.examinationEndDate],
    [t('campaigns.fields.allowsWalkIn'), t(s.allowsWalkIn ? 'campaigns.yes' : 'campaigns.no')],
    [t('campaigns.fields.targetIntakeCount'), s.targetIntakeCount === null ? '—' : String(s.targetIntakeCount)],
    [t('campaigns.fields.contactPhoneNumbers'), (detail.contactPhoneNumbers ?? []).join(', ') || '—'],
    [t('campaigns.fields.contactWebsite'), detail.contactWebsite ?? '—'],
  ];
  return (
    <Stack space="space.200">
      <Heading size="medium" as="h2">{t('campaigns.basics.title')}</Heading>
      <Text as="p">{t('campaigns.basics.lead')}</Text>
      <Panel testId="basics">
        <Stack space="space.100">{rows.map(([k, v]) => <Inline key={k} space="space.200" shouldWrap><Cell><Text weight="medium">{k}</Text></Cell><Cell><Text>{v}</Text></Cell></Inline>)}</Stack>
      </Panel>
      <Heading size="small" as="h3">{t('campaigns.basics.history')}</Heading>
      <Stack space="space.050" testId="history">
        {detail.history.map((h) => <Text size="small" key={`${h.occurredAt}-${h.toStatus}`}>{formatKigali(h.occurredAt)} · {h.fromStatus === null ? '—' : t(`campaigns.states.${h.fromStatus}`)} → {t(`campaigns.states.${h.toStatus}`)}</Text>)}
      </Stack>
    </Stack>
  );
}

export function CampaignStudioPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const { publicCode = '' } = useParams();
  const perms = useCampaignPermissions();
  const q = useCampaignAdminDetail(client, publicCode, perms.read);
  const [step, setStep] = React.useState<StudioStep | 'lifecycle'>('basics');
  const detail = q.data?.campaign;
  const state = !perms.read ? 'forbidden' : q.isLoading ? 'loading' : q.isError ? (httpStatusOf(q.error) === 404 ? 'empty' : 'upstream-failure') : 'ready';
  const go = (s: StudioStep): void => setStep(s);

  return (
    <Page>
      <Stack space="space.200">
        <Inline><LinkButton appearance="subtle" href="/campaigns">{t('campaigns.new.back')}</LinkButton></Inline>
        <StateBoundary state={state} onRetry={() => void q.refetch()} copy={{ empty: { title: t('campaigns.studio.notFoundTitle'), body: t('campaigns.studio.notFoundBody') } }}>
          {detail !== undefined && (
            <Stack space="space.200">
              <Inline spread="space-between" alignBlock="center" shouldWrap>
                <Stack space="space.0">
                  <Heading size="xlarge" as="h1">{detail.summary.campaignLabel}</Heading>
                  <Text color="color.text.subtle">{detail.summary.publicCode}</Text>
                </Stack>
                <Inline space="space.200" alignBlock="center">
                  <CampaignStatusLozenge state={detail.summary.status as CampaignState} />
                  {q.dataUpdatedAt > 0 && <FreshnessStamp updatedAt={new Date(q.dataUpdatedAt).toISOString()} />}
                </Inline>
              </Inline>
              <Tabs id="studio" selected={Math.max(0, STEPS.indexOf(step))} onChange={(i) => setStep(STEPS[i] ?? 'basics')}>
                <TabList>{STEPS.map((s) => <Tab key={s}>{t(`campaigns.steps.${s}`)}</Tab>)}</TabList>
                <TabPanel><Basics detail={detail} /></TabPanel>
                <TabPanel><PolicyStep client={client} detail={detail} canWrite={perms.policy} onStep={go} /></TabPanel>
                <TabPanel><SessionsStep client={client} detail={detail} canWrite={perms.session} onStep={go} /></TabPanel>
                <TabPanel><PublishStep client={client} detail={detail} agency={perms.agency} canPublish={perms.publish} onStep={go} /></TabPanel>
                <TabPanel><LifecycleStep client={client} detail={detail} allowed={{ closeCampaignRegistration: perms.close, completeCampaign: perms.complete, cancelCampaign: perms.cancel }} /></TabPanel>
              </Tabs>
            </Stack>
          )}
        </StateBoundary>
      </Stack>
    </Page>
  );
}
