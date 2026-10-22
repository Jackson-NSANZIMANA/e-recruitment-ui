import { expect, test } from 'vitest';
import type { OfficerRow } from '@usrp/api-client';
import { activationSheetHtml, activationView, escapeHtml, normaliseHandle, passwordProblem, rowActions, rowLock } from './staff.js';
import { KNOWN_POSTS, POST_PERMISSIONS, addedPermissions, grantsDecisionAuthority, permissionsOfPosts } from './role-table.js';

const ROW: OfficerRow = { officerId: '7a010f35-7018-4d7a-9c64-10a91a9e29d9', loginHandle: 'rdf.med.one', posts: ['medical_officer'], status: 'active', createdAt: '2026-10-22T08:00:00.000Z', activatedAt: '2026-10-22T09:00:00.000Z', lastLoginAt: null, activationExpiresAt: null, activationState: null, releasableByYou: false };
const PENDING: OfficerRow = { ...ROW, status: 'pending', activatedAt: null, activationState: 'PENDING_RELEASE', activationExpiresAt: '2026-10-23T08:00:00.000Z' };

test('the creating administrator sees "pending second administrator"; a different one is offered the release', () => {
  expect(activationView({ ...PENDING, releasableByYou: false })).toBe('PENDING_SECOND_ADMIN');
  expect(activationView({ ...PENDING, releasableByYou: true })).toBe('RELEASE_AVAILABLE');
  expect(activationView({ ...PENDING, activationState: 'RELEASED' })).toBe('RELEASED_WAITING_OFFICER');
  expect(activationView({ ...PENDING, activationState: 'EXPIRED' })).toBe('EXPIRED');
  expect(activationView(ROW)).toBe('NONE');
});

test('only a releasable row offers release, and the creator never does', () => {
  expect(rowActions({ ...PENDING, releasableByYou: false }, null).release).toBe(false);
  expect(rowActions({ ...PENDING, releasableByYou: true }, null).release).toBe(true);
  expect(rowActions({ ...PENDING, releasableByYou: true }, null).reissue).toBe(true);
});

test('own row and administrator rows are read-only (no self-escalation)', () => {
  expect(rowLock(ROW, 'rdf.med.one')).toBe('SELF');
  expect(rowLock({ ...ROW, loginHandle: 'rdf.admin2', posts: ['agency_admin'] }, 'rdf.admin')).toBe('ADMINISTRATOR');
  expect(rowLock(ROW, 'rdf.admin')).toBeNull();
  const a = rowActions(ROW, 'rdf.med.one');
  expect(Object.values(a).every((v) => v === false)).toBe(true);
});

test('disable/revoke only on active, enable only on disabled', () => {
  expect(rowActions(ROW, null)).toMatchObject({ disable: true, revoke: true, enable: false });
  expect(rowActions({ ...ROW, status: 'disabled' }, null)).toMatchObject({ disable: false, revoke: false, enable: true });
});

test('handle and password rules', () => {
  expect(normaliseHandle('  RDF.Med.One ')).toBe('rdf.med.one');
  expect(normaliseHandle('x')).toBeNull();
  expect(passwordProblem('short', 'short')).toBe('SHORT');
  expect(passwordProblem('a-long-enough-pw', 'different-long-pw')).toBe('MISMATCH');
  expect(passwordProblem('a-long-enough-pw', 'a-long-enough-pw')).toBeNull();
});

test('the role table: every assignable post is present, agency_admin is separate, unknown posts grant nothing', () => {
  for (const p of KNOWN_POSTS) expect(POST_PERMISSIONS[p].length).toBeGreaterThan(0);
  expect(permissionsOfPosts(['medical_officer'])).toContain('medical.review');
  expect(permissionsOfPosts(['medical_officer'])).not.toContain('decision.final');
  expect(permissionsOfPosts(['nonsense'])).toEqual([]);
  expect(addedPermissions(['reviewer'], ['reviewer', 'decision_authority'])).toEqual(['application.accept', 'decision.final']);
  expect(grantsDecisionAuthority(['decision_authority'])).toBe(true);
  expect(grantsDecisionAuthority(['reviewer'])).toBe(false);
});

test('the print sheet escapes everything and carries no script', () => {
  const html = activationSheetHtml({ title: 'T', handleLabel: 'H', handle: '<img src=x onerror=alert(1)>', codeLabel: 'C', code: 'AAAAA-BBBBB', expiresLabel: 'E', expires: '2026', note: 'n' });
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script');
  expect(html).toContain('AAAAA-BBBBB');
  expect(escapeHtml(`a&b"c'<`)).toBe('a&amp;b&quot;c&#39;&lt;');
});
