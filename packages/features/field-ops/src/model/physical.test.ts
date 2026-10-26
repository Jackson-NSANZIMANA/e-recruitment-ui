import { describe, expect, it } from 'vitest';
import { readPhysicalForm, type PhysicalForm } from './physical.ts';

const ok: PhysicalForm = { heightCm: '178', weightKg: '72', chestCm: '96', run3kmTimeSeconds: '720', remeasureReason: '' };

describe('physical bounds', () => {
  it('accepts in-range values and leaves fitness to the medical board', () => {
    const r = readPhysicalForm(ok);
    expect(r.metrics).toEqual({ heightCm: 178, weightKg: 72, chestCm: 96, run3kmTimeSeconds: 720, medicalFitnessStatus: 'PENDING_REVIEW' });
  });
  it('requires every field and rejects non-numbers', () => {
    expect(readPhysicalForm({ ...ok, heightCm: '' }).problems).toEqual({ heightCm: 'required' });
    expect(readPhysicalForm({ ...ok, weightKg: '7o' }).problems).toEqual({ weightKg: 'not_a_number' });
    expect(readPhysicalForm({ ...ok, weightKg: '7o' }).metrics).toBeNull();
  });
  it('an out-of-range value needs a remeasure reason, which travels in the notes', () => {
    const blocked = readPhysicalForm({ ...ok, heightCm: '139' });
    expect(blocked.metrics).toBeNull();
    expect(blocked.needsReason).toBe(true);
    expect(blocked.outOfRange).toEqual(['heightCm']);
    const allowed = readPhysicalForm({ ...ok, heightCm: '139', remeasureReason: 'measured twice' });
    expect(allowed.metrics?.heightCm).toBe(139);
    expect(allowed.metrics?.additionalNotes).toBe('REMEASURED heightCm: measured twice');
  });
  it('bounds at the contract edges are inclusive', () => {
    expect(readPhysicalForm({ ...ok, heightCm: '140', weightKg: '150' }).needsReason).toBe(false);
    expect(readPhysicalForm({ ...ok, heightCm: '220.5' }).outOfRange).toEqual(['heightCm']);
  });
  it('accepts a decimal comma', () => {
    expect(readPhysicalForm({ ...ok, weightKg: '72,5' }).metrics?.weightKg).toBe(72.5);
  });
});
