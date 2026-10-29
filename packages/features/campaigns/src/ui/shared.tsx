// campaigns — pieces every Studio step shares: the field wrapper, the refusal
// message, the per-intent Idempotency-Key, and the permission set.
import React from 'react';
import SectionMessage from '@atlaskit/section-message';
import Button from '@atlaskit/button/new';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { ApiError } from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { campaignRefusal } from '../api/campaigns.ts';
import { keyForIntent, type IntentKey } from '../model/intent.ts';
import { stepOfRefusal, type StudioStep } from '../model/preflight.ts';

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
  panel: { padding: token('space.200'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') },
  field: { minWidth: '240px', flexGrow: 1 },
  narrow: { minWidth: '120px', maxWidth: '160px' },
  hash: { overflowWrap: 'anywhere' },
});

/** Page container. */
export function Page({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <Box xcss={styles.root}>{children}</Box>;
}
/** A bordered group of related fields. */
export function Panel({ children, testId }: { readonly children: React.ReactNode; readonly testId?: string }): React.ReactElement {
  return <Box xcss={styles.panel} {...(testId === undefined ? {} : { testId })}>{children}</Box>;
}
/** Text that may be a long unbroken value (a SHA-256). */
export function Wrap({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <Box xcss={styles.hash}>{children}</Box>;
}
/** A grow-to-fit cell in a wrapping row. */
export function Cell({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <Box xcss={styles.field}>{children}</Box>;
}

export type T = ReturnType<typeof useTranslation>['t'];

export interface Opt { readonly value: string; readonly label: string }

/** A labelled control with its hint and its error, wired for assistive technology. */
export function Field({ label, hint, error, children, testId, grow = true }: {
  readonly label: string; readonly hint?: string | undefined; readonly error?: string | undefined; readonly children: React.ReactNode; readonly testId?: string; readonly grow?: boolean;
}): React.ReactElement {
  return (
    <Box xcss={grow ? styles['field'] : styles['narrow']} {...(testId === undefined ? {} : { testId })}>
      <Stack space="space.050">
        <Text size="small" weight="medium" as="span">{label}</Text>
        {children}
        {hint !== undefined && error === undefined && <Text size="small" color="color.text.subtle">{hint}</Text>}
        {error !== undefined && <Text size="small" color="color.text.danger" {...(testId === undefined ? {} : { testId: `${testId}-error` })}>{error}</Text>}
      </Stack>
    </Box>
  );
}

/** The officer's campaign permissions. A display convenience: the edge and services re-check every call. */
export function useCampaignPermissions(): {
  readonly agency: string; readonly read: boolean; readonly create: boolean; readonly policy: boolean; readonly session: boolean;
  readonly publish: boolean; readonly close: boolean; readonly complete: boolean; readonly cancel: boolean;
} {
  const session = useOfficerSession();
  const p = session?.permissions ?? [];
  const has = (name: string): boolean => p.includes(name);
  return {
    agency: session?.agency ?? '',
    read: has('campaign.read.admin'), create: has('campaign.create'), policy: has('campaign.policy.create'), session: has('campaign.session.configure'),
    publish: has('campaign.publish'), close: has('campaign.registration.close'), complete: has('campaign.complete'), cancel: has('campaign.cancel'),
  };
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  throw new Error('crypto.randomUUID is unavailable: refusing to mint an Idempotency-Key from Math.random');
}

/**
 * One Idempotency-Key per officer intent: the same body keeps its key across
 * retries (so a lost response replays instead of duplicating), a changed body
 * mints a new one. The returned function is stable across renders.
 */
export function useIntentKey(): (body: unknown) => string {
  const ref = React.useRef<IntentKey | null>(null);
  return React.useCallback((body: unknown) => {
    ref.current = keyForIntent(ref.current, body, newUuid);
    return ref.current.key;
  }, []);
}

/** The server's refusal code for an error, or null for an infrastructure fault. */
export function refusalCode(error: unknown): string | null {
  const refusal = campaignRefusal(error);
  if (refusal !== null) return refusal.code;
  if (error instanceof ApiError && error.normalised.kind === 'badRequest') return error.normalised.code;
  return null;
}

/** Why a write was refused, in the officer's language, with the step to return to when there is one. */
export function Refusal({ error, onStep, testId = 'campaign-refusal' }: { readonly error: unknown; readonly onStep?: ((step: StudioStep) => void) | undefined; readonly testId?: string }): React.ReactElement {
  const { t } = useTranslation('campaigns');
  const refusal = campaignRefusal(error);
  const code = refusalCode(error);
  const step = code === null ? null : stepOfRefusal(code);
  const forbidden = error instanceof ApiError && error.normalised.kind === 'forbidden';
  const detail = error instanceof ApiError && error.normalised.kind === 'badRequest' ? error.normalised.detail : null;
  const text = forbidden ? t('campaigns.refusals.FORBIDDEN')
    : refusal !== null ? t(refusal.key)
    : detail !== null ? t('campaigns.refusals.REJECTED', { detail })
    : t('campaigns.refusals.GENERIC');
  return (
    <SectionMessage appearance="error" testId={testId}>
      <Stack space="space.100">
        <Text as="p">{text}</Text>
        {code !== null && <Text size="small" color="color.text.subtle">{code}</Text>}
        {step !== null && onStep !== undefined && (
          <Inline><Button onClick={() => onStep(step)}>{t('campaigns.refusals.goToStep', { step: t(`campaigns.steps.${step}`) })}</Button></Inline>
        )}
      </Stack>
    </SectionMessage>
  );
}
