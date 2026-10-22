// ══════════════════════════════════════════════════════════════════
// identity — the post → operations table, for the staff screens (S06)
//
// A READ-ONLY MIRROR of the backend's role table (shared-auth permissions.ts,
// provisional until ratified: ADR-031). It exists so that assigning a post
// shows, before the administrator confirms, exactly which operations that post
// grants. It decides nothing: the backend's table is the authority and the
// session view's `permissions` is what the UI acts on. If the two ever differ,
// the screen's preview is wrong and the backend is right, so the preview is
// labelled as a preview and the table is pinned by a test.
// ══════════════════════════════════════════════════════════════════

export const KNOWN_POSTS = ['reviewer', 'screening_officer', 'field_supervisor', 'medical_officer', 'adjudicator', 'decision_authority', 'dpo'] as const;
export type Post = (typeof KNOWN_POSTS)[number];

const READ = ['application.read', 'adjudication.read'] as const;

export const POST_PERMISSIONS: Readonly<Record<Post | 'agency_admin', readonly string[]>> = {
  agency_admin: ['campaign.create', 'campaign.policy.create', 'campaign.session.configure', 'campaign.publish', 'campaign.registration.close', 'campaign.complete', 'campaign.cancel', 'campaign.read.admin', ...READ, 'officer.read', 'officer.create', 'officer.posts.assign', 'officer.disable', 'officer.sessions.revoke'],
  reviewer: ['campaign.read.admin', 'biometric.evidence.read', ...READ],
  screening_officer: ['walkin.register', 'walkin.vet', 'identity.verify', 'biometric.verify', 'document.verify.venue', 'admission.gate', 'field.device.enroll', 'field.score.sync', ...READ],
  field_supervisor: ['field.device.enroll', 'field.score.sync', 'field.conflict.resolve', 'biometric.evidence.read', 'identity.manual.confirm', ...READ],
  medical_officer: ['medical.review', ...READ],
  adjudicator: ['adjudication.decide', 'biometric.evidence.read', ...READ],
  decision_authority: ['decision.final', 'application.accept', 'biometric.evidence.read', ...READ],
  dpo: ['erasure.queue.read', 'erasure.decide'],
};

/** PURE. The operations a set of posts grants, sorted and de-duplicated. Unknown posts grant nothing. */
export function permissionsOfPosts(posts: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const post of posts) for (const p of (POST_PERMISSIONS as Readonly<Record<string, readonly string[] | undefined>>)[post] ?? []) out.add(p);
  return [...out].sort();
}

/** PURE. Permissions only the posts being added grant, so a change shows what is NEW. */
export function addedPermissions(before: readonly string[], after: readonly string[]): readonly string[] {
  const had = new Set(permissionsOfPosts(before));
  return permissionsOfPosts(after).filter((p) => !had.has(p));
}

/** PURE. The permission whose grant needs explicit four-eyes attention (ADR-036 owner decision: allowed, audited). */
export const grantsDecisionAuthority = (posts: readonly string[]): boolean => posts.includes('decision_authority');
