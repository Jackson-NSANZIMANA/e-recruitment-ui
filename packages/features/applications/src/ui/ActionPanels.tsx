import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import TextField from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import {
  useAcceptApplication,
  useAdjudicateApplication,
  useRecordFinalDecision,
  useRecordMedicalReview,
  type ApiClient,
} from '@usrp/api-client';
import type { Agency } from '@usrp/contracts';
import { useTranslation } from '@usrp/i18n';
import { ConfirmAction } from '@usrp/ui';
import { lockedBy, type WorkspaceAction } from '../model/workspace.js';
import { outcomeOf } from './errors.js';

type T = ReturnType<typeof useTranslation>['t'];

const styles = cssMap({
  panel: {
    padding: token('space.200'),
    borderWidth: token('border.width'),
    borderStyle: 'solid',
    borderColor: token('color.border.warning'),
    borderRadius: token('radius.medium'),
    backgroundColor: token('color.background.warning'),
  },
  compact: { minWidth: '240px', maxWidth: '420px' },
});

interface PanelProps {
  readonly client: ApiClient;
  readonly agency: Agency;
  readonly applicationId: string;
  readonly t: T;
}

/** A refusal in words: the cross-agency lock names the holder (409 CROSS_AGENCY_LOCKED), a stale state asks for a reload. */
function RefusalMessage({ error, t }: { readonly error: unknown; readonly t: T }): React.ReactElement {
  const o = outcomeOf(error);
  if (o.kind === 'conflict') {
    const holder = lockedBy(o.data);
    if (o.outcome === 'CROSS_AGENCY_LOCKED' || o.outcome === 'CROSS_AGENCY_ACCEPT_LOCK') {
      return <SectionMessage appearance="warning" title={t('applications.errors.crossAgencyLockedTitle')} headingLevel="h3"><Text as="p">{holder === null ? t('applications.errors.crossAgencyLocked') : t('applications.errors.crossAgencyLockedBy', { agency: holder })}</Text></SectionMessage>;
    }
    return <SectionMessage appearance="warning"><Text as="p">{t('applications.errors.conflict')}</Text></SectionMessage>;
  }
  if (o.kind === 'unprocessable') return <SectionMessage appearance="error"><Text as="p">{t('applications.errors.invalidInput')}</Text></SectionMessage>;
  if (o.kind === 'forbidden') return <SectionMessage appearance="error"><Text as="p">{t('applications.errors.forbidden')}</Text></SectionMessage>;
  return <SectionMessage appearance="error"><Text as="p">{t('applications.errors.generic')}</Text></SectionMessage>;
}

function Panel({ title, hint, children }: { readonly title: string; readonly hint: string; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <Box xcss={styles.panel}>
      <Stack space="space.200">
        <Heading size="medium" as="h2">{title}</Heading>
        <Text>{hint}</Text>
        {children}
      </Stack>
    </Box>
  );
}

function MedicalPanel({ client, agency, applicationId, t }: PanelProps): React.ReactElement {
  const mutation = useRecordMedicalReview(client, agency);
  const [physician, setPhysician] = React.useState('');
  const rdf = agency === 'RDF';
  const submit = async (input: Parameters<typeof mutation.mutateAsync>[0]): Promise<void> => {
    try { await mutation.mutateAsync(input); } catch { /* rendered from mutation.error */ }
  };
  return (
    <Panel title={t('applications.actions.medicalTitle')} hint={t(rdf ? 'applications.actions.medicalBoardHint' : 'applications.actions.medicalCertificateHint')}>
      {!rdf && (
        <Box xcss={styles.compact}>
          <TextField value={physician} onChange={(e) => setPhysician((e.target as HTMLInputElement).value)} placeholder={t('applications.actions.physicianPlaceholder')} aria-label={t('applications.actions.physicianLabel')} />
        </Box>
      )}
      <Inline space="space.100" shouldWrap>
        {rdf ? (
          <>
            <Button appearance="primary" isDisabled={mutation.isPending} onClick={() => { void submit({ applicationId, fitnessStatus: 'FIT' }); }}>{t('applications.actions.fit')}</Button>
            <Button appearance="subtle" isDisabled={mutation.isPending} onClick={() => { void submit({ applicationId, fitnessStatus: 'UNFIT' }); }}>{t('applications.actions.unfit')}</Button>
          </>
        ) : (
          <>
            <Button appearance="primary" isDisabled={mutation.isPending || physician.trim().length === 0} onClick={() => { void submit({ applicationId, certVerdict: 'CERT_VERIFIED', physicianName: physician.trim() }); }}>{t('applications.actions.certified')}</Button>
            <Button appearance="subtle" isDisabled={mutation.isPending} onClick={() => { void submit({ applicationId, certVerdict: 'CERT_REJECTED' }); }}>{t('applications.actions.certRejected')}</Button>
          </>
        )}
      </Inline>
      {mutation.isError && <RefusalMessage error={mutation.error} t={t} />}
    </Panel>
  );
}

