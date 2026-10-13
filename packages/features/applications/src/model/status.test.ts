import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  canAccept,
  canAdjudicate,
  canFinalDecision,
  canMedicalReview,
} from './status.ts';

test('medical review is available only after physical testing', () => {
  assert.equal(canMedicalReview('PHYSICAL_TEST_COMPLETE'), true);
  assert.equal(canMedicalReview('WALK_IN_PHYSICAL_TEST'), true);
  assert.equal(canMedicalReview('MEDICAL_REVIEW'), false);
});

test('final decision is available only after medical review', () => {
  assert.equal(canFinalDecision('MEDICAL_REVIEW'), true);
  assert.equal(canFinalDecision('FINAL_SHORTLIST'), false);
});

test('accept is available only for final shortlist', () => {
  assert.equal(canAccept('FINAL_SHORTLIST'), true);
  assert.equal(canAccept('MEDICAL_REVIEW'), false);
});

test('adjudication is available only for amber/late-review holds', () => {
  assert.equal(canAdjudicate('DOCUMENT_REVIEW_AMBER'), true);
  assert.equal(canAdjudicate('ADJUDICATION_REVIEW'), true);
  assert.equal(canAdjudicate('DOCUMENT_REVIEW_GREEN'), false);
});
