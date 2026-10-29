// ══════════════════════════════════════════════════════════════════
// field-ops — device setup and readiness (S08, kit item 1)
//
// Four things, in the order a supervisor does them on a fresh tablet:
//   1. readiness: Ed25519, storage, clock, enrolment, venue day, trust anchor.
//      A failed check blocks the device stations and points to the paper fallback.
//   2. venue and day: typed and confirmed against the roster (getVenueRoster).
//   3. enrolment (enrollFieldDevice): the public key only; the private key is
//      non-extractable and never leaves the device.
//   4. the scheduling public key, cached for the offline signature rung.
// ══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives/compiled';
import Heading from '@atlaskit/heading';
import Button from '@atlaskit/button';
import LoadingButton from '@atlaskit/button/loading-button';
import Lozenge from '@atlaskit/lozenge';
import TextField from '@atlaskit/textfield';
import SectionMessage from '@atlaskit/section-message';
import { ErrorMessage, HelperMessage, Label } from '@atlaskit/form';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { ApiError, enrollFieldDevice, getVenueRoster, type ApiClient } from '@usrp/api-client';
import { anchorFromBase64 } from '@usrp/field-ledger';
import { useOfficerSession } from '@usrp/auth';
import { useTranslation } from '@usrp/i18n';
import { useDeviceRuntime } from '../runtime/context.tsx';
import { venueDayProblems, writeVenueDay, readVenueDay, type VenueDay, type VenueDayProblem } from '../model/venue.ts';
import type { Readiness, CheckStatus } from '../model/readiness.ts';
import { StationPage } from '../ui/Page.tsx';

const tile = cssMap({
  box: { padding: token('space.300'), borderWidth: token('border.width'), borderStyle: 'solid', borderColor: token('color.border'), borderRadius: token('radius.medium') },
});

const APPEARANCE: Readonly<Record<CheckStatus, 'success' | 'moved' | 'removed'>> = { ok: 'success', warn: 'moved', fail: 'removed' };

export interface SetupPageProps {
  readonly client: ApiClient;
  /** Build-time default trust anchor (base64 of the PEM), if the deployment bakes one in. */
  readonly defaultTrustAnchor?: string;
}

