// campaigns — step 4: preflight, citizen preview, and publish with the code typed.
import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import { Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { usePublishCampaign, type ApiClient, type CampaignAdminDetail } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { canPublish, preflight, type StudioStep } from '../model/preflight.ts';
import { CitizenPreview } from './CitizenPreview.tsx';
import { Refusal, useIntentKey } from './shared.tsx';
import { TypedConfirm } from './TypedConfirm.tsx';

export function PublishStep({ client, detail, agency, canPublish: allowed, onStep }: {
  readonly client: ApiClient; readonly detail: CampaignAdminDetail; readonly agency: string; readonly canPublish: boolean; readonly onStep: (s: StudioStep) => void;
}): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const publish = usePublishCampaign(client);
  const [keyFor, settle] = useIntentKey();
  const [open, setOpen] = React.useState(false);
  const items = preflight(detail);
  const ready = canPublish(items);
  const code = detail.summary.publicCode;
  const isDraft = detail.summary.status === 'DRAFT';

  const confirm = async (): Promise<void> => {
    const input = { publicCode: code };
    try { await publish.mutateAsync({ input, idempotencyKey: keyFor(input) }); settle(); setOpen(false); } catch (e) { settle(e); /* shown in the dialog */ }
  };
  return (
    <Stack space="space.200">
      <Heading size="medium" as="h2">{t('campaigns.publish.title')}</Heading>
      <Text as="p">{t('campaigns.publish.lead')}</Text>
      <Stack space="space.100" testId="preflight">
        {items.map((i) => (
          <Inline key={i.id} space="space.100" alignBlock="center" testId={`preflight-${i.id}`}>
            <Lozenge appearance={i.ok ? 'success' : 'removed'}>{t(i.ok ? 'campaigns.publish.ok' : 'campaigns.publish.todo')}</Lozenge>
            <Text>{t(`campaigns.publish.checks.${i.id}`, { count: i.count })}</Text>
          </Inline>
        ))}
      </Stack>
      <CitizenPreview detail={detail} agency={agency} />
      {publish.isSuccess && (
        <SectionMessage appearance="success" testId="published-notice"><Text as="p">{t('campaigns.publish.done', { code })}</Text></SectionMessage>
      )}
      {isDraft && !allowed && <Text as="p" color="color.text.subtle">{t('campaigns.noPermission')}</Text>}
      {!isDraft && !publish.isSuccess && <Text as="p" color="color.text.subtle">{t('campaigns.frozen')}</Text>}
      {isDraft && allowed && (
        <Inline><Button appearance="primary" isDisabled={!ready} onClick={() => { publish.reset(); setOpen(true); }} testId="publish-open">{t('campaigns.publish.action')}</Button></Inline>
      )}
      <TypedConfirm
        isOpen={open} isPending={publish.isPending} publicCode={code} title={t('campaigns.publish.confirmTitle', { code })} body={t('campaigns.publish.confirmBody')}
        consequences={[t('campaigns.publish.consequenceFrozen'), t('campaigns.publish.consequenceVisible')]} confirmLabel={t('campaigns.publish.action')}
        error={publish.isError ? <Refusal error={publish.error} onStep={(s) => { setOpen(false); onStep(s); }} /> : undefined}
        onCancel={() => setOpen(false)} onConfirm={() => void confirm()}
      />
    </Stack>
  );
}
