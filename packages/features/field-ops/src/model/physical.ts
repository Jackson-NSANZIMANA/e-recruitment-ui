// ══════════════════════════════════════════════════════════════════
// field-ops — physical test capture (S08). PURE.
//
// Bounds: height 140-220 cm and weight 40-150 kg are the contract's
// (PhysicalTestMetrics, packages/shared-types field.types.ts). Chest and the
// 3 km run have no contract bound; the plausible ranges below are the
// station's own guard against a slipped decimal and are ASSUMED (flagged in the
// hand-off). A value outside a bound is allowed ONLY with a remeasure reason:
// the officer re-measured and the number stands.
// ══════════════════════════════════════════════════════════════════

export const PHYSICAL_FIELDS = ['heightCm', 'weightKg', 'chestCm', 'run3kmTimeSeconds'] as const;
export type PhysicalField = (typeof PHYSICAL_FIELDS)[number];

export const PHYSICAL_BOUNDS: Readonly<Record<PhysicalField, { readonly min: number; readonly max: number; readonly source: 'contract' | 'assumed' }>> = {
  heightCm: { min: 140, max: 220, source: 'contract' },
  weightKg: { min: 40, max: 150, source: 'contract' },
  chestCm: { min: 60, max: 160, source: 'assumed' },
  run3kmTimeSeconds: { min: 360, max: 1800, source: 'assumed' },
};

export type PhysicalForm = Readonly<Record<PhysicalField, string>> & { readonly remeasureReason: string };

export interface PhysicalMetrics {
  readonly heightCm: number;
  readonly weightKg: number;
  readonly chestCm: number;
  readonly run3kmTimeSeconds: number;
  /** The physical station does not decide fitness; the medical board does. */
  readonly medicalFitnessStatus: 'PENDING_REVIEW';
  readonly additionalNotes?: string;
}

export type FieldProblem = 'required' | 'not_a_number' | 'out_of_range';

export interface PhysicalReading {
  readonly metrics: PhysicalMetrics | null;
  readonly problems: Readonly<Partial<Record<PhysicalField, FieldProblem>>>;
  readonly outOfRange: readonly PhysicalField[];
  /** True when out-of-range values exist and no reason was given. */
  readonly needsReason: boolean;
}

export const REASON_MAX_LENGTH = 120;

function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (text === '') return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

export function readPhysicalForm(form: PhysicalForm): PhysicalReading {
  const problems: Partial<Record<PhysicalField, FieldProblem>> = {};
  const outOfRange: PhysicalField[] = [];
  const values: Partial<Record<PhysicalField, number>> = {};
  for (const field of PHYSICAL_FIELDS) {
    const n = parseNumber(form[field]);
    if (n === null) problems[field] = 'required';
    else if (Number.isNaN(n)) problems[field] = 'not_a_number';
    else {
      values[field] = n;
      const { min, max } = PHYSICAL_BOUNDS[field];
      if (n < min || n > max) outOfRange.push(field);
    }
  }
  const reason = form.remeasureReason.trim();
  const needsReason = outOfRange.length > 0 && reason.length === 0;
  const complete = Object.keys(problems).length === 0 && !needsReason;
  if (!complete) return { metrics: null, problems, outOfRange, needsReason };
  const notes = outOfRange.length > 0 ? `REMEASURED ${outOfRange.join(',')}: ${reason.slice(0, REASON_MAX_LENGTH)}` : undefined;
  return {
    metrics: {
      heightCm: values.heightCm!, weightKg: values.weightKg!, chestCm: values.chestCm!, run3kmTimeSeconds: values.run3kmTimeSeconds!,
      medicalFitnessStatus: 'PENDING_REVIEW',
      ...(notes === undefined ? {} : { additionalNotes: notes }),
    },
    problems, outOfRange, needsReason,
  };
}