function FinalPanel({ client, agency, applicationId, t }: PanelProps): React.ReactElement {
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
    <Panel title={t('applications.actions.finalTitle')} hint={t('applications.actions.finalHint')}>
      <Inline space="space.100" shouldWrap>
        <Button appearance="primary" isDisabled={mutation.isPending} onClick={() => setConfirm('shortlist')}>{t('applications.actions.shortlist')}</Button>
        <Button appearance="danger" isDisabled={mutation.isPending} onClick={() => setConfirm('reject')}>{t('applications.actions.reject')}</Button>
      </Inline>
      <ConfirmAction
        isOpen={confirm !== null}
        isPending={mutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void decide()}
        appearance={confirm === 'reject' ? 'danger' : 'primary'}
        title={confirm === 'reject' ? t('applications.actions.confirmRejectTitle') : t('applications.actions.confirmShortlistTitle')}
        body={confirm === 'reject' ? t('applications.actions.confirmRejectBody') : t('applications.actions.confirmShortlistBody')}
        confirmLabel={confirm === 'reject' ? t('applications.actions.confirmReject') : t('applications.actions.confirmShortlist')}
      />
      {mutation.isError && <RefusalMessage error={mutation.error} t={t} />}
    </Panel>
  );
}

function AcceptPanel({ client, agency, applicationId, t }: PanelProps): React.ReactElement {
  const mutation = useAcceptApplication(client, agency);
  const [confirm, setConfirm] = React.useState(false);
  const accept = async (): Promise<void> => {
    try {
      await mutation.mutateAsync({ applicationId });
      setConfirm(false);
    } catch { /* rendered below; the dialog stays so the refusal is read in context */ }
  };
  return (
    <Panel title={t('applications.actions.acceptTitle')} hint={t('applications.actions.acceptHint')}>
      <Inline><Button appearance="primary" isDisabled={mutation.isPending} onClick={() => setConfirm(true)}>{t('applications.actions.accept')}</Button></Inline>
      <ConfirmAction
        isOpen={confirm}
        isPending={mutation.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void accept()}
        title={t('applications.actions.confirmAcceptTitle')}
        body={t('applications.actions.confirmAcceptBody')}
        consequences={[t('applications.actions.acceptConsequence')]}
        confirmLabel={t('applications.actions.confirmAccept')}
      >
        {mutation.isError && <RefusalMessage error={mutation.error} t={t} />}
      </ConfirmAction>
      {mutation.isError && !confirm && <RefusalMessage error={mutation.error} t={t} />}
    </Panel>
  );
}

function AdjudicatePanel({ client, agency, applicationId, t }: PanelProps): React.ReactElement {
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
    <Panel title={t('applications.actions.adjudicationTitle')} hint={t('applications.actions.adjudicationHint')}>
      <Inline space="space.100" shouldWrap>
        <Button appearance="primary" isDisabled={mutation.isPending} onClick={() => setConfirm('clear')}>{t('applications.actions.clear')}</Button>
        <Button appearance="danger" isDisabled={mutation.isPending} onClick={() => setConfirm('reject')}>{t('applications.actions.reject')}</Button>
      </Inline>
      <ConfirmAction
        isOpen={confirm !== null}
        isPending={mutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void adjudicate()}
        appearance={confirm === 'reject' ? 'danger' : 'primary'}
        title={confirm === 'reject' ? t('applications.actions.confirmRejectTitle') : t('applications.actions.confirmClearTitle')}
        body={confirm === 'reject' ? t('applications.actions.confirmRejectBody') : t('applications.actions.confirmClearBody')}
        confirmLabel={confirm === 'reject' ? t('applications.actions.confirmReject') : t('applications.actions.confirmClear')}
      />
      {mutation.isError && <RefusalMessage error={mutation.error} t={t} />}
    </Panel>
  );
}

const PANELS: Readonly<Record<WorkspaceAction, (p: PanelProps) => React.ReactElement>> = {
  MEDICAL: MedicalPanel,
  FINAL: FinalPanel,
  ACCEPT: AcceptPanel,
  ADJUDICATE: AdjudicatePanel,
};

export function ActionPanel({ action, ...props }: PanelProps & { readonly action: WorkspaceAction }): React.ReactElement {
  const Component = PANELS[action];
  return <Component {...props} />;
}
