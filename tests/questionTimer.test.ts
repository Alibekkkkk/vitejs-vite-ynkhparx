import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPerQuestionTimerEnabled,
  normalizeQuestionSeconds,
  secondsRemaining,
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

test('seconds remaining counts down and never goes negative', () => {
  assert.equal(secondsRemaining(120, 1_000, 1_000), 120);
  assert.equal(secondsRemaining(120, 1_000, 60_500), 61);
  assert.equal(secondsRemaining(30, 0, 45_000), 0);
});

test('the NUET Training type turns the per-question timer on by itself', () => {
  assert.equal(isPerQuestionTimerEnabled({ type: 'NUET Training' }), true);
  assert.equal(isPerQuestionTimerEnabled({ type: 'NUET' }), false);
});
