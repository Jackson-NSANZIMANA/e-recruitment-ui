import React from 'react';
import Button from '@atlaskit/button';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import TextField from '@atlaskit/textfield';
import ModalDialog, { ModalBody, ModalFooter, ModalHeader, ModalTitle, CloseButton } from '@atlaskit/modal-dialog';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import {
  ApiError,
  type ApiClient,
  useAcceptApplication,
  useAdjudicateApplication,
  useApplicationDetail,
  useRecordFinalDecision,
  useRecordMedicalReview,
} from '@usrp/api-client';
import type { Agency } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { useNavigate, useParams } from 'react-router-dom';
import { canAccept, canAdjudicate, canFinalDecision, canMedicalReview } from '../model/status.js';
import { StatusLozenge } from './StatusLozenge.js';

const styles = cssMap({
  root: {
    maxWidth: '1200px',
    marginInline: 'auto',
    paddingBlock: token('space.300'),
    paddingInline: token('space.400'),
  },
  panel: {
    padding: token('space.300'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.neutral'),
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: token('space.200'),
  },
  fact: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border'),
    borderRadius: token('radius.small'),
  },
  actionPanel: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border.warning'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.warning'),
  },
  compact: { minWidth: '240px', maxWidth: '420px' },
});

function valueOrDash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function dateOrDash(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function errorText(error: unknown, t: (key: string) => string): string {
  if (!(error instanceof ApiError)) return t('applications.errors.generic');
  switch (error.normalised.kind) {
    case 'conflict':
      return error.normalised.outcome === 'CROSS_AGENCY_ACCEPT_LOCK'
        ? t('applications.errors.crossAgencyLocked')
        : t('applications.errors.conflict');
    case 'unprocessable': return t('applications.errors.invalidInput');
    case 'forbidden': return t('applications.errors.forbidden');
    case 'unauthenticated': return t('applications.errors.session');
    case 'notFound': return t('applications.errors.notFound');
    case 'network': return t('applications.errors.network');
    default: return t('applications.errors.generic');
  }
}


interface ConfirmActionProps {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly appearance?: 'primary' | 'warning' | 'danger';
  readonly isOpen: boolean;
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly cancelLabel: string;
}

function ConfirmAction({ title, body, confirmLabel, appearance = 'primary', isOpen, isPending, onCancel, onConfirm, cancelLabel }: ConfirmActionProps): React.ReactElement | null {
  if (!isOpen) return null;
  return (
    <ModalDialog onClose={onCancel} width="small">
      <ModalHeader>
        <ModalTitle appearance={appearance === 'danger' ? 'danger' : 'warning'}>{title}</ModalTitle>
        <CloseButton onClick={onCancel} />
      </ModalHeader>
      <ModalBody><Text as="p">{body}</Text></ModalBody>
      <ModalFooter>
        <Inline space="space.100" alignInline="end">
          <Button appearance="subtle" isDisabled={isPending} onClick={onCancel}>{cancelLabel}</Button>
          <Button appearance={appearance} isLoading={isPending} onClick={onConfirm}>{confirmLabel}</Button>
        </Inline>
      </ModalFooter>
    </ModalDialog>
  );
}

interface DetailProps {
  readonly client: ApiClient;
  readonly agency: Agency;
}

function Fact({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement {
  return <Box xcss={styles.fact}><Stack space="space.050"><Text size="small" color="color.text.subtle">{label}</Text><Text weight="medium">{value}</Text></Stack></Box>;
}

function MedicalAction({ client, agency, applicationId, t }: { readonly client: ApiClient; readonly agency: Agency; readonly applicationId: string; readonly t: (key: string) => string }): React.ReactElement {
  const mutation = useRecordMedicalReview(client, agency);
  const [physicianName, setPhysicianName] = React.useState('');
  const rdf = agency === 'RDF';
  const submit = async (input: Parameters<typeof mutation.mutateAsync>[0]): Promise<void> => {
    try { await mutation.mutateAsync(input); } catch { /* rendered from mutation.error */ }
  };
  return (
    <Box xcss={styles.actionPanel}>
      <Stack space="space.200">
        <Heading size="medium" as="h2">{t('applications.actions.medicalTitle')}</Heading>
        <Text>{t(rdf ? 'applications.actions.medicalBoardHint' : 'applications.actions.medicalCertificateHint')}</Text>
        {!rdf && (
          <Box xcss={styles.compact}>
            <TextField value={physicianName} onChange={(event) => setPhysicianName(event.target.value)} placeholder={t('applications.actions.physicianPlaceholder')} aria-label={t('applications.actions.physicianLabel')} />
          </Box>
        )}
        <Inline space="space.100" shouldWrap>
          {rdf ? (
            <>
              <Button appearance="primary" isLoading={mutation.isPending} onClick={() => void submit({ applicationId, fitnessStatus: 'FIT' })}>{t('applications.actions.fit')}</Button>
              <Button appearance="subtle" isLoading={mutation.isPending} onClick={() => void submit({ applicationId, fitnessStatus: 'UNFIT' })}>{t('applications.actions.unfit')}</Button>
            </>
          ) : (
            <>
              <Button appearance="primary" isLoading={mutation.isPending} isDisabled={physicianName.trim().length === 0} onClick={() => void submit({ applicationId, certVerdict: 'CERT_VERIFIED', physicianName: physicianName.trim() })}>{t('applications.actions.certified')}</Button>
              <Button appearance="subtle" isLoading={mutation.isPending} onClick={() => void submit({ applicationId, certVerdict: 'CERT_REJECTED' })}>{t('applications.actions.certRejected')}</Button>
            </>
          )}
        </Inline>
        {mutation.isError && <SectionMessage appearance="error">{errorText(mutation.error, t)}</SectionMessage>}
      </Stack>
    </Box>
  );
}

function FinalDecisionAction({ client, agency, applicationId, t }: { readonly client: ApiClient; readonly agency: Agency; readonly applicationId: string; readonly t: (key: string) => string }): React.ReactElement {
  const mutation = useRecordFinalDecision(client, agency);
  const [confirm, setConfirm] = React.useState<'shortlist' | 'reject' | null>(null);
  const decide = async (): Promise<void> => {
    if (confirm === null) return;
    try {
      await mutation.mutateAsync({ applicationId, decision: confirm === 'shortlist' ? 'SHORTLIST' : 'REJECT' });
      setConfirm(null);
    } catch { /* rendered below */ }
  };
  return (
    <Box xcss={styles.actionPanel}>
      <Stack space="space.200">
        <Heading size="medium" as="h2">{t('applications.actions.finalTitle')}</Heading>
        <Text>{t('applications.actions.finalHint')}</Text>
        <Inline space="space.100" shouldWrap>
          <Button appearance="primary" isLoading={mutation.isPending} onClick={() => setConfirm('shortlist')}>{t('applications.actions.shortlist')}</Button>
          <Button appearance="danger" isLoading={mutation.isPending} onClick={() => setConfirm('reject')}>{t('applications.actions.reject')}</Button>
        </Inline>
        <ConfirmAction
          isOpen={confirm !== null}
          isPending={mutation.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void decide()}
          cancelLabel={t('applications.actions.cancel')}
          appearance={confirm === 'reject' ? 'danger' : 'primary'}
          title={confirm === 'reject' ? t('applications.actions.confirmRejectTitle') : t('applications.actions.confirmShortlistTitle')}
          body={confirm === 'reject' ? t('applications.actions.confirmRejectBody') : t('applications.actions.confirmShortlistBody')}
          confirmLabel={confirm === 'reject' ? t('applications.actions.confirmReject') : t('applications.actions.confirmShortlist')}
        />
        {mutation.isError && <SectionMessage appearance="error">{errorText(mutation.error, t)}</SectionMessage>}
      </Stack>
    </Box>
  );
}

function AcceptAction({ client, agency, applicationId, t }: { readonly client: ApiClient; readonly agency: Agency; readonly applicationId: string; readonly t: (key: string) => string }): React.ReactElement {
  const mutation = useAcceptApplication(client, agency);
  const [confirm, setConfirm] = React.useState(false);
  const accept = async (): Promise<void> => {
    try {
      await mutation.mutateAsync({ applicationId });
      setConfirm(false);
    } catch { /* rendered below */ }
  };
  return (
    <Box xcss={styles.actionPanel}>
      <Stack space="space.200">
        <Heading size="medium" as="h2">{t('applications.actions.acceptTitle')}</Heading>
        <Text>{t('applications.actions.acceptHint')}</Text>
        <Button appearance="primary" isLoading={mutation.isPending} onClick={() => setConfirm(true)}>{t('applications.actions.accept')}</Button>
        <ConfirmAction
          isOpen={confirm}
          isPending={mutation.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void accept()}
          cancelLabel={t('applications.actions.cancel')}
          title={t('applications.actions.confirmAcceptTitle')}
          body={t('applications.actions.confirmAcceptBody')}
          confirmLabel={t('applications.actions.confirmAccept')}
        />
        {mutation.isError && <SectionMessage appearance="error">{errorText(mutation.error, t)}</SectionMessage>}
      </Stack>
    </Box>
  );
}

function AdjudicationAction({ client, agency, applicationId, t }: { readonly client: ApiClient; readonly agency: Agency; readonly applicationId: string; readonly t: (key: string) => string }): React.ReactElement {
  const mutation = useAdjudicateApplication(client, agency);
  const [confirm, setConfirm] = React.useState<'clear' | 'reject' | null>(null);
  const adjudicate = async (): Promise<void> => {
    if (confirm === null) return;
    try {
      await mutation.mutateAsync({ applicationId, decision: confirm === 'clear' ? 'CLEAR' : 'REJECT' });
      setConfirm(null);
    } catch { /* rendered below */ }
  };
  return (
    <Box xcss={styles.actionPanel}>
      <Stack space="space.200">
        <Heading size="medium" as="h2">{t('applications.actions.adjudicationTitle')}</Heading>
        <Text>{t('applications.actions.adjudicationHint')}</Text>
        <Inline space="space.100" shouldWrap>
          <Button appearance="primary" isLoading={mutation.isPending} onClick={() => setConfirm('clear')}>{t('applications.actions.clear')}</Button>
          <Button appearance="danger" isLoading={mutation.isPending} onClick={() => setConfirm('reject')}>{t('applications.actions.reject')}</Button>
        </Inline>
        <ConfirmAction
          isOpen={confirm !== null}
          isPending={mutation.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void adjudicate()}
          cancelLabel={t('applications.actions.cancel')}
          appearance={confirm === 'reject' ? 'danger' : 'primary'}
          title={confirm === 'reject' ? t('applications.actions.confirmRejectTitle') : t('applications.actions.confirmClearTitle')}
          body={confirm === 'reject' ? t('applications.actions.confirmRejectBody') : t('applications.actions.confirmClearBody')}
          confirmLabel={confirm === 'reject' ? t('applications.actions.confirmReject') : t('applications.actions.confirmClear')}
        />
        {mutation.isError && <SectionMessage appearance="error">{errorText(mutation.error, t)}</SectionMessage>}
      </Stack>
    </Box>
  );
}

export function ApplicationDetailPage({ client, agency }: DetailProps): React.ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('applications');
  const query = useApplicationDetail(client, id);

  if (query.isLoading) return <Box xcss={styles.root}><Spinner size="large" label={t('applications.loading')} /></Box>;
  if (query.isError || query.data === undefined) {
    return <Box xcss={styles.root}><SectionMessage appearance="error" title={t('applications.errors.title')} headingLevel="h2"><Stack space="space.200"><Text>{errorText(query.error, t)}</Text><Button appearance="default" onClick={() => void query.refetch()}>{t('applications.actions.retry')}</Button></Stack></SectionMessage></Box>;
  }

  const application = query.data.application;
  const history = query.data.history;
  const currentStatus = application.status;
  const applicationId = application.applicationId ?? id;

  return (
    <Box xcss={styles.root}>
      <Stack space="space.300">
        <Button appearance="subtle" onClick={() => navigate('/applications')}>{t('applications.actions.back')}</Button>
        <Box xcss={styles.panel}>
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Stack space="space.050">
                <Text color="color.text.subtle" size="small">{applicationId}</Text>
                <Heading size="xlarge" as="h1">{valueOrDash(application.processingCode)}</Heading>
              </Stack>
              {currentStatus !== null && <StatusLozenge status={currentStatus} />}
            </Inline>
            <Inline space="space.100" shouldWrap>
              <Text color="color.text.subtle">{t('applications.detail.agency')}: <Text weight="medium">{agency}</Text></Text>
              <Text color="color.text.subtle">{t('applications.detail.category')}: <Text weight="medium">{valueOrDash(application.category)}</Text></Text>
              <Text color="color.text.subtle">{t('applications.detail.submittedAt')}: <Text weight="medium">{dateOrDash(application.submittedAt)}</Text></Text>
            </Inline>
          </Stack>
        </Box>

        <Box xcss={styles.facts}>
          <Fact label={t('applications.detail.academic')} value={valueOrDash(application.academicStatus)} />
          <Fact label={t('applications.detail.age')} value={valueOrDash(application.ageEligibilityStatus)} />
          <Fact label={t('applications.detail.criminal')} value={valueOrDash(application.criminalClearanceStatus)} />
          <Fact label={t('applications.detail.documents')} value={valueOrDash(application.documentLane)} />
          <Fact label={t('applications.detail.district')} value={valueOrDash(application.assignedDistrict)} />
          <Fact label={t('applications.detail.venue')} value={valueOrDash(application.assignedVenueName)} />
        </Box>

        {currentStatus !== null && canMedicalReview(currentStatus) && <MedicalAction client={client} agency={agency} applicationId={applicationId} t={t} />}
        {currentStatus !== null && canFinalDecision(currentStatus) && <FinalDecisionAction client={client} agency={agency} applicationId={applicationId} t={t} />}
        {currentStatus !== null && canAccept(currentStatus) && <AcceptAction client={client} agency={agency} applicationId={applicationId} t={t} />}
        {currentStatus !== null && canAdjudicate(currentStatus) && <AdjudicationAction client={client} agency={agency} applicationId={applicationId} t={t} />}

        <Box xcss={styles.panel}>
          <Stack space="space.200">
            <Heading size="large" as="h2">{t('applications.detail.reviewSignals')}</Heading>
            <Inline space="space.100" shouldWrap>
              <Fact label={t('applications.detail.forensics')} value={valueOrDash(application.documentForensicsScore)} />
              <Fact label={t('applications.detail.reviewDecision')} value={valueOrDash(application.documentReviewDecision)} />
              <Fact label={t('applications.detail.physicalComplete')} value={dateOrDash(application.physicalTestCompletedAt)} />
              <Fact label={t('applications.detail.finalDecision')} value={dateOrDash(application.finalDecisionAt)} />
            </Inline>
          </Stack>
        </Box>

        <Box xcss={styles.panel}>
          <Stack space="space.200">
            <Heading size="large" as="h2">{t('applications.detail.history')}</Heading>
            {history.length === 0 ? (
              <Text color="color.text.subtle">{t('applications.detail.noHistory')}</Text>
            ) : (
              <Stack space="space.150">
                {history.map((entry, index) => (
                  <Inline key={entry.entryId ?? `${entry.occurredAt}-${index}`} space="space.150" alignBlock="start">
                    <Text size="small" color="color.text.subtle">{dateOrDash(entry.occurredAt)}</Text>
                    <Stack space="space.050">
                      {entry.toStatus !== null && <StatusLozenge status={entry.toStatus} />}
                      <Text size="small">{entry.actorKind ?? t('applications.detail.unknownActor')}{entry.note ? ` · ${entry.note}` : ''}</Text>
                    </Stack>
                  </Inline>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        <Inline space="space.100">
          <Button appearance="default" href="/applications">{t('applications.actions.backToList')}</Button>
        </Inline>
      </Stack>
    </Box>
  );
}
