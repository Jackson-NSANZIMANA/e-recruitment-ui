import React from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import Heading from '@atlaskit/heading';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import TextField from '@atlaskit/textfield';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import {
  ApiError,
  ASSIGNABLE_POSTS,
  ASSIGN_POSTS_REASONS,
  DISABLE_REASONS,
  ENABLE_REASONS,
  REVOKE_SESSIONS_REASONS,
  httpStatusOf,
  useAssignPosts,
  useCreateOfficer,
  useDisableOfficer,
  useEnableOfficer,
  useOfficers,
  useReissueActivation,
  useReleaseActivation,
  useRevokeSessions,
  type ApiClient,
  type OfficerRow,
} from '@usrp/api-client';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { ConfirmAction, FreshnessStamp, StateBoundary, listState } from '@usrp/ui';
import { addedPermissions, grantsDecisionAuthority, permissionsOfPosts } from '../model/role-table.ts';
import { activationView, normaliseHandle, readOwnHandle, rowActions, rowLock } from '../model/staff.ts';
import { ReleaseDialog } from './ReleaseDialog.tsx';

const styles = cssMap({
  root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock: token('space.300'), paddingInline: token('space.400') },
  panel: { padding: token('space.200'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') },
  field: { minWidth: '240px' },
  wide: { minWidth: '320px' },
});

type T = ReturnType<typeof useTranslation>['t'];

interface Opt { readonly value: string; readonly label: string }

type Dialog =
  | { readonly kind: 'assign'; readonly row: OfficerRow }
  | { readonly kind: 'disable' | 'enable' | 'revoke'; readonly row: OfficerRow }
  | { readonly kind: 'reissue'; readonly row: OfficerRow };

function refusalText(error: unknown, t: T): string {
  if (error instanceof ApiError) {
    const n = error.normalised;
    const code = n.kind === 'forbidden' ? n.code : n.kind === 'conflict' || n.kind === 'unprocessable' ? n.outcome : n.kind === 'notFound' ? 'NOT_FOUND' : null;
    if (code !== null) return t(`identity.staff.refusals.${code}`, { defaultValue: t('identity.staff.refusals.GENERIC', { code }) });
  }
  return t('identity.staff.refusals.GENERIC', { code: 'ERROR' });
}

function Refusal({ error, t }: { readonly error: unknown; readonly t: T }): React.ReactElement {
  return <SectionMessage appearance="error" testId="staff-refusal"><Text as="p">{refusalText(error, t)}</Text></SectionMessage>;
}

function PostsPicker({ value, onChange, t }: { readonly value: readonly string[]; readonly onChange: (v: readonly string[]) => void; readonly t: T }): React.ReactElement {
  const options: Opt[] = ASSIGNABLE_POSTS.map((p) => ({ value: p, label: t(`identity.staff.posts.${p}`) }));
  return (
    <Select<Opt, true>
      isMulti
      inputId="staff-posts"
      aria-label={t('identity.staff.postsLabel')}
      options={options}
      value={options.filter((o) => value.includes(o.value))}
      onChange={(sel) => onChange(sel.map((o) => o.value))}
      placeholder={t('identity.staff.postsPlaceholder')}
    />
  );
}

function PermissionPreview({ posts, before, t }: { readonly posts: readonly string[]; readonly before?: readonly string[]; readonly t: T }): React.ReactElement | null {
  const granted = before === undefined ? permissionsOfPosts(posts) : addedPermissions(before, posts);
  if (posts.length === 0) return null;
  return (
    <Stack space="space.050" testId="permission-preview">
      <Text size="small" weight="medium">{t(before === undefined ? 'identity.staff.grants' : 'identity.staff.grantsNew')}</Text>
      <Text size="small" color="color.text.subtle">{granted.length === 0 ? t('identity.staff.grantsNone') : granted.map((p) => t(`identity.staff.operations.${p}`, { defaultValue: p })).join(' · ')}</Text>
      {grantsDecisionAuthority(posts) && (before === undefined || !before.includes('decision_authority')) && (
        <Text size="small" color="color.text.warning" testId="decision-authority-warning">{t('identity.staff.decisionAuthorityNotice')}</Text>
      )}
    </Stack>
  );
}

function ReasonSelect({ reasons, group, value, onChange, t }: { readonly reasons: readonly string[]; readonly group: string; readonly value: string | null; readonly onChange: (v: string) => void; readonly t: T }): React.ReactElement {
  const options: Opt[] = reasons.map((r) => ({ value: r, label: t(`identity.staff.reasons.${group}.${r}`) }));
  return (
    <Select<Opt>
      inputId="staff-reason"
      aria-label={t('identity.staff.reasonLabel')}
      options={options}
      value={options.find((o) => o.value === value) ?? null}
      onChange={(o) => { if (o !== null) onChange(o.value); }}
      placeholder={t('identity.staff.reasonPlaceholder')}
    />
  );
}

export function StaffPage({ client }: { readonly client: ApiClient }): React.ReactElement {
  const { t } = useTranslation('identity');
  const session = useOfficerSession();
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes('officer.read');
  const own = readOwnHandle();
  const q = useOfficers(client, canRead);
  const create = useCreateOfficer(client);
  const assign = useAssignPosts(client);
  const disable = useDisableOfficer(client);
  const enable = useEnableOfficer(client);
  const revoke = useRevokeSessions(client);
  const reissue = useReissueActivation(client);
  const release = useReleaseActivation(client);

  const [handle, setHandle] = React.useState('');
  const [newPosts, setNewPosts] = React.useState<readonly string[]>([]);
  const [created, setCreated] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [editPosts, setEditPosts] = React.useState<readonly string[]>([]);
  const [reason, setReason] = React.useState<string | null>(null);
  const [released, setReleased] = React.useState<{ handle: string; code: string; expiresAt: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const officers = q.data?.officers ?? [];
  const state = !canRead ? 'forbidden' : listState({ isLoading: q.isLoading, errorStatus: q.isError ? httpStatusOf(q.error) : null, rowCount: officers.length, filtersActive: false });
  const normalised = normaliseHandle(handle);

  const open = (d: Dialog): void => {
    setDialog(d);
    setReason(null);
    setNotice(null);
    assign.reset(); disable.reset(); enable.reset(); revoke.reset(); reissue.reset();
    if (d.kind === 'assign') setEditPosts(d.row.posts);
  };
  const close = (): void => setDialog(null);

  const submitCreate = async (): Promise<void> => {
    if (normalised === null || newPosts.length === 0) return;
    try {
      const r = await create.mutateAsync({ loginHandle: normalised, posts: newPosts });
      setCreated(r.officer.loginHandle);
      setHandle('');
      setNewPosts([]);
    } catch { /* shown below */ }
  };

  const confirmDialog = async (): Promise<void> => {
    if (dialog === null) return;
    const targetOfficerId = dialog.row.officerId;
    try {
      if (dialog.kind === 'assign' && reason !== null) await assign.mutateAsync({ targetOfficerId, posts: editPosts, reasonCode: reason });
      else if (dialog.kind === 'disable' && reason !== null) await disable.mutateAsync({ targetOfficerId, reasonCode: reason });
      else if (dialog.kind === 'enable' && reason !== null) await enable.mutateAsync({ targetOfficerId, reasonCode: reason });
      else if (dialog.kind === 'revoke' && reason !== null) await revoke.mutateAsync({ targetOfficerId, reasonCode: reason });
      else if (dialog.kind === 'reissue') await reissue.mutateAsync({ targetOfficerId });
      else return;
      setNotice(t(`identity.staff.done.${dialog.kind}`, { handle: dialog.row.loginHandle }));
      close();
    } catch { /* shown in the dialog */ }
  };

  const doRelease = async (row: OfficerRow): Promise<void> => {
    setNotice(null);
    release.reset();
    try {
      const r = await release.mutateAsync({ targetOfficerId: row.officerId });
      setReleased({ handle: r.officer.loginHandle, code: r.activation.code, expiresAt: r.activation.expiresAt });
    } catch { /* shown below */ }
  };

  const active = dialog === null ? null : dialog.kind === 'assign' ? assign : dialog.kind === 'disable' ? disable : dialog.kind === 'enable' ? enable : dialog.kind === 'revoke' ? revoke : reissue;
  const needsReason = dialog !== null && dialog.kind !== 'reissue';
  const reasonGroup = dialog?.kind === 'assign' ? 'assign' : dialog?.kind === 'disable' ? 'disable' : dialog?.kind === 'enable' ? 'enable' : 'revoke';
  const reasons = dialog?.kind === 'assign' ? ASSIGN_POSTS_REASONS : dialog?.kind === 'disable' ? DISABLE_REASONS : dialog?.kind === 'enable' ? ENABLE_REASONS : REVOKE_SESSIONS_REASONS;
  const canConfirm = dialog !== null && (!needsReason || reason !== null) && (dialog.kind !== 'assign' || (editPosts.length > 0 && [...editPosts].sort().join() !== [...dialog.row.posts].sort().join()));

  const head = { cells: [
    { key: 'handle', content: t('identity.staff.cols.handle') },
    { key: 'posts', content: t('identity.staff.cols.posts') },
    { key: 'status', content: t('identity.staff.cols.status') },
    { key: 'login', content: t('identity.staff.cols.lastLogin') },
    { key: 'actions', content: t('identity.staff.cols.actions') },
  ] };
  const rows = officers.map((o) => {
    const lock = rowLock(o, own);
    const a = rowActions(o, own);
    const view = activationView(o);
    return {
      key: o.officerId,
      cells: [
        { key: 'handle', content: <Text weight="medium">{o.loginHandle}</Text> },
        { key: 'posts', content: <Text size="small">{o.posts.map((p) => t(`identity.staff.posts.${p}`, { defaultValue: p })).join(', ')}</Text> },
        {
          key: 'status',
          content: (
            <Stack space="space.050">
              <Lozenge appearance={o.status === 'active' ? 'success' : o.status === 'disabled' ? 'removed' : 'moved'}>{t(`identity.staff.status.${o.status}`)}</Lozenge>
              {view !== 'NONE' && <Text size="small" testId={`activation-${view}`}>{t(`identity.staff.activation.${view}`)}</Text>}
            </Stack>
          ),
        },
        { key: 'login', content: <Text size="small">{o.lastLoginAt === null ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(o.lastLoginAt))}</Text> },
        {
          key: 'actions',
          content: lock !== null ? <Text size="small" color="color.text.subtle">{t(`identity.staff.locked.${lock}`)}</Text> : (
            <Inline space="space.100" shouldWrap>
              {a.release && <Button appearance="primary" isDisabled={release.isPending} aria-label={`${t('identity.staff.actions.release')}: ${o.loginHandle}`} onClick={() => void doRelease(o)}>{t('identity.staff.actions.release')}</Button>}
              {a.reissue && <Button aria-label={`${t('identity.staff.actions.reissue')}: ${o.loginHandle}`} onClick={() => open({ kind: 'reissue', row: o })}>{t('identity.staff.actions.reissue')}</Button>}
              {a.assign && <Button aria-label={`${t('identity.staff.actions.assign')}: ${o.loginHandle}`} onClick={() => open({ kind: 'assign', row: o })}>{t('identity.staff.actions.assign')}</Button>}
              {a.disable && <Button appearance="warning" aria-label={`${t('identity.staff.actions.disable')}: ${o.loginHandle}`} onClick={() => open({ kind: 'disable', row: o })}>{t('identity.staff.actions.disable')}</Button>}
              {a.enable && <Button aria-label={`${t('identity.staff.actions.enable')}: ${o.loginHandle}`} onClick={() => open({ kind: 'enable', row: o })}>{t('identity.staff.actions.enable')}</Button>}
              {a.revoke && <Button aria-label={`${t('identity.staff.actions.revoke')}: ${o.loginHandle}`} onClick={() => open({ kind: 'revoke', row: o })}>{t('identity.staff.actions.revoke')}</Button>}
            </Inline>
          ),
        },
      ],
    };
  });

  return (
    <Box xcss={styles.root}>
      <Stack space="space.250">
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Heading size="xlarge" as="h1">{t('identity.staff.title')}</Heading>
          {q.dataUpdatedAt > 0 && <FreshnessStamp updatedAt={new Date(q.dataUpdatedAt).toISOString()} />}
        </Inline>
        <Text as="p">{t('identity.staff.lead')}</Text>

        {notice !== null && <SectionMessage appearance="success" testId="staff-notice"><Text as="p">{notice}</Text></SectionMessage>}
        {created !== null && (
          <SectionMessage appearance="information" title={t('identity.staff.created.title', { handle: created })} headingLevel="h2" testId="created-pending-release">
            <Text as="p">{t('identity.staff.created.body')}</Text>
          </SectionMessage>
        )}
        {release.isError && <Refusal error={release.error} t={t} />}

        {canRead && (
          <Box xcss={styles.panel}>
            <Stack space="space.150">
              <Heading size="medium" as="h2">{t('identity.staff.create.title')}</Heading>
              <Inline space="space.200" shouldWrap alignBlock="end">
                <Box xcss={styles.field}>
                  <Stack space="space.050">
                    <Text size="small" weight="medium" as="span">{t('identity.staff.create.handle')}</Text>
                    <TextField name="loginHandle" aria-label={t('identity.staff.create.handle')} value={handle} onChange={(e) => { setHandle((e.target as HTMLInputElement).value); setCreated(null); }} />
                  </Stack>
                </Box>
                <Box xcss={styles.wide}><PostsPicker value={newPosts} onChange={(v) => { setNewPosts(v); setCreated(null); }} t={t} /></Box>
                <Button appearance="primary" isDisabled={normalised === null || newPosts.length === 0 || create.isPending} onClick={() => void submitCreate()}>{t('identity.staff.create.submit')}</Button>
              </Inline>
              {handle !== '' && normalised === null && <Text size="small" color="color.text.danger">{t('identity.staff.create.badHandle')}</Text>}
              <PermissionPreview posts={newPosts} t={t} />
              {create.isError && <Refusal error={create.error} t={t} />}
            </Stack>
          </Box>
        )}

        <StateBoundary state={state} onRetry={() => void q.refetch()}>
          <div data-testid="staff-table"><DynamicTable caption={t('identity.staff.title')} head={head} rows={rows} /></div>
        </StateBoundary>
      </Stack>

      <ConfirmAction
        isOpen={dialog !== null}
        isPending={active?.isPending ?? false}
        appearance={dialog?.kind === 'disable' || dialog?.kind === 'revoke' ? 'warning' : 'primary'}
        title={dialog === null ? '' : t(`identity.staff.confirm.${dialog.kind}.title`, { handle: dialog.row.loginHandle })}
        body={dialog === null ? '' : t(`identity.staff.confirm.${dialog.kind}.body`)}
        consequences={dialog === null ? [] : [t(`identity.staff.confirm.${dialog.kind}.consequence`, { handle: dialog.row.loginHandle })]}
        confirmLabel={dialog === null ? '' : t(`identity.staff.actions.${dialog.kind}`)}
        canConfirm={canConfirm}
        onCancel={close}
        onConfirm={() => void confirmDialog()}
      >
        <Stack space="space.150">
          {dialog?.kind === 'assign' && (
            <>
              <PostsPicker value={editPosts} onChange={setEditPosts} t={t} />
              <PermissionPreview posts={editPosts} before={dialog.row.posts} t={t} />
            </>
          )}
          {needsReason && <ReasonSelect reasons={reasons} group={reasonGroup} value={reason} onChange={setReason} t={t} />}
          {active?.isError && <Refusal error={active.error} t={t} />}
        </Stack>
      </ConfirmAction>

      {released !== null && <ReleaseDialog handle={released.handle} code={released.code} expiresAt={released.expiresAt} onClose={() => { setReleased(null); release.reset(); }} />}
    </Box>
  );
}
