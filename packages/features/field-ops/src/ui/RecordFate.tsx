import React from 'react';
import Lozenge from '@atlaskit/lozenge';
import { useTranslation } from '@usrp/i18n';
import type { SyncState } from '@usrp/field-ledger';
import { fateOf, type RecordFate } from '../model/field-sync.ts';

const APPEARANCE: Readonly<Record<RecordFate, 'success' | 'inprogress' | 'removed' | 'moved' | 'default'>> = {
  ACKNOWLEDGED: 'success', DUPLICATE: 'success', RESOLVED: 'success', SENDING: 'inprogress', WAITING: 'moved', CONFLICT: 'removed', WITH_SUPERVISOR: 'removed', REFUSED: 'removed',
};

/** The one place a record's state is worded. Only the green fates mean "the server has it". */
export function RecordFateLozenge({ state }: { readonly state: SyncState }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const fate = fateOf(state);
  const label: Record<RecordFate, string> = {
    ACKNOWLEDGED: t('field_ops.fate.ACKNOWLEDGED'), DUPLICATE: t('field_ops.fate.DUPLICATE'), RESOLVED: t('field_ops.fate.RESOLVED'),
    SENDING: t('field_ops.fate.SENDING'), WAITING: t('field_ops.fate.WAITING'), CONFLICT: t('field_ops.fate.CONFLICT'),
    WITH_SUPERVISOR: t('field_ops.fate.WITH_SUPERVISOR'), REFUSED: t('field_ops.fate.REFUSED'),
  };
  return <Lozenge appearance={APPEARANCE[fate]} testId={`fate-${fate}`}>{label[fate]}</Lozenge>;
}
