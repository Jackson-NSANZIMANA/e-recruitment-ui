// field-ops — the resolve-conflict response union, by its real shape (S08). PURE.

export type ResolveVerdict = 'RESOLVED' | 'NOT_FOUND' | 'SCORE_NOT_FOUND' | 'NO_CONFLICT' | 'FORBIDDEN' | 'UNREACHABLE' | 'OTHER';

/** PURE. The resolve-conflict response union, by its real shape. Never "resolved" without a 200 RESOLVED. */
export function readResolveAnswer(answer: { readonly httpStatus: number | null; readonly body: unknown }): ResolveVerdict {
  if (answer.httpStatus === null) return 'UNREACHABLE';
  const status = typeof answer.body === 'object' && answer.body !== null ? (answer.body as { status?: unknown }).status : undefined;
  if (answer.httpStatus === 200) return status === 'RESOLVED' ? 'RESOLVED' : 'OTHER';
  if (answer.httpStatus === 403) return 'FORBIDDEN';
  if (answer.httpStatus === 404) return status === 'SCORE_NOT_FOUND' ? 'SCORE_NOT_FOUND' : 'NOT_FOUND';
  if (answer.httpStatus === 409 && status === 'NO_CONFLICT') return 'NO_CONFLICT';
  return 'OTHER';
}
