import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import SectionMessage from '@atlaskit/section-message';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { useNavigate } from 'react-router-dom';
import { ApiError, useCreateCampaign, type ApiClient } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { StateBoundary } from '@usrp/ui';
import { EMPTY_DRAFT, categoriesOfAgency, fieldOfServerError, normalisePublicCode, toCreateCommand, validateDraft, type DraftField, type DraftForm } from '../model/draft.ts';
import { DISTRICTS, districtLabel, walkInOffered } from '../model/geography.ts';
import { Field, Refusal, refusalCode, styles, useCampaignPermissions, useIntentKey, type Opt } from './shared.tsx';

export function NewCampaignPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const perms = useCampaignPermissions();
  const navigate = useNavigate();
  const create = useCreateCampaign(client);
  const keyFor = useIntentKey();
  const [form, setForm] = React.useState<DraftForm>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = React.useState(false);
  const set = <K extends DraftField>(k: K, v: DraftForm[K]): void => setForm((f) => ({ ...f, [k]: v }));

  if (!perms.create) return <StateBoundary state="forbidden" />;

  const errors = validateDraft(form, perms.agency);
  const serverField = create.isError ? fieldOfServerError(refusalCode(create.error) ?? '') : null;
  const err = (f: DraftField): string | undefined => {
    const key = errors[f];
    if (submitted && key !== undefined) return t(`campaigns.errors.${key}`);
    if (serverField === f) return t(create.error instanceof ApiError && create.error.normalised.kind === 'conflict' ? `campaigns.refusals.${refusalCode(create.error) ?? 'GENERIC'}` : 'campaigns.errors.serverRejected');
    return undefined;
  };

  const categoryOptions: Opt[] = categoriesOfAgency(perms.agency).map((c) => ({ value: c, label: t(`campaigns.categories.${c}`) }));
  const districtOptions: Opt[] = DISTRICTS.map((d) => ({ value: d, label: districtLabel(d) }));
  const text = (f: 'publicCode' | 'campaignLabel' | 'examinationReportingHour' | 'targetIntakeCount' | 'contactWebsite', props: { type?: string; inputMode?: 'numeric' } = {}): React.ReactElement => (
    <Textfield
      name={f} aria-label={t(`campaigns.fields.${f}`)} value={form[f]} isInvalid={err(f) !== undefined} {...props}
      onChange={(e) => set(f, (e.target as HTMLInputElement).value)}
      onBlur={f === 'publicCode' ? () => set('publicCode', normalisePublicCode(form.publicCode)) : undefined}
    />
  );
  const when = (f: 'registrationOpensAt' | 'registrationClosesAt'): React.ReactElement => (
    <Textfield name={f} type="datetime-local" aria-label={t(`campaigns.fields.${f}`)} value={form[f]} isInvalid={err(f) !== undefined} onChange={(e) => set(f, (e.target as HTMLInputElement).value)} />
  );
  const day = (f: 'examinationStartDate' | 'examinationEndDate'): React.ReactElement => (
    <Textfield name={f} type="date" aria-label={t(`campaigns.fields.${f}`)} value={form[f]} isInvalid={err(f) !== undefined} onChange={(e) => set(f, (e.target as HTMLInputElement).value)} />
  );

  const submit = async (): Promise<void> => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    const input = toCreateCommand(form, perms.agency);
    try {
      await create.mutateAsync({ input, idempotencyKey: keyFor(input) });
      void navigate(`/campaigns/${encodeURIComponent(input.publicCode)}`);
    } catch { /* rendered below, per field where the server named one */ }
  };

  return (
    <Box xcss={styles.root}>
      <Stack space="space.250">
        <Inline><Button appearance="subtle" href="/campaigns">{t('campaigns.new.back')}</Button></Inline>
        <Heading size="xlarge" as="h1">{t('campaigns.new.title')}</Heading>
        <Text as="p">{t('campaigns.new.lead')}</Text>
        <SectionMessage appearance="information" testId="kigali-notice"><Text as="p">{t('campaigns.new.kigaliTime')}</Text></SectionMessage>
        <Box xcss={styles.panel}>
          <Stack space="space.200">
            <Inline space="space.200" shouldWrap>
              <Field label={t('campaigns.fields.publicCode')} hint={t('campaigns.hints.publicCode')} error={err('publicCode')} testId="field-publicCode">{text('publicCode')}</Field>
              <Field label={t('campaigns.fields.campaignLabel')} hint={t('campaigns.hints.campaignLabel', { count: form.campaignLabel.length })} error={err('campaignLabel')} testId="field-campaignLabel">{text('campaignLabel')}</Field>
            </Inline>
            <Field label={t('campaigns.fields.targetCategories')} hint={t('campaigns.hints.targetCategories', { agency: perms.agency })} error={err('targetCategories')} testId="field-targetCategories">
              <Select<Opt, true> isMulti inputId="targetCategories" aria-label={t('campaigns.fields.targetCategories')} options={categoryOptions}
                value={categoryOptions.filter((o) => form.targetCategories.includes(o.value))} onChange={(sel) => set('targetCategories', sel.map((o) => o.value))} placeholder={t('campaigns.choose')} />
            </Field>
            <Field label={t('campaigns.fields.targetDistricts')} hint={t('campaigns.hints.targetDistricts')} error={err('targetDistricts')} testId="field-targetDistricts">
              <Select<Opt, true> isMulti inputId="targetDistricts" aria-label={t('campaigns.fields.targetDistricts')} options={districtOptions}
                value={districtOptions.filter((o) => form.targetDistricts.includes(o.value))} onChange={(sel) => set('targetDistricts', sel.map((o) => o.value))} placeholder={t('campaigns.choose')} />
            </Field>
            <Inline space="space.200" shouldWrap>
              <Field label={t('campaigns.fields.registrationOpensAt')} error={err('registrationOpensAt')} testId="field-registrationOpensAt">{when('registrationOpensAt')}</Field>
              <Field label={t('campaigns.fields.registrationClosesAt')} error={err('registrationClosesAt')} testId="field-registrationClosesAt">{when('registrationClosesAt')}</Field>
            </Inline>
            <Inline space="space.200" shouldWrap>
              <Field label={t('campaigns.fields.examinationStartDate')} error={err('examinationStartDate')} testId="field-examinationStartDate">{day('examinationStartDate')}</Field>
              <Field label={t('campaigns.fields.examinationEndDate')} error={err('examinationEndDate')} testId="field-examinationEndDate">{day('examinationEndDate')}</Field>
              <Field label={t('campaigns.fields.examinationReportingHour')} hint={t('campaigns.hints.reportingHour')} error={err('examinationReportingHour')} testId="field-examinationReportingHour">{text('examinationReportingHour', { inputMode: 'numeric' })}</Field>
            </Inline>
            <Inline space="space.200" shouldWrap>
              <Field label={t('campaigns.fields.targetIntakeCount')} hint={t('campaigns.hints.optional')} error={err('targetIntakeCount')} testId="field-targetIntakeCount">{text('targetIntakeCount', { inputMode: 'numeric' })}</Field>
              {walkInOffered(perms.agency) && (
                <Field label={t('campaigns.fields.allowsWalkIn')} hint={t('campaigns.hints.walkIn')} error={err('allowsWalkIn')} testId="field-allowsWalkIn">
                  <Select<Opt> inputId="allowsWalkIn" aria-label={t('campaigns.fields.allowsWalkIn')}
                    options={[{ value: 'no', label: t('campaigns.no') }, { value: 'yes', label: t('campaigns.yes') }]}
                    value={{ value: form.allowsWalkIn ? 'yes' : 'no', label: form.allowsWalkIn ? t('campaigns.yes') : t('campaigns.no') }}
                    onChange={(o) => set('allowsWalkIn', o?.value === 'yes')} />
                </Field>
              )}
            </Inline>
            <Inline space="space.200" shouldWrap>
              <Field label={t('campaigns.fields.contactPhoneNumbers')} hint={t('campaigns.hints.phones')} error={err('contactPhoneNumbers')} testId="field-contactPhoneNumbers">
                <Textfield name="contactPhoneNumbers" aria-label={t('campaigns.fields.contactPhoneNumbers')} value={form.contactPhoneNumbers.split('\n').join(', ')}
                  onChange={(e) => set('contactPhoneNumbers', (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).join('\n'))} />
              </Field>
              <Field label={t('campaigns.fields.contactWebsite')} hint={t('campaigns.hints.optional')} error={err('contactWebsite')} testId="field-contactWebsite">{text('contactWebsite', { type: 'url' })}</Field>
            </Inline>
            {create.isError && serverField === null && <Refusal error={create.error} />}
            <Inline space="space.100" alignBlock="center">
              <Button appearance="primary" isDisabled={create.isPending} onClick={() => void submit()} testId="create-draft">{t('campaigns.new.submit')}</Button>
              <Text size="small" color="color.text.subtle">{t('campaigns.new.next')}</Text>
            </Inline>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
