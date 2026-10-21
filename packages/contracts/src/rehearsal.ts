/**
 * Rehearsal campaigns (backend `tools/rehearsal`, `pnpm rehearse`).
 *
 * A rehearsal stages a synthetic recruitment cycle on the real platform for
 * development, training and pilot drills. The backend marks every rehearsal
 * campaign twice — a `REH-` public code and a `[REHEARSAL]` label — so a
 * screen can recognise one from either field. The UI must never let a
 * rehearsal be mistaken for a real recruitment, above all on the Exam Pass,
 * which can be printed and carried to a venue.
 *
 * Mirrors REHEARSAL_CODE_PREFIX / REHEARSAL_LABEL_PREFIX in the backend's
 * tools/rehearsal/src/scenario.ts.
 */
export const REHEARSAL_CODE_PREFIX = 'REH-';
export const REHEARSAL_LABEL_PREFIX = '[REHEARSAL]';

export function isRehearsalCampaign(campaign: {
  readonly publicCode?: string | null;
  readonly campaignLabel?: string | null;
}): boolean {
  return (
    (campaign.publicCode ?? '').startsWith(REHEARSAL_CODE_PREFIX) ||
    (campaign.campaignLabel ?? '').startsWith(REHEARSAL_LABEL_PREFIX)
  );
}
