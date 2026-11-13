import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPerQuestionTimerEnabled,
  locateQuestionPosition,
  normalizeQuestionSeconds,
  resolveQuestionTimeLimit,
  totalQuestionSeconds,
  validateQuestionTimeLimit,
} from '../src/questionTimer.ts';

const timedTest = { perQuestionTimer: true };
const questions = [{ id: 'a' }, { id: 'b', timeLimitSeconds: 30 }, { id: 'c' }];

test('timer is off unless the test opts in', () => {
  assert.equal(isPerQuestionTimerEnabled({}), false);
  assert.equal(resolveQuestionTimeLimit({}, { timeLimitSeconds: 30 }), null);
});

test('questions default to two minutes and accept a teacher override', () => {
  assert.equal(resolveQuestionTimeLimit(timedTest, questions[0]), 120);
  assert.equal(resolveQuestionTimeLimit(timedTest, questions[1]), 30);
  assert.equal(resolveQuestionTimeLimit({ ...timedTest, defaultQuestionSeconds: 90 }, questions[0]), 90);
  assert.equal(totalQuestionSeconds(timedTest, questions), 120 + 30 + 120);
});

test('invalid overrides fall back to the default and are reported', () => {
  assert.equal(normalizeQuestionSeconds(5), null);
  assert.equal(normalizeQuestionSeconds(601), null);
  assert.equal(normalizeQuestionSeconds(45.5), null);
  assert.equal(normalizeQuestionSeconds('45'), 45);
  assert.equal(resolveQuestionTimeLimit(timedTest, { timeLimitSeconds: 3 }), 120);
  assert.deepEqual(validateQuestionTimeLimit(''), []);
  assert.deepEqual(validateQuestionTimeLimit(60), []);
  assert.equal(validateQuestionTimeLimit(2).length, 1);
});

test('position stays put while the current question still has time', () => {
  assert.deepEqual(locateQuestionPosition(timedTest, questions, 0, 1_000, 60_000), { index: 0, questionStartedAtMs: 1_000, finished: false });
});

test('position skips forward over questions whose time ran out while away', () => {
  // q0 (120 s) ends at 121_000; q1 (30 s) ends at 151_000; now is 160_000 so q2 has run 9 s.
  assert.deepEqual(locateQuestionPosition(timedTest, questions, 0, 1_000, 160_000), { index: 2, questionStartedAtMs: 151_000, finished: false });
});

test('position reports finished once the last question runs out', () => {
  const result = locateQuestionPosition(timedTest, questions, 0, 0, 10 * 60_000);
  assert.equal(result.index, 2);
  assert.equal(result.finished, true);
});
