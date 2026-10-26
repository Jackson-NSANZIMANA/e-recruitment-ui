import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import {
  httpStatusOf,
  useApplicationDetail,
  useBiometricEvidence,
  useDocumentChecklist,
  type ApiClient,
  type ApplicationRecord,
  type StatusHistoryEntry,
} from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import type { Agency, ApplicationStatus } from '@usrp/contracts';
import { APPLICATION_STATUSES } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { FreshnessStamp, MaskedValue, StateBoundary, Timeline, stateFromHttpStatus, type TimelineEntry } from '@usrp/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { actionsToShow, blockedByPost, evidenceSummary } from '../model/workspace.js';
import { statusLabelKey } from '../model/status.js';
import { ActionPanel } from './ActionPanels.js';
import { StatusLozenge } from './StatusLozenge.js';

const STATUS_SET: ReadonlySet<string> = new Set(APPLICATION_STATUSES);
const isStatus = (s: string | null): s is ApplicationStatus => s !== null && STATUS_SET.has(s);

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
  panel: {
    padding: token('space.300'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.neutral'),
  },
  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: token('space.200') },
  fact: { padding: token('space.200'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.small') },
});

type T = ReturnType<typeof useTranslation>['t'];

const dash = (v: string | number | null | undefined): string => (v === null || v === undefined || v === '' ? '—' : String(v));
const when = (v: string | null): string => {
  if (v === null) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

function Fact({ label, value, testId }: { readonly label: string; readonly value: React.ReactNode; readonly testId?: string }): React.ReactElement {
  return (
    <Box xcss={styles.fact} {...(testId !== undefined ? { testId } : {})}>
      <Stack space="space.050">
        <Text size="small" color="color.text.subtle">{label}</Text>
        {typeof value === 'string' ? <Text weight="medium">{value}</Text> : value}
      </Stack>
    </Box>
  );
}

function Facts({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <Box xcss={styles.facts}>{children}</Box>;
}

function SummaryTab({ a, t }: { readonly a: ApplicationRecord; readonly t: T }): React.ReactElement {
  return (
    <Facts>
      <Fact label={t('applications.detail.academic')} value={dash(a.academicStatus)} />
      <Fact label={t('applications.detail.age')} value={dash(a.ageEligibilityStatus)} />
      <Fact label={t('applications.detail.criminal')} value={dash(a.criminalClearanceStatus)} />
      <Fact label={t('applications.detail.documents')} value={dash(a.documentLane)} />
      {a.nesaIndexNumber !== null && <Fact label={t('applications.detail.nesa')} value={<MaskedValue value={a.nesaIndexNumber} label={t('applications.detail.nesa')} />} />}
      {a.hecRegistrationNumber !== null && <Fact label={t('applications.detail.hec')} value={<MaskedValue value={a.hecRegistrationNumber} label={t('applications.detail.hec')} />} />}
      <Fact label={t('applications.detail.forensics')} value={a.documentForensicsScore === null ? t('applications.detail.notAnalysed') : String(a.documentForensicsScore)} testId="fact-forensics" />
      <Fact label={t('applications.detail.reviewDecision')} value={dash(a.documentReviewDecision)} />
    </Facts>
  );
}

function TimelineTab({ history, t }: { readonly history: readonly StatusHistoryEntry[]; readonly t: T }): React.ReactElement {
  const entries: TimelineEntry[] = history.map((h, i) => {
    const to = h.toStatus;
    const title = isStatus(to) ? t(statusLabelKey(to)) : dash(to);
    const actor = h.actorKind ?? t('applications.detail.unknownActor');
    return { id: h.entryId ?? `${h.occurredAt}-${i}`, at: h.occurredAt ?? '', title, detail: h.note ? `${actor} · ${h.note}` : actor };
  });
  return <Timeline entries={entries} emptyLabel={t('applications.detail.noHistory')} />;
}

function DocumentsTab({ client, applicationId, t }: { readonly client: ApiClient; readonly applicationId: string; readonly t: T }): React.ReactElement {
  const q = useDocumentChecklist(client, applicationId);
  const state = q.isLoading ? 'loading' : q.isError ? stateFromHttpStatus(httpStatusOf(q.error)) : (q.data?.items.length ?? 0) === 0 ? 'empty' : 'ready';
  return (
    <StateBoundary state={state} onRetry={() => void q.refetch()}>
      <Stack space="space.100" testId="documents-checklist">
        {(q.data?.items ?? []).map((item) => (
          <Inline key={item.documentType} space="space.150" alignBlock="center" shouldWrap>
            <Text weight="medium">{item.documentType}</Text>
            <Text color="color.text.subtle">{t(`applications.documents.satisfaction.${item.satisfaction}`)}</Text>
            {item.satisfaction === 'VENUE_VERIFIED' && <Text color="color.text.success" testId={`venue-verified-${item.documentType}`}>{t('applications.documents.venueVerified')}</Text>}
          </Inline>
        ))}
      </Stack>
    </StateBoundary>
  );
}

function SlotTab({ a, t }: { readonly a: ApplicationRecord; readonly t: T }): React.ReactElement {
  return (
    <Facts>
      <Fact label={t('applications.detail.district')} value={dash(a.assignedDistrict)} />
      <Fact label={t('applications.detail.venue')} value={dash(a.assignedVenueName)} />
      <Fact label={t('applications.detail.scheduledAt')} value={when(a.physicalTestScheduledAt)} />
      <Fact label={t('applications.detail.invitationIssued')} value={when(a.qrInvitationIssuedAt)} />
      <Fact label={t('applications.detail.smsSent')} value={when(a.smsNotificationSentAt)} />
    </Facts>
  );
}

function GateTab({ client, applicationId, permissions, t }: { readonly client: ApiClient; readonly applicationId: string; readonly permissions: readonly string[]; readonly t: T }): React.ReactElement {
  const allowed = permissions.includes('biometric.evidence.read');
  const q = useBiometricEvidence(client, applicationId, allowed);
  const state = !allowed ? 'forbidden' : q.isLoading ? 'loading' : q.isError ? stateFromHttpStatus(httpStatusOf(q.error)) : (q.data?.evidence.length ?? 0) === 0 ? 'empty' : 'ready';
  return (
    <Stack space="space.200">
      <SectionMessage appearance="information" title={t('applications.biometric.advisoryTitle')} headingLevel="h3">
        <Text as="p">{t('applications.biometric.advisoryBody')}</Text>
      </SectionMessage>
      <StateBoundary
        state={state}
        onRetry={() => void q.refetch()}
        copy={{ empty: { title: t('applications.biometric.noneTitle'), body: t('applications.biometric.noneBody') } }}
      >
        <Stack space="space.150" testId="biometric-evidence">
          {(q.data?.evidence ?? []).map((row) => {
            const s = evidenceSummary(row);
            return (
              <Facts key={row.recordId}>
                <Fact label={t('applications.biometric.outcome.label')} value={t(s.outcomeKey, { defaultValue: row.outcome })} />
                <Fact label={t('applications.biometric.liveness')} value={s.liveness} />
                <Fact label={t('applications.biometric.match')} value={s.match} />
                <Fact label={t('applications.biometric.source')} value={row.referenceSource} />
                <Fact label={t('applications.biometric.capturedAt')} value={when(row.capturedAt)} />
                {row.manualIdentity !== null && <Fact label={t('applications.biometric.manual')} value={`${row.manualIdentity.reasonCode} · ${when(row.manualIdentity.confirmedAt)}`} />}
              </Facts>
            );
          })}
        </Stack>
      </StateBoundary>
    </Stack>
  );
}

function FieldTab({ a, t }: { readonly a: ApplicationRecord; readonly t: T }): React.ReactElement {
  return (
    <Facts>
      <Fact label={t('applications.detail.physicalComplete')} value={when(a.physicalTestCompletedAt)} />
      <Fact label={t('applications.detail.updatedAt')} value={when(a.updatedAt)} />
    </Facts>
  );
}

function MedicalTab({ a, t }: { readonly a: ApplicationRecord; readonly t: T }): React.ReactElement {
  return (
    <Facts>
      <Fact label={t('applications.detail.status')} value={isStatus(a.status) ? t(statusLabelKey(a.status)) : dash(a.status)} />
      <Fact label={t('applications.detail.finalDecision')} value={when(a.finalDecisionAt)} />
      <Fact label={t('applications.detail.finalNotes')} value={dash(a.finalDecisionNotes)} />
    </Facts>
  );
}

export interface ApplicationDetailPageProps {
  readonly client: ApiClient;
  readonly agency: Agency;
}

/** Applicant 360: one record, every aspect an officer needs, and only the actions their post allows. */
export function ApplicationDetailPage({ client, agency }: ApplicationDetailPageProps): React.ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('applications');
  const session = useOfficerSession();
  const permissions = session?.permissions ?? [];
  const query = useApplicationDetail(client, id);

  const state = query.isLoading ? 'loading' : query.isError || query.data === undefined ? stateFromHttpStatus(httpStatusOf(query.error)) : 'ready';
  const application = query.data?.application;
  const status = application?.status ?? null;
  const applicationId = application?.applicationId ?? id;
  const shown = isStatus(status) ? actionsToShow(status, permissions) : [];
  const blocked = isStatus(status) ? blockedByPost(status, permissions) : [];

  return (
    <Box xcss={styles.root}>
      <Stack space="space.300">
        <Inline><Button appearance="subtle" onClick={() => navigate('/applications')}>{t('applications.actions.back')}</Button></Inline>
        <StateBoundary state={state} onRetry={() => void query.refetch()}>
          {application !== undefined && query.data !== undefined && (
            <Stack space="space.300">
              <Box xcss={styles.panel}>
                <Stack space="space.200">
                  <Inline spread="space-between" alignBlock="center" shouldWrap>
                    <Stack space="space.050">
                      <Text color="color.text.subtle" size="small">{applicationId}</Text>
                      <Heading size="xlarge" as="h1">{dash(application.processingCode)}</Heading>
                    </Stack>
                    {isStatus(status) && <StatusLozenge status={status} />}
                  </Inline>
                  <Inline space="space.200" shouldWrap alignBlock="center">
                    <Text color="color.text.subtle">{t('applications.detail.agency')}: <Text weight="medium">{agency}</Text></Text>
                    <Text color="color.text.subtle">{t('applications.detail.category')}: <Text weight="medium">{dash(application.category)}</Text></Text>
                    <Text color="color.text.subtle">{t('applications.detail.submittedAt')}: <Text weight="medium">{when(application.submittedAt)}</Text></Text>
                    <FreshnessStamp updatedAt={new Date(query.dataUpdatedAt).toISOString()} />
                  </Inline>
                </Stack>
              </Box>

              {shown.map((action) => (
                <ActionPanel key={action} action={action} client={client} agency={agency} applicationId={applicationId} t={t} />
              ))}
              {shown.length === 0 && blocked.length > 0 && (
                <SectionMessage appearance="information" testId="blocked-by-post"><Text as="p">{t('applications.actions.blockedByPost')}</Text></SectionMessage>
              )}

              <Tabs id="application-360">
                <TabList>
                  <Tab>{t('applications.tabs.summary')}</Tab>
                  <Tab>{t('applications.tabs.timeline')}</Tab>
                  <Tab>{t('applications.tabs.documents')}</Tab>
                  <Tab>{t('applications.tabs.slot')}</Tab>
                  <Tab>{t('applications.tabs.gate')}</Tab>
                  <Tab>{t('applications.tabs.field')}</Tab>
                  <Tab>{t('applications.tabs.medical')}</Tab>
                </TabList>
                <TabPanel><Box xcss={styles.panel}><SummaryTab a={application} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><TimelineTab history={query.data.history} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><DocumentsTab client={client} applicationId={applicationId} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><SlotTab a={application} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><GateTab client={client} applicationId={applicationId} permissions={permissions} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><FieldTab a={application} t={t} /></Box></TabPanel>
                <TabPanel><Box xcss={styles.panel}><MedicalTab a={application} t={t} /></Box></TabPanel>
              </Tabs>
            </Stack>
          )}
        </StateBoundary>
      </Stack>
    </Box>
  );
}
