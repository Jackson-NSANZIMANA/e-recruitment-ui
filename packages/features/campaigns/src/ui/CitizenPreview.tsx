// campaigns — what a citizen will see once the campaign is published.
// Mirrors the applicant portal's campaign card field for field (PublicCampaign):
// the slices never import each other, so this is a deliberate copy of the layout, fed
// ONLY by fields the public projection carries.
import React from 'react';
import Heading from '@atlaskit/heading';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { useTranslation } from '@usrp/i18n';
import type { CampaignAdminDetail } from '@usrp/api-client';
import { districtLabel } from '../model/geography.ts';
import { formatKigali } from '../model/kigali.ts';
import { Panel } from './shared.tsx';

export function CitizenPreview({ detail, agency }: { readonly detail: CampaignAdminDetail; readonly agency: string }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const s = detail;
  return (
    <Panel testId="citizen-preview">
      <Stack space="space.100">
        <Text size="small" color="color.text.subtle">{t('campaigns.preview.badge')}</Text>
        <Heading size="medium" as="h3">{s.campaignLabel}</Heading>
        <Text size="small" color="color.text.subtle">{agency} · {s.publicCode}</Text>
        <Text size="small">{t('campaigns.preview.registration')}: {formatKigali(s.registrationOpensAt)} → {formatKigali(s.registrationClosesAt)}</Text>
        <Text size="small">{t('campaigns.preview.exam')}: {s.examinationStartDate} → {s.examinationEndDate}</Text>
        <Text size="small">{t('campaigns.preview.categories')}: {s.targetCategories.map((c) => t(`campaigns.categories.${c}`, { defaultValue: c })).join(', ')}</Text>
        <Text size="small">{t('campaigns.preview.districts')}: {s.targetDistricts.map(districtLabel).join(', ')}</Text>
        {s.allowsWalkIn && <Text size="small">{t('campaigns.preview.walkIn')}</Text>}
        {((detail.contactPhoneNumbers?.length ?? 0) > 0 || detail.contactWebsite !== null) && (
          <Inline space="space.100" shouldWrap><Text size="small">{t('campaigns.preview.contact')}: {[...(detail.contactPhoneNumbers ?? []), detail.contactWebsite].filter((x): x is string => x !== null).join(' · ')}</Text></Inline>
        )}
      </Stack>
    </Panel>
  );
}
