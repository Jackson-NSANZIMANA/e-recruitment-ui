import { describe, expect, it } from 'vitest';
import { readResolveAnswer } from './resolve.ts';

describe('resolve-conflict answer', () => {
  it('only a 200 RESOLVED resolves', () => {
    expect(readResolveAnswer({ httpStatus: 200, body: { status: 'RESOLVED' } })).toBe('RESOLVED');
    expect(readResolveAnswer({ httpStatus: 200, body: {} })).toBe('OTHER');
    expect(readResolveAnswer({ httpStatus: 200, body: null })).toBe('OTHER');
  });
  it('names the refusals', () => {
    expect(readResolveAnswer({ httpStatus: 404, body: { status: 'NOT_FOUND' } })).toBe('NOT_FOUND');
    expect(readResolveAnswer({ httpStatus: 404, body: { status: 'SCORE_NOT_FOUND' } })).toBe('SCORE_NOT_FOUND');
    expect(readResolveAnswer({ httpStatus: 409, body: { status: 'NO_CONFLICT' } })).toBe('NO_CONFLICT');
    expect(readResolveAnswer({ httpStatus: 403, body: null })).toBe('FORBIDDEN');
    expect(readResolveAnswer({ httpStatus: 500, body: null })).toBe('OTHER');
  });
  it('no response is never resolved', () => {
    expect(readResolveAnswer({ httpStatus: null, body: null })).toBe('UNREACHABLE');
  });
});
