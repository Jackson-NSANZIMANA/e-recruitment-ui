// ══════════════════════════════════════════════════════════════════
// field-ops — the medical station, by agency mode (ADR-013). PURE.
//
//   RDF       BOARD         the in-house board's verdict: FIT | UNFIT
//   RNP, RCS  CERTIFICATE   a government physician's certificate: verified (with
//                           the signing physician's name) or rejected
//
// The mode comes from the SESSION's agency, never from a choice on screen. The
// edge answers a wrong-shaped body with 422 INVALID_MEDICAL_INPUT whose detail
// names the mode: that detail is never rendered.
// ══════════════════════════════════════════════════════════════════

import type { MedicalReviewInput } from '@usrp/api-client';

export type MedicalMode = 'BOARD' | 'CERTIFICATE';

export function medicalModeFor(agency: string): MedicalMode | null {
  if (agency === 'RDF') return 'BOARD';
  if (agency === 'RNP' || agency === 'RCS') return 'CERTIFICATE';
  return null;
}

export type MedicalChoice = 'FIT' | 'UNFIT' | 'CERT_VERIFIED' | 'CERT_REJECTED';

export function choicesFor(mode: MedicalMode): readonly MedicalChoice[] {
  return mode === 'BOARD' ? ['FIT', 'UNFIT'] : ['CERT_VERIFIED', 'CERT_REJECTED'];
}

export const PHYSICIAN_NAME_MAX = 120;

export type MedicalFormProblem = 'physician_required' | 'choice_not_for_mode';

/** PURE. The request body for the choice, or the problem that stops it. */
export function medicalInputFor(
  mode: MedicalMode,
  applicationId: string,
  choice: MedicalChoice,
  physicianName: string,
): { readonly input: MedicalReviewInput } | { readonly problem: MedicalFormProblem } {
  if (!choicesFor(mode).includes(choice)) return { problem: 'choice_not_for_mode' };
  if (choice === 'FIT' || choice === 'UNFIT') return { input: { applicationId, fitnessStatus: choice } };
  if (choice === 'CERT_REJECTED') return { input: { applicationId, certVerdict: 'CERT_REJECTED' } };
  const name = physicianName.trim();
  if (name.length === 0 || name.length > PHYSICIAN_NAME_MAX) return { problem: 'physician_required' };
  return { input: { applicationId, certVerdict: 'CERT_VERIFIED', physicianName: name } };
}
