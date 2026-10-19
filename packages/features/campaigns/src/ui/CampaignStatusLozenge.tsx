import React from 'react';
import Lozenge from '@atlaskit/lozenge';
import { useTranslation } from '@usrp/i18n';
import type { CampaignState } from '../model/lifecycle.ts';

const APPEARANCE = {
  DRAFT: 'default',
  REGISTRATION_OPEN: 'success',
  REGISTRATION_CLOSED: 'inprogress',
  COMPLETED: 'new',
  CANCELLED: 'removed',
} as const satisfies Record<CampaignState, 'default' | 'success' | 'inprogress' | 'new' | 'removed'>;

/** A campaign's lifecycle state, as text first (never colour alone). */
export function CampaignStatusLozenge({ state }: { readonly state: CampaignState }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  return <Lozenge appearance={APPEARANCE[state]}>{t(`campaigns.states.${state}`)}</Lozenge>;
}
