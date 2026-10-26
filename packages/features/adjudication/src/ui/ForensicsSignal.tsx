import React from 'react';
import Lozenge from '@atlaskit/lozenge';
import { Inline, Text } from '@atlaskit/primitives/compiled';
import { useTranslation } from '@usrp/i18n';
import { activeFlags, holdKindOf, signalBand, type AmberRow } from '../model/amber.ts';

const APPEARANCE = { UNSCORED: 'default', WEAKER: 'removed', MIXED: 'moved', CLEANER: 'success' } as const;

/**
 * The forensic signal of a hold, for the OFFICER only (never a citizen screen).
 * No score is a normal answer, not an error: on a document hold it reads "not
 * analysed" (the analyser has not scored it), on an adjudication hold there is
 * no document to analyse. Never colour alone: the band is always words.
 */
export function ForensicsSignal({ row }: { readonly row: AmberRow }): React.ReactElement {
  const { t } = useTranslation('adjudication');
  const band = signalBand(row.forensicsScore);
  if (band === 'UNSCORED') {
    return <Text as="span" testId="forensics-unscored">{t(holdKindOf(row) === 'DOCUMENT' ? 'adjudication.signal.not_analysed' : 'adjudication.signal.no_document_evidence')}</Text>;
  }
  return (
    <Inline space="space.100" testId="forensics-signal">
      <Lozenge appearance={APPEARANCE[band]}>{t(`adjudication.signal.band.${band}`)}</Lozenge>
      <Text as="span">{activeFlags(row.forensicsFlags).join(', ') || t('adjudication.signal.no_flags')}</Text>
    </Inline>
  );
}
