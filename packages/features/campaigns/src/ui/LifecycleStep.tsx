// campaigns — close registration, complete, cancel: each states its consequence
// (counts from the admin read, or "unavailable" — never zero) and needs the code typed.
import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import { Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import {
  useCancelCampaign, useCloseCampaignRegistration, useCompleteCampaign, type ApiClient, type CampaignAdminDetail,
} from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { availableCommands, nextCampaignState, type CampaignState, type LifecycleCommand } from '../model/lifecycle.ts';
import { consequencesOf } from '../model/preflight.ts';
import { Refusal, useIntentKey, type T } from './shared.tsx';
import { TypedConfirm } from './TypedConfirm.tsx';

type Action = Exclude<LifecycleCommand, 'publishCampaign'>;
const KEY: Record<Action, 'close' | 'complete' | 'cancel'> = { closeCampaignRegistration: 'close', completeCampaign: 'complete', cancelCampaign: 'cancel' };

function consequenceLines(action: Action, detail: CampaignAdminDetail, t: T): string[] {
  const c = consequencesOf(detail);
  const registered = c.registered === null ? t('campaigns.lifecycle.unavailable') : String(c.registered);
  const lines = [t(`campaigns.lifecycle.${KEY[action]}.effect`), t('campaigns.lifecycle.registeredCount', { registered })];
  if (action === 'cancelCampaign') lines.push(t('campaigns.lifecycle.cancel.applications'));
  return lines;
}

export function LifecycleStep({ client, detail, allowed }: {
  readonly client: ApiClient; readonly detail: CampaignAdminDetail; readonly allowed: Readonly<Record<Action, boolean>>;
}): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const close = useCloseCampaignRegistration(client);
  const complete = useCompleteCampaign(client);
  const cancel = useCancelCampaign(client);
  const [keyFor, settle] = useIntentKey();
  const [open, setOpen] = React.useState<Action | null>(null);
  const status = detail.status as CampaignState;
  const code = detail.publicCode;
  const actions = availableCommands(status).filter((c): c is Action => c !== 'publishCampaign');
  const mutation = open === 'closeCampaignRegistration' ? close : open === 'completeCampaign' ? complete : cancel;

  const run = async (): Promise<void> => {
    if (open === null) return;
    const input = { publicCode: code };
    try { await mutation.mutateAsync({ input, idempotencyKey: keyFor({ action: open, ...input }) }); settle(); setOpen(null); } catch (e) { settle(e); /* in dialog */ }
  };
  return (
    <Stack space="space.200">
      <Heading size="medium" as="h2">{t('campaigns.lifecycle.title')}</Heading>
      <Text as="p">{t('campaigns.lifecycle.lead')}</Text>
      {actions.length === 0 && <SectionMessage appearance="information" testId="lifecycle-terminal"><Text as="p">{t('campaigns.lifecycle.terminal', { state: t(`campaigns.states.${status}`) })}</Text></SectionMessage>}
      {[close, complete, cancel].some((m) => m.isSuccess) && open === null && (
        <SectionMessage appearance="success" testId="lifecycle-done"><Text as="p">{t('campaigns.lifecycle.done')}</Text></SectionMessage>
      )}
      <Inline space="space.150" shouldWrap>
        {actions.map((a) => (
          <Button key={a} appearance={a === 'cancelCampaign' ? 'danger' : 'primary'} isDisabled={!allowed[a] || nextCampaignState(status, a) === null}
            onClick={() => { close.reset(); complete.reset(); cancel.reset(); setOpen(a); }} testId={`lifecycle-${KEY[a]}`}>
            {t(`campaigns.lifecycle.${KEY[a]}.action`)}
          </Button>
        ))}
      </Inline>
      {actions.some((a) => !allowed[a]) && <Text size="small" color="color.text.subtle">{t('campaigns.noPermission')}</Text>}
      <TypedConfirm
        isOpen={open !== null} isPending={mutation.isPending} publicCode={code}
        title={open === null ? '' : t(`campaigns.lifecycle.${KEY[open]}.title`, { code })} body={open === null ? '' : t(`campaigns.lifecycle.${KEY[open]}.body`)}
        consequences={open === null ? [] : consequenceLines(open, detail, t)} confirmLabel={open === null ? '' : t(`campaigns.lifecycle.${KEY[open]}.action`)}
        appearance={open === 'cancelCampaign' ? 'danger' : 'primary'}
        error={mutation.isError ? <Refusal error={mutation.error} /> : undefined}
        onCancel={() => setOpen(null)} onConfirm={() => void run()}
      />
    </Stack>
  );
}
