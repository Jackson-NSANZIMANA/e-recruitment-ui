import { ApiError, httpStatusOf } from '@usrp/api-client';
import { stateFromHttpStatus, type UiStateKind } from '@usrp/ui';

/** The screen state a failed read maps to. */
export const stateOfError = (error: unknown): UiStateKind => stateFromHttpStatus(httpStatusOf(error));

/** The refusal outcome a failed write carries, when it has one. */
export function outcomeOf(error: unknown): { readonly kind: string; readonly outcome: string | null; readonly data: Readonly<Record<string, unknown>> } {
  if (!(error instanceof ApiError)) return { kind: 'unknown', outcome: null, data: {} };
  const n = error.normalised;
  if (n.kind === 'conflict' || n.kind === 'unprocessable') return { kind: n.kind, outcome: n.outcome, data: n.data };
  return { kind: n.kind, outcome: null, data: {} };
}
