import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import TextField from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { ApiError, activateOfficer, type ApiClient } from '@usrp/api-client';
import { useTranslation } from '@usrp/i18n';
import { Link } from 'react-router-dom';
import { MIN_PASSWORD, normaliseHandle, passwordProblem } from '../model/staff.ts';

const styles = cssMap({
  page: { display: 'flex', justifyContent: 'center', paddingBlock: token('space.600'), paddingInline: token('space.300') },
  card: { width: '100%', maxWidth: '440px', padding: token('space.400'), borderRadius: token('radius.medium'), boxShadow: token('elevation.shadow.raised') },
});

/**
 * An officer redeems the one-time code a second administrator released to them
 * and sets their own password. One indistinguishable refusal for every wrong
 * handle, code, expiry or reuse (no enumeration).
 */
export function ActivatePage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('identity');
  const [handle, setHandle] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<'idle' | 'done' | 'rejected' | 'weak' | 'failed'>('idle');

  const h = normaliseHandle(handle);
  const problem = passwordProblem(password, confirm);
  const submit = async (): Promise<void> => {
    if (h === null || problem !== null || code.trim() === '') return;
    setBusy(true);
    try {
      await activateOfficer(client, { loginHandle: h, activationCode: code.trim(), password });
      setPassword('');
      setConfirm('');
      setCode('');
      setResult('done');
    } catch (e) {
      const n = e instanceof ApiError ? e.normalised : null;
      setResult(n?.kind === 'badRequest' && n.code === 'WEAK_PASSWORD' ? 'weak' : n?.kind === 'unauthenticated' || (n !== null && 'status' in n && n.status === 401) ? 'rejected' : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box xcss={styles.page}>
      <Box xcss={styles.card} backgroundColor="color.background.input">
        <Stack space="space.300">
          <Heading size="large" as="h1">{t('identity.activate.title')}</Heading>
          {result === 'done' ? (
            <>
              <SectionMessage appearance="success" testId="activate-done"><Text as="p">{t('identity.activate.done')}</Text></SectionMessage>
              <Inline><Link to="/login">{t('identity.activate.signIn')}</Link></Inline>
            </>
          ) : (
            <>
              <Text as="p">{t('identity.activate.lead')}</Text>
              {result === 'rejected' && <SectionMessage appearance="error" testId="activate-rejected"><Text as="p">{t('identity.activate.rejected')}</Text></SectionMessage>}
              {result === 'weak' && <SectionMessage appearance="error"><Text as="p">{t('identity.activate.weak', { min: MIN_PASSWORD })}</Text></SectionMessage>}
              {result === 'failed' && <SectionMessage appearance="error"><Text as="p">{t('identity.activate.failed')}</Text></SectionMessage>}
              <Stack space="space.150">
                <Stack space="space.050"><Text size="small" weight="medium" as="span">{t('identity.activate.handle')}</Text><TextField name="loginHandle" aria-label={t('identity.activate.handle')} autoComplete="username" value={handle} onChange={(e) => setHandle((e.target as HTMLInputElement).value)} /></Stack>
                <Stack space="space.050"><Text size="small" weight="medium" as="span">{t('identity.activate.code')}</Text><TextField name="activationCode" aria-label={t('identity.activate.code')} autoComplete="one-time-code" value={code} onChange={(e) => setCode((e.target as HTMLInputElement).value)} /></Stack>
                <Stack space="space.050"><Text size="small" weight="medium" as="span">{t('identity.activate.password')}</Text><TextField name="password" type="password" aria-label={t('identity.activate.password')} autoComplete="new-password" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} /></Stack>
                <Stack space="space.050"><Text size="small" weight="medium" as="span">{t('identity.activate.confirm')}</Text><TextField name="confirmPassword" type="password" aria-label={t('identity.activate.confirm')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm((e.target as HTMLInputElement).value)} /></Stack>
                {password !== '' && problem !== null && <Text size="small" color="color.text.danger">{t(problem === 'SHORT' ? 'identity.activate.weak' : 'identity.activate.mismatch', { min: MIN_PASSWORD })}</Text>}
                <Button appearance="primary" shouldFitContainer isDisabled={busy || h === null || problem !== null || code.trim() === ''} onClick={() => void submit()}>{t('identity.activate.submit')}</Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
