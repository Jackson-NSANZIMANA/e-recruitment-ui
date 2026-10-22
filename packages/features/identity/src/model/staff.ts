// ══════════════════════════════════════════════════════════════════
// identity — staff administration model (S06, ADR-036 + Addendum A). Pure.
// ══════════════════════════════════════════════════════════════════

import type { OfficerRow } from '@usrp/api-client';

export const OWN_HANDLE_KEY = 'usrp_officer_handle';

/** The handle is not a secret (it is on the login form); it only marks "this is me" in the list. */
export function rememberOfficerHandle(handle: string): void {
  try {
    sessionStorage.setItem(OWN_HANDLE_KEY, handle.trim().toLowerCase());
  } catch {
    // Storage unavailable: the agency_admin rows are still read-only.
  }
}

export function readOwnHandle(): string | null {
  try {
    return sessionStorage.getItem(OWN_HANDLE_KEY);
  } catch {
    return null;
  }
}

export type RowLock = 'SELF' | 'ADMINISTRATOR' | null;

/**
 * PURE. Why a row is read-only. The officer's own row is never editable (no
 * self-escalation in the UI either), and an administrator row is never edited
 * from here: agency_admin is not assignable and the first-admin path is the
 * operator's. The backend refuses both anyway.
 */
export function rowLock(row: OfficerRow, ownHandle: string | null): RowLock {
  if (ownHandle !== null && row.loginHandle === ownHandle) return 'SELF';
  if (row.posts.includes('agency_admin')) return 'ADMINISTRATOR';
  return null;
}

export type ActivationView =
  | 'NONE'
  | 'RELEASE_AVAILABLE'
  | 'PENDING_SECOND_ADMIN'
  | 'RELEASED_WAITING_OFFICER'
  | 'EXPIRED';

/**
 * PURE. What the administrator sees for an officer who has not activated.
 * The creating (or reissuing) administrator never sees the code and is told the
 * release waits for a second administrator; a different administrator is offered
 * the release.
 */
export function activationView(row: OfficerRow): ActivationView {
  if (row.status !== 'pending' || row.activationState === null) return 'NONE';
  if (row.activationState === 'EXPIRED') return 'EXPIRED';
  if (row.activationState === 'RELEASED') return 'RELEASED_WAITING_OFFICER';
  return row.releasableByYou ? 'RELEASE_AVAILABLE' : 'PENDING_SECOND_ADMIN';
}

export interface RowActions {
  readonly assign: boolean;
  readonly disable: boolean;
  readonly enable: boolean;
  readonly revoke: boolean;
  readonly reissue: boolean;
  readonly release: boolean;
}

/** PURE. The actions a row offers. A locked row offers none. */
export function rowActions(row: OfficerRow, ownHandle: string | null): RowActions {
  if (rowLock(row, ownHandle) !== null) return { assign: false, disable: false, enable: false, revoke: false, reissue: false, release: false };
  const view = activationView(row);
  return {
    assign: true,
    disable: row.status === 'active',
    enable: row.status === 'disabled',
    revoke: row.status === 'active',
    reissue: row.status === 'pending' && view !== 'NONE',
    release: view === 'RELEASE_AVAILABLE',
  };
}

const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
export const normaliseHandle = (raw: string): string | null => {
  const h = raw.trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
};

export const MIN_PASSWORD = 12;
export const passwordProblem = (password: string, confirm: string): 'SHORT' | 'MISMATCH' | null =>
  password.length < MIN_PASSWORD ? 'SHORT' : password !== confirm ? 'MISMATCH' : null;

/** PURE. Escape text for the print sheet's HTML. */
export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** PURE. The printable activation sheet (self-contained HTML, no script, no external resource). */
export function activationSheetHtml(input: { readonly title: string; readonly handleLabel: string; readonly handle: string; readonly codeLabel: string; readonly code: string; readonly expiresLabel: string; readonly expires: string; readonly note: string }): string {
  const e = escapeHtml;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(input.title)}</title><style>body{font-family:sans-serif;margin:32px}h1{font-size:20px}dt{color:dimgray;margin-top:16px}dd{font-size:24px;margin:4px 0;letter-spacing:2px;font-family:monospace}p{font-size:16px}</style></head><body><h1>${e(input.title)}</h1><dl><dt>${e(input.handleLabel)}</dt><dd>${e(input.handle)}</dd><dt>${e(input.codeLabel)}</dt><dd>${e(input.code)}</dd><dt>${e(input.expiresLabel)}</dt><dd>${e(input.expires)}</dd></dl><p>${e(input.note)}</p></body></html>`;
}
