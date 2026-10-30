// campaigns — step 3: one session per target district, with an honest coverage meter.
import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { useConfigureCampaignSession, type ApiClient, type CampaignAdminDetail, type CampaignSessionOccupancy } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { districtLabel } from '../model/geography.ts';
import { daysBetween } from '../model/kigali.ts';
import type { StudioStep } from '../model/preflight.ts';
import { EMPTY_SESSION, coverageOf, sessionFormOf, toSessionCommand, validateSession, type SessionForm } from '../model/sessions.ts';
import { Field, Refusal, useIntentKey, type Opt, Panel } from './shared.tsx';

// The track is a non-interactive progress indicator, not a control.
const meterStyles = cssMap({
  track: {
    // eslint-disable-next-line usrp/min-touch-target -- a non-interactive progress track, not a control
    height: '8px', backgroundColor: token('color.background.neutral'), borderRadius: token('radius.small'), overflow: 'hidden',
  },
  full: { flexGrow: 1, backgroundColor: token('color.background.success.bold') },
  part: { flexGrow: 1, backgroundColor: token('color.background.warning.bold') },
  empty: { flexGrow: 1 },
});

function Meter({ covered, total, label }: { readonly covered: number; readonly total: number; readonly label: string }): React.ReactElement {
  const steps = Math.min(total, 30);
  return (
    <Stack space="space.050">
      <Text weight="medium" testId="coverage-text">{label}</Text>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={covered} aria-label={label} data-testid="coverage-meter">
        <Box xcss={meterStyles.track}>
          <Inline space="space.0">
            {Array.from({ length: steps }, (_, i) => <Box key={i} xcss={i < covered ? (covered === total ? meterStyles.full : meterStyles.part) : meterStyles.empty}>{'\u00a0'}</Box>)}
          </Inline>
        </Box>
      </div>
    </Stack>
  );
}

