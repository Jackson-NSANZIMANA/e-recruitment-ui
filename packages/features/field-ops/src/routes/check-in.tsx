// ══════════════════════════════════════════════════════════════════
// field-ops — Biometric check-in (S08 addendum, ADR-037)
//
// EVIDENCE ONLY. The policy is read from the edge (getBiometricPolicy). In OFF
// and SHADOW nothing is captured or shown: the gate admits by QR plus the typed
// national ID, and a NO_MATCH is never a refusal; it goes to the supervised
// manual lane. Capture itself is B2; this page tells the officer which mode is
// live and where manual identity is done.
// ══════════════════════════════════════════════════════════════════

import React from 'react';
import { Box, Stack, Text } from '@atlaskit/primitives/compiled';
import LinkButton from '@atlaskit/button/link';
import Button from '@atlaskit/button';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import { getBiometricPolicy, type ApiClient } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { useEdgeRead } from '../runtime/hooks.ts';
import { StationPage } from '../ui/Page.tsx';

export default function CheckInPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const { load, reload } = useEdgeRead(() => getBiometricPolicy(client), 'policy');
  return (
    <StationPage title={t('field_ops.check_in.title')} intro={t('field_ops.check_in.intro')} testId="check-in-page">
      {load.status === 'loading' && <Text>{t('field_ops.check_in.loading')}</Text>}
      {load.status === 'failed' && (
        <SectionMessage appearance="warning" title={t('field_ops.check_in.failed_title')} headingLevel="h2" testId="check-in-failed">
          <Stack space="space.200"><Text as="p">{t('field_ops.check_in.failed_body')}</Text><Box><Button onClick={reload}>{t('field_ops.supervisor.reload')}</Button></Box></Stack>
        </SectionMessage>
      )}
      {load.status === 'ready' && (
        <Stack space="space.200">
          <Lozenge appearance={load.data.mode === 'ADVISORY' ? 'inprogress' : 'default'} testId="check-in-mode">{t(`field_ops.check_in.mode.${load.data.mode}`)}</Lozenge>
          <Text as="p">{t(`field_ops.check_in.mode_body.${load.data.mode}`)}</Text>
          <Text as="p" color="color.text.subtle">{t('field_ops.check_in.no_match')}</Text>
          <Box><LinkButton appearance="primary" href="/gate">{t('field_ops.check_in.to_gate')}</LinkButton></Box>
        </Stack>
      )}
    </StationPage>
  );
}
