import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldLedgerViolations, fieldStationViolations } from '../lib/app-boundaries.mjs';

test('field-ledger imports no feature and no UI', () => {
  assert.equal(fieldLedgerViolations("import { canonicalJson } from './canonical.ts';").length, 0);
  assert.equal(fieldLedgerViolations("import { stationsFor } from '@usrp/feature-field-ops';").length, 1);
  assert.equal(fieldLedgerViolations("import React from 'react';").length, 1);
  assert.equal(fieldLedgerViolations("const m = import('@usrp/feature-identity');").length, 1);
});

test('field-station composes only its four slices, and only the applications model', () => {
  assert.equal(fieldStationViolations('import { createFieldOpsRoutes } from "@usrp/feature-field-ops";').length, 0);
  assert.equal(fieldStationViolations('import { OfficerLoginPage } from "@usrp/feature-identity";').length, 0);
  assert.equal(fieldStationViolations('import { applicationStatusLabel } from "@usrp/feature-applications";').length, 0);
  assert.equal(fieldStationViolations('import { AdjudicationRoutes } from "@usrp/feature-adjudication";').length, 1);
  assert.equal(fieldStationViolations('import { campaignCommands } from "@usrp/feature-campaigns";').length, 1);
  assert.equal(fieldStationViolations('import { ApplicationsPage } from "@usrp/feature-applications";').length, 1);
  assert.equal(fieldStationViolations('import * as apps from "@usrp/feature-applications";').length, 1);
});
