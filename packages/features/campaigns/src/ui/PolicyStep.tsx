// campaigns — step 2: the immutable policy version. Suggestions from the engine are
// labelled as such and every category must be confirmed by the officer; the returned
// hash is shown and re-computed on this device; a diff shows what changed.
import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Select from '@atlaskit/select';
import SectionMessage from '@atlaskit/section-message';
import Textfield from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { useCreateCampaignPolicy, type ApiClient, type CampaignAdminDetail, type CreateCampaignPolicyInput } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { kigaliToday } from '../model/kigali.ts';
import {
  CRIMINAL_THRESHOLDS, EDUCATION_LEVELS, EDUCATION_MODES, MEDICAL_MODES, SUGGESTION_LEGAL_BASIS_CODE, acceptedDocumentTypes,
  diffPolicy, policyDigest, suggestPolicy, toPolicyCommand, validatePolicy, type CategoryPolicyForm, type PolicyForm,
} from '../model/policy.ts';
import type { StudioStep } from '../model/preflight.ts';
import { Field, Refusal, useIntentKey, type Opt, type T, Panel, Wrap } from './shared.tsx';

const storeKey = (code: string): string => `usrp.campaigns.policy.${code}`;
function lastSubmitted(code: string): CreateCampaignPolicyInput | null {
  try { const raw = window.sessionStorage.getItem(storeKey(code)); return raw === null ? null : (JSON.parse(raw) as CreateCampaignPolicyInput); } catch { return null; }
}
function remember(code: string, cmd: CreateCampaignPolicyInput): void {
  try { window.sessionStorage.setItem(storeKey(code), JSON.stringify(cmd)); } catch { /* the diff is a convenience */ }
}

const opts = (values: readonly string[], t: T, group: string): Opt[] => values.map((v) => ({ value: v, label: t(`campaigns.policy.${group}.${v}`, { defaultValue: v }) }));

function CategoryCard({ category, value, onChange, t }: { readonly category: string; readonly value: CategoryPolicyForm; readonly onChange: (v: CategoryPolicyForm) => void; readonly t: T }): React.ReactElement {
  // Any edit un-confirms the category: the officer confirms what they last looked at.
  const edit = (patch: Partial<CategoryPolicyForm>): void => onChange({ ...value, ...patch, confirmed: false });
  const sel = (id: string, label: string, options: Opt[], current: string, key: keyof CategoryPolicyForm): React.ReactElement => (
    <Field label={label} testId={`${category}-${id}`}>
      <Select<Opt> inputId={`${category}-${id}`} aria-label={`${label} (${t(`campaigns.categories.${category}`)})`} options={options}
        value={options.find((o) => o.value === current) ?? null} onChange={(o) => { if (o !== null) edit({ [key]: o.value } as Partial<CategoryPolicyForm>); }} />
    </Field>
  );
  const num = (id: 'minimumAge' | 'maximumAge'): React.ReactElement => (
    <Field label={t(`campaigns.policy.${id}`)} grow={false}>
      <Textfield name={`${category}-${id}`} inputMode="numeric" aria-label={`${t(`campaigns.policy.${id}`)} (${t(`campaigns.categories.${category}`)})`} value={value[id]} onChange={(e) => edit({ [id]: (e.target as HTMLInputElement).value })} />
    </Field>
  );
  const docs = acceptedDocumentTypes(category).map((d) => ({ value: d, label: t(`campaigns.documents.${d}`, { defaultValue: d }) }));
  return (
    <Panel testId={`policy-${category}`}>
      <Stack space="space.150">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="small" as="h3">{t(`campaigns.categories.${category}`)}</Heading>
          <Text size="small" color={value.confirmed ? 'color.text.success' : 'color.text.warning'}>{t(value.confirmed ? 'campaigns.policy.confirmed' : 'campaigns.policy.suggestion')}</Text>
        </Inline>
        <Inline space="space.200" shouldWrap>
          {num('minimumAge')}{num('maximumAge')}
          <Field label={t('campaigns.policy.referenceDate')} grow={false}>
            <Textfield name={`${category}-ref`} type="date" aria-label={`${t('campaigns.policy.referenceDate')} (${t(`campaigns.categories.${category}`)})`} value={value.referenceDate} onChange={(e) => edit({ referenceDate: (e.target as HTMLInputElement).value })} />
          </Field>
        </Inline>
        <Inline space="space.200" shouldWrap>
          {sel('educationMode', t('campaigns.policy.educationMode'), opts(EDUCATION_MODES, t, 'educationModes'), value.educationMode, 'educationMode')}
          {sel('educationThreshold', t('campaigns.policy.educationThreshold'), opts(EDUCATION_LEVELS, t, 'educationLevels'), value.educationThreshold, 'educationThreshold')}
        </Inline>
        <Inline space="space.200" shouldWrap>
          {sel('criminalThreshold', t('campaigns.policy.criminalThreshold'), opts(CRIMINAL_THRESHOLDS, t, 'criminal'), value.criminalThreshold, 'criminalThreshold')}
          {sel('medicalMode', t('campaigns.policy.medicalMode'), opts(MEDICAL_MODES, t, 'medical'), value.medicalMode, 'medicalMode')}
        </Inline>
        <Field label={t('campaigns.policy.documents')} hint={t('campaigns.policy.documentsHint')} testId={`${category}-documents`}>
          <Select<Opt, true> isMulti inputId={`${category}-documents`} aria-label={`${t('campaigns.policy.documents')} (${t(`campaigns.categories.${category}`)})`} options={docs}
            value={docs.filter((o) => value.requiredDocumentTypes.includes(o.value))} onChange={(s) => edit({ requiredDocumentTypes: s.map((o) => o.value) })} />
        </Field>
        <Inline>
          <Button appearance={value.confirmed ? 'default' : 'primary'} onClick={() => onChange({ ...value, confirmed: !value.confirmed })} testId={`${category}-confirm`}>
            {t(value.confirmed ? 'campaigns.policy.unconfirm' : 'campaigns.policy.confirm', { category: t(`campaigns.categories.${category}`) })}
          </Button>
        </Inline>
      </Stack>
    </Panel>
  );
}

