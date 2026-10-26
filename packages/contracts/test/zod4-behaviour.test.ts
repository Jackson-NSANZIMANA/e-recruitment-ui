// Pins the zod 3 -> 4 behaviours the generated schemas rely on, so a future
// zod bump that changes any of them fails here rather than at an edge response.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as application from '../src/generated/application-service.zod.ts';
import * as iam from '../src/generated/iam-service.zod.ts';

test('closed objects still refuse unknown keys', () => {
  assert.equal(iam.InvalidClient401Schema.safeParse({ error: 'INVALID_CLIENT' }).success, true);
  assert.equal(iam.InvalidClient401Schema.safeParse({ error: 'INVALID_CLIENT', extra: 1 }).success, false);
});

test('Uuid accepts any 8-4-4-4-12 hex, as zod 3 did (not RFC-version-bit strict)', () => {
  assert.equal(application.UuidSchema.safeParse('00000000-0000-0000-0000-000000000000').success, true);
  assert.equal(application.UuidSchema.safeParse('12345678-1234-1234-1234-123456789abc').success, true);
  assert.equal(application.UuidSchema.safeParse('not-a-uuid').success, false);
});

test('officer application list is capped at 100 rows (backend ListApplicationsService)', () => {
  const ok = { agency: 'RDF', applications: [] as unknown[] };
  assert.equal(application.ListApplicationsOkSchema.safeParse(ok).success, true);
  const over = { agency: 'RDF', applications: Array.from({ length: 101 }, () => ({})) };
  const result = application.ListApplicationsOkSchema.safeParse(over);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some((i) => i.code === 'too_big'));
});
