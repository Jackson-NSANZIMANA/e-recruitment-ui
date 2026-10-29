import React from 'react';
import Lozenge from '@atlaskit/lozenge';
import { useTranslation } from '@usrp/i18n';
import type { CampaignState } from '../model/lifecycle.ts';

const APPEARANCE: Readonly<Record<string, 'default' | 'success' | 'inprogress' | 'new' | 'removed'>> = {
  DRAFT: 'default',
  REGISTRATION_OPEN: 'success',
  REGISTRATION_CLOSED: 'inprogress',
  COMPLETED: 'new',
  CANCELLED: 'removed',
  // Legacy value the backend still carries for pre-BUILD-001 rows; read-only here.
  EXAMINATION_ACTIVE: 'inprogress',
};

/** A campaign's lifecycle state, as text first (never colour alone). */
export function CampaignStatusLozenge({ state }: { readonly state: CampaignState | 'EXAMINATION_ACTIVE' }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  return <Lozenge appearance={APPEARANCE[state] ?? 'default'}>{t(`campaigns.states.${state}`)}</Lozenge>;
}