export function PolicyStep({ client, detail, canWrite, onStep }: { readonly client: ApiClient; readonly detail: CampaignAdminDetail; readonly canWrite: boolean; readonly onStep: (s: StudioStep) => void }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const code = detail.summary.publicCode;
  const categories = detail.summary.targetCategories;
  const editable = canWrite && detail.summary.status === 'DRAFT';
  const create = useCreateCampaignPolicy(client);
  const [keyFor, settle] = useIntentKey();
  const [form, setForm] = React.useState<PolicyForm>(() => suggestPolicy(categories, kigaliToday(new Date())));
  // The on-device digest is tied to the version it was computed for, so a later submit can never be compared with an earlier digest.
  const [checked, setChecked] = React.useState<{ readonly version: number; readonly digest: string | null } | null>(null);
  const [savedTick, setSavedTick] = React.useState(0);
  const issues = React.useMemo(() => validatePolicy(form, categories), [form, categories]);
  const cmd = React.useMemo(() => (issues.length === 0 ? toPolicyCommand(code, form, categories) : null), [issues, code, form, categories]);
  const previous = React.useMemo(() => lastSubmitted(code), [code, savedTick]);
  const changes = React.useMemo(() => (cmd === null ? [] : diffPolicy(previous, cmd)), [previous, cmd]);
  const done = create.data?.result;

  const submit = async (): Promise<void> => {
    if (cmd === null) return;
    try {
      const r = await create.mutateAsync({ input: cmd, idempotencyKey: keyFor(cmd) });
      settle();
      remember(code, cmd);
      setSavedTick((n) => n + 1);
      setChecked({ version: r.result.policyVersion, digest: await policyDigest(cmd) });
    } catch (e) { settle(e); /* rendered below */ }
  };
  const p = detail.policy;
  return (
    <Stack space="space.200">
      <Heading size="medium" as="h2">{t('campaigns.policy.title')}</Heading>
      <Text as="p">{t('campaigns.policy.lead')}</Text>
      {p !== null ? (
        <SectionMessage appearance="information" title={t('campaigns.policy.current', { version: p.versionNumber })} testId="policy-current" headingLevel="h3">
          <Stack space="space.050">
            <Text size="small">{t('campaigns.policy.legalBasis')}: {p.legalBasisCode}</Text>
            <Text size="small">{t('campaigns.policy.hash')}:</Text>
            <Wrap><Text size="small" testId="policy-hash">{p.policyHash}</Text></Wrap>
          </Stack>
        </SectionMessage>
      ) : <SectionMessage appearance="warning" testId="policy-none"><Text as="p">{t('campaigns.policy.none')}</Text></SectionMessage>}
      {!editable && <Text as="p" color="color.text.subtle">{t(detail.summary.status === 'DRAFT' ? 'campaigns.noPermission' : 'campaigns.frozen')}</Text>}
      {editable && (
        <>
          <SectionMessage appearance="warning" testId="policy-suggestion-notice"><Text as="p">{t('campaigns.policy.suggestionNotice')}</Text></SectionMessage>
          <Panel>
            <Stack space="space.150">
              <Heading size="small" as="h3">{t('campaigns.policy.legalBasis')}</Heading>
              <Inline space="space.200" shouldWrap>
                <Field label={t('campaigns.policy.legalBasisCode')} hint={t('campaigns.policy.legalBasisCodeHint', { example: SUGGESTION_LEGAL_BASIS_CODE })} testId="legalBasisCode">
                  <Textfield name="legalBasisCode" aria-label={t('campaigns.policy.legalBasisCode')} value={form.legalBasisCode} onChange={(e) => setForm({ ...form, legalBasisCode: (e.target as HTMLInputElement).value })} />
                </Field>
                <Field label={t('campaigns.policy.legalBasisReference')} hint={t('campaigns.policy.legalBasisReferenceHint')} testId="legalBasisReference">
                  <Textfield name="legalBasisReference" aria-label={t('campaigns.policy.legalBasisReference')} value={form.legalBasisReference} onChange={(e) => setForm({ ...form, legalBasisReference: (e.target as HTMLInputElement).value })} />
                </Field>
              </Inline>
            </Stack>
          </Panel>
          {categories.map((c) => (
            <CategoryCard key={c} category={c} t={t} value={form.categories[c] as CategoryPolicyForm}
              onChange={(v) => setForm({ ...form, categories: { ...form.categories, [c]: v } })} />
          ))}
          <Panel testId="policy-diff">
            <Stack space="space.100">
              <Heading size="small" as="h3">{t('campaigns.policy.diffTitle')}</Heading>
              <Text size="small" color="color.text.subtle">{t(previous === null ? 'campaigns.policy.diffFirst' : 'campaigns.policy.diffBasis')}</Text>
              {cmd === null ? <Text size="small">{t('campaigns.policy.incomplete', { count: issues.length })}</Text>
                : changes.length === 0 ? <Text size="small">{t('campaigns.policy.noChanges')}</Text>
                : changes.map((c) => <Text size="small" key={c.path}>{c.path}: {c.before ?? '—'} → {c.after ?? '—'}</Text>)}
            </Stack>
          </Panel>
          {create.isError && <Refusal error={create.error} onStep={onStep} />}
          {done !== undefined && (
            <SectionMessage appearance="success" title={t('campaigns.policy.created', { version: done.policyVersion })} testId="policy-created" headingLevel="h3">
              <Stack space="space.050">
                <Wrap><Text size="small" testId="policy-created-hash">{done.policyHash}</Text></Wrap>
                {create.data?.replayed === true && <Text size="small">{t('campaigns.replayed')}</Text>}
                {checked !== null && checked.version === done.policyVersion && <Text size="small" testId="policy-local-check">{checked.digest === null ? t('campaigns.policy.localUnavailable') : checked.digest === done.policyHash ? t('campaigns.policy.localMatch') : t('campaigns.policy.localMismatch')}</Text>}
              </Stack>
            </SectionMessage>
          )}
          <Inline><Button appearance="primary" isDisabled={cmd === null || create.isPending} onClick={() => void submit()} testId="create-policy">{t('campaigns.policy.submit')}</Button></Inline>
        </>
      )}
    </Stack>
  );
}