export default function SetupPage({ client, defaultTrustAnchor }: SetupPageProps): React.ReactElement {
  const { t } = useTranslation('field_ops');
  const session = useOfficerSession();
  const state = useDeviceRuntime();
  const ids = { campaign: useId(), district: useId(), date: useId(), anchor: useId() };
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [day, setDay] = useState<VenueDay | null>(() => readVenueDay());
  const [draft, setDraft] = useState({ campaign: day?.campaign ?? '', district: day?.district ?? '', examDate: day?.examDate ?? '' });
  const [problems, setProblems] = useState<readonly VenueDayProblem[]>([]);
  const [venueFailure, setVenueFailure] = useState<'none' | 'not_found' | 'forbidden' | 'offline' | 'other'>('none');
  const [busy, setBusy] = useState<'venue' | 'enrol' | null>(null);
  const [enrolFailure, setEnrolFailure] = useState<'none' | 'revoked' | 'forbidden' | 'offline' | 'other'>('none');
  const [anchorText, setAnchorText] = useState('');
  const [anchorBad, setAnchorBad] = useState(false);
  const [anchorCount, setAnchorCount] = useState(0);

  const agency = session?.agency ?? '';
  const canEnrol = session?.permissions.includes('field.device.enroll') ?? false;
  const runtime = state.status === 'ready' ? state.runtime : null;

  const refresh = useCallback(async (): Promise<void> => {
    if (runtime === null) return;
    await runtime.measureClock(client.baseUrl);
    setReadiness(await runtime.probe(agency));
    setAnchorCount((await runtime.anchors.list()).length);
  }, [runtime, client.baseUrl, agency]);

  useEffect(() => {
    if (runtime === null) return;
    void (async () => {
      if (defaultTrustAnchor !== undefined && (await runtime.anchors.list()).length === 0) {
        const anchor = anchorFromBase64(defaultTrustAnchor);
        if (anchor !== null) await runtime.anchors.replace([anchor]);
      }
      await refresh();
    })();
  }, [runtime, refresh, defaultTrustAnchor]);

  const confirmVenue = async (): Promise<void> => {
    const found = venueDayProblems(draft);
    setProblems(found);
    setVenueFailure('none');
    if (found.length > 0) return;
    setBusy('venue');
    try {
      const roster = await getVenueRoster(client, { campaign: draft.campaign.trim(), district: draft.district.trim(), examDate: draft.examDate.trim() });
      const next: VenueDay = { campaign: draft.campaign.trim(), district: draft.district.trim(), examDate: draft.examDate.trim(), venueName: roster.venue.venueName };
      writeVenueDay(next);
      setDay(next);
      window.dispatchEvent(new Event('usrp-venue-day'));
    } catch (error) {
      const n = error instanceof ApiError ? error.normalised : null;
      setVenueFailure(n?.kind === 'notFound' ? 'not_found' : n?.kind === 'forbidden' ? 'forbidden' : n?.kind === 'network' ? 'offline' : 'other');
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const enrol = async (): Promise<void> => {
    if (runtime === null) return;
    setBusy('enrol');
    setEnrolFailure('none');
    try {
      const answer = await enrollFieldDevice(client, await runtime.enrolmentBody());
      await runtime.acknowledgeEnrolment(answer.agency);
    } catch (error) {
      const n = error instanceof ApiError ? error.normalised : null;
      setEnrolFailure(n?.kind === 'conflict' ? 'revoked' : n?.kind === 'forbidden' ? 'forbidden' : n?.kind === 'network' ? 'offline' : 'other');
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const installAnchor = async (): Promise<void> => {
    const anchor = anchorFromBase64(anchorText);
    setAnchorBad(anchor === null);
    if (anchor === null || runtime === null) return;
    await runtime.anchors.replace([anchor]);
    setAnchorText('');
    await refresh();
  };

  if (state.status === 'failed') {
    return (
      <StationPage title={t('field_ops.setup.title')}>
        <SectionMessage appearance="error" title={t('field_ops.setup.runtime_failed_title')} headingLevel="h2" testId="setup-runtime-failed">
          <Text as="p">{t('field_ops.setup.runtime_failed_body')}</Text>
        </SectionMessage>
      </StationPage>
    );
  }

  const enrolled = runtime?.identity.enrolledAt !== null && runtime?.identity.enrolledAgency === agency && runtime !== null;

  return (
    <StationPage title={t('field_ops.setup.title')} intro={t('field_ops.setup.intro')} testId="setup-page">
      <Box xcss={tile.box}>
        <Stack space="space.200">
          <Inline spread="space-between" alignBlock="center" shouldWrap>
            <Heading size="medium" as="h2">{t('field_ops.setup.readiness')}</Heading>
            <Button onClick={() => { void refresh(); }} testId="setup-recheck">{t('field_ops.setup.recheck')}</Button>
          </Inline>
          {readiness === null ? <Text>{t('field_ops.setup.checking')}</Text> : (
            <Stack space="space.100" testId="readiness-checks">
              {readiness.checks.map((check) => (
                <Inline key={check.id} space="space.200" alignBlock="center" spread="space-between" testId={`check-${check.id}`}>
                  <Text>{t(`field_ops.setup.checks.${check.id}`)}</Text>
                  <Inline space="space.100" alignBlock="center">
                    {check.value !== undefined && <Text color="color.text.subtle">{check.value}</Text>}
                    <Lozenge appearance={APPEARANCE[check.status]}>{t(`field_ops.setup.status.${check.status}`)}</Lozenge>
                  </Inline>
                </Inline>
              ))}
            </Stack>
          )}
          {readiness?.blocked === true ? (
            <SectionMessage appearance="error" title={t('field_ops.setup.blocked_title')} headingLevel="h3" testId="setup-blocked">
              <Text as="p">{t('field_ops.setup.blocked_body')}</Text>
            </SectionMessage>
          ) : readiness !== null ? (
            <SectionMessage appearance="success" title={t('field_ops.setup.ready_title')} headingLevel="h3" testId="setup-ready">
              <Text as="p">{t('field_ops.setup.ready_body')}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </Box>

      <Box xcss={tile.box}>
        <Stack space="space.200">
          <Heading size="medium" as="h2">{t('field_ops.setup.venue_title')}</Heading>
          <Text color="color.text.subtle">{t('field_ops.setup.venue_help')}</Text>
          <Stack space="space.100">
            <Label htmlFor={ids.campaign}>{t('field_ops.setup.campaign')}</Label>
            <TextField id={ids.campaign} value={draft.campaign} autoComplete="off" isInvalid={problems.includes('campaign')} onChange={(e) => { setDraft({ ...draft, campaign: e.currentTarget.value }); }} />
            {problems.includes('campaign') && <ErrorMessage>{t('field_ops.setup.campaign_invalid')}</ErrorMessage>}
          </Stack>
          <Stack space="space.100">
            <Label htmlFor={ids.district}>{t('field_ops.setup.district')}</Label>
            <TextField id={ids.district} value={draft.district} autoComplete="off" isInvalid={problems.includes('district')} onChange={(e) => { setDraft({ ...draft, district: e.currentTarget.value }); }} />
            {problems.includes('district') && <ErrorMessage>{t('field_ops.setup.district_invalid')}</ErrorMessage>}
          </Stack>
          <Stack space="space.100">
            <Label htmlFor={ids.date}>{t('field_ops.setup.exam_date')}</Label>
            <TextField id={ids.date} value={draft.examDate} autoComplete="off" placeholder="2026-06-06" isInvalid={problems.includes('examDate')} onChange={(e) => { setDraft({ ...draft, examDate: e.currentTarget.value }); }} />
            {problems.includes('examDate') ? <ErrorMessage>{t('field_ops.setup.exam_date_invalid')}</ErrorMessage> : <HelperMessage>{t('field_ops.setup.exam_date_help')}</HelperMessage>}
          </Stack>
          {venueFailure !== 'none' && (
            <SectionMessage appearance="error" title={t('field_ops.setup.venue_failed_title')} headingLevel="h3" testId="setup-venue-failed">
              <Text as="p">{venueFailure === 'not_found' ? t('field_ops.setup.venue_not_found') : venueFailure === 'forbidden' ? t('field_ops.setup.venue_forbidden') : venueFailure === 'offline' ? t('field_ops.setup.venue_offline') : t('field_ops.setup.venue_other')}</Text>
            </SectionMessage>
          )}
          <Inline space="space.200" alignBlock="center" shouldWrap>
            <LoadingButton appearance="primary" isLoading={busy === 'venue'} onClick={() => { void confirmVenue(); }} testId="setup-confirm-venue">{t('field_ops.setup.confirm_venue')}</LoadingButton>
            {day !== null && <Text weight="bold" testId="setup-venue-confirmed">{t('field_ops.setup.venue_confirmed', { venue: day.venueName, date: day.examDate })}</Text>}
          </Inline>
        </Stack>
      </Box>

      <Box xcss={tile.box}>
        <Stack space="space.200">
          <Heading size="medium" as="h2">{t('field_ops.setup.enrol_title')}</Heading>
          <Text color="color.text.subtle">{t('field_ops.setup.enrol_help')}</Text>
          {runtime !== null && <Text testId="setup-device-id">{t('field_ops.setup.device_id', { id: runtime.identity.deviceId })}</Text>}
          {enrolFailure !== 'none' && (
            <SectionMessage appearance="error" title={t('field_ops.setup.enrol_failed_title')} headingLevel="h3" testId="setup-enrol-failed">
              <Text as="p">{enrolFailure === 'revoked' ? t('field_ops.setup.enrol_revoked') : enrolFailure === 'forbidden' ? t('field_ops.setup.enrol_forbidden') : enrolFailure === 'offline' ? t('field_ops.setup.enrol_offline') : t('field_ops.setup.enrol_other')}</Text>
            </SectionMessage>
          )}
          {enrolled ? (
            <Lozenge appearance="success" testId="setup-enrolled">{t('field_ops.setup.enrolled')}</Lozenge>
          ) : canEnrol ? (
            <Inline><LoadingButton appearance="primary" isLoading={busy === 'enrol'} isDisabled={runtime === null} onClick={() => { void enrol(); }} testId="setup-enrol">{t('field_ops.setup.enrol')}</LoadingButton></Inline>
          ) : (
            <Text color="color.text.subtle">{t('field_ops.setup.enrol_no_permission')}</Text>
          )}
        </Stack>
      </Box>

      <Box xcss={tile.box}>
        <Stack space="space.200">
          <Heading size="medium" as="h2">{t('field_ops.setup.anchor_title')}</Heading>
          <Text color="color.text.subtle">{t('field_ops.setup.anchor_help')}</Text>
          <Text testId="setup-anchor-count">{t('field_ops.setup.anchor_count', { count: anchorCount })}</Text>
          <Stack space="space.100">
            <Label htmlFor={ids.anchor}>{t('field_ops.setup.anchor_label')}</Label>
            <TextField id={ids.anchor} value={anchorText} autoComplete="off" isInvalid={anchorBad} onChange={(e) => { setAnchorText(e.currentTarget.value); setAnchorBad(false); }} />
            {anchorBad && <ErrorMessage>{t('field_ops.setup.anchor_invalid')}</ErrorMessage>}
          </Stack>
          <Inline><Button onClick={() => { void installAnchor(); }} isDisabled={anchorText.trim().length === 0} testId="setup-install-anchor">{t('field_ops.setup.anchor_install')}</Button></Inline>
        </Stack>
      </Box>
    </StationPage>
  );
}