function DistrictRow({ client, detail, district, existing, canWrite, onStep }: {
  readonly client: ApiClient; readonly detail: CampaignAdminDetail; readonly district: string; readonly existing: CampaignSessionOccupancy | undefined; readonly canWrite: boolean; readonly onStep: (s: StudioStep) => void;
}): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const save = useConfigureCampaignSession(client);
  const [keyFor, settle] = useIntentKey();
  const [form, setForm] = React.useState<SessionForm>(() => (existing === undefined ? EMPTY_SESSION : sessionFormOf(existing)));
  const [tried, setTried] = React.useState(false);
  const s = detail;
  const days = daysBetween(s.examinationStartDate, s.examinationEndDate);
  const errors = validateSession(form, { start: s.examinationStartDate, end: s.examinationEndDate });
  const err = (f: keyof typeof errors): string | undefined => (tried && errors[f] !== undefined ? t(`campaigns.errors.${errors[f]}`) : undefined);
  const set = (patch: Partial<SessionForm>): void => { setForm({ ...form, ...patch }); save.reset(); };
  const editable = canWrite && s.status === 'DRAFT';
  // A stored date outside the generated list (it can only come from the server) is still shown, never blanked.
  const dayOptions: Opt[] = (form.examDate !== '' && !days.includes(form.examDate) ? [...days, form.examDate] : days).map((d) => ({ value: d, label: d }));
  const activeOptions: Opt[] = [{ value: 'yes', label: t('campaigns.sessions.active') }, { value: 'no', label: t('campaigns.sessions.inactive') }];
  const modeOptions: Opt[] = [{ value: 'BOUNDED', label: t('campaigns.sessions.bounded') }, { value: 'UNBOUNDED', label: t('campaigns.sessions.unbounded') }];
  const name = districtLabel(district);

  const submit = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(errors).length > 0) return;
    const input = toSessionCommand(s.publicCode, district, form);
    try { await save.mutateAsync({ input, idempotencyKey: keyFor(input) }); settle(); } catch (e) { settle(e); }
  };
  if (!editable) {
    return (
      <Panel testId={`session-${district}`}>
        <Stack space="space.050">
          <Heading size="small" as="h3">{name}</Heading>
          {existing === undefined ? <Text size="small" color="color.text.warning">{t('campaigns.sessions.none')}</Text> : (
            <Text size="small">{existing.venueName} · {existing.examDate} · {t('campaigns.sessions.hour')} {existing.reportingTimeHour} · {existing.capacityLimit === null ? t('campaigns.sessions.unbounded') : t('campaigns.sessions.capacityOf', { registered: existing.registeredCount, capacity: existing.capacityLimit })}</Text>
          )}
        </Stack>
      </Panel>
    );
  }
  return (
    <Panel testId={`session-${district}`}>
      <Stack space="space.150">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="small" as="h3">{name}</Heading>
          <Text size="small" color={existing?.isActive === true ? 'color.text.success' : 'color.text.warning'}>
            {existing === undefined ? t('campaigns.sessions.none') : t('campaigns.sessions.registered', { count: existing.registeredCount })}
          </Text>
        </Inline>
        <Inline space="space.200" shouldWrap alignBlock="start">
          <Field label={t('campaigns.sessions.venue')} error={err('venueName')}>
            <Textfield name={`${district}-venue`} aria-label={`${t('campaigns.sessions.venue')} (${name})`} value={form.venueName} onChange={(e) => set({ venueName: (e.target as HTMLInputElement).value })} />
          </Field>
          <Field label={t('campaigns.sessions.examDate')} error={err('examDate')}>
            <Select<Opt> inputId={`${district}-date`} aria-label={`${t('campaigns.sessions.examDate')} (${name})`} options={dayOptions}
              value={dayOptions.find((o) => o.value === form.examDate) ?? null} onChange={(o) => { if (o !== null) set({ examDate: o.value }); }} placeholder={t('campaigns.choose')} />
          </Field>
          <Field label={t('campaigns.sessions.hour')} error={err('reportingTimeHour')} grow={false}>
            <Textfield name={`${district}-hour`} inputMode="numeric" aria-label={`${t('campaigns.sessions.hour')} (${name})`} value={form.reportingTimeHour} onChange={(e) => set({ reportingTimeHour: (e.target as HTMLInputElement).value })} />
          </Field>
        </Inline>
        <Inline space="space.200" shouldWrap alignBlock="start">
          <Field label={t('campaigns.sessions.capacityMode')} hint={form.capacityMode === 'UNBOUNDED' ? t('campaigns.sessions.unboundedHint') : undefined}>
            <Select<Opt> inputId={`${district}-mode`} aria-label={`${t('campaigns.sessions.capacityMode')} (${name})`} options={modeOptions}
              value={modeOptions.find((o) => o.value === form.capacityMode) ?? null} onChange={(o) => { if (o !== null) set({ capacityMode: o.value as SessionForm['capacityMode'] }); }} />
          </Field>
          {form.capacityMode === 'BOUNDED' && (
            <Field label={t('campaigns.sessions.capacity')} error={err('capacityLimit')} grow={false}>
              <Textfield name={`${district}-capacity`} inputMode="numeric" aria-label={`${t('campaigns.sessions.capacity')} (${name})`} value={form.capacityLimit} onChange={(e) => set({ capacityLimit: (e.target as HTMLInputElement).value })} />
            </Field>
          )}
        </Inline>
        <Field label={t('campaigns.sessions.status')} hint={t('campaigns.sessions.statusHint')}>
          <Select<Opt> inputId={`${district}-active`} aria-label={`${t('campaigns.sessions.status')} (${name})`} options={activeOptions}
            value={activeOptions.find((o) => o.value === (form.isActive ? 'yes' : 'no')) ?? null} onChange={(o) => { if (o !== null) set({ isActive: o.value === 'yes' }); }} />
        </Field>
        {save.isError && <Refusal error={save.error} onStep={onStep} testId={`session-refusal-${district}`} />}
        {save.isSuccess && <Text size="small" color="color.text.success" testId={`session-saved-${district}`}>{t(save.data.replayed ? 'campaigns.replayed' : save.data.result.status === 'SESSION_UNCHANGED' ? 'campaigns.sessions.unchanged' : 'campaigns.sessions.saved')}</Text>}
        {<Inline><Button appearance="primary" isDisabled={save.isPending} aria-label={`${t('campaigns.sessions.save')}: ${name}`} onClick={() => void submit()}>{t('campaigns.sessions.save')}</Button></Inline>}
      </Stack>
    </Panel>
  );
}

export function SessionsStep({ client, detail, canWrite, onStep }: { readonly client: ApiClient; readonly detail: CampaignAdminDetail; readonly canWrite: boolean; readonly onStep: (s: StudioStep) => void }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const cov = coverageOf(detail.targetDistricts, detail.sessions);
  return (
    <Stack space="space.200">
      <Heading size="medium" as="h2">{t('campaigns.sessions.title')}</Heading>
      <Text as="p">{t('campaigns.sessions.lead')}</Text>
      <Meter covered={cov.covered.length} total={cov.total} label={t('campaigns.sessions.coverage', { covered: cov.covered.length, total: cov.total })} />
      {cov.missing.length > 0 && <Text size="small" color="color.text.warning" testId="coverage-missing">{t('campaigns.sessions.missing', { districts: cov.missing.map(districtLabel).join(', ') })}</Text>}
      {detail.targetDistricts.map((d) => (
        <DistrictRow key={d} client={client} detail={detail} district={d} existing={detail.sessions.find((s) => s.district === d)} canWrite={canWrite} onStep={onStep} />
      ))}
    </Stack>
  );
}
