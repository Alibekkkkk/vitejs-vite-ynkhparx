import test from 'node:test';
import assert from 'node:assert/strict';
import { createExamAttemptSnapshot, EXAM_RETURN_GRACE_MS, restoreExamAttempt } from '../src/examAttempt.ts';

test('exam attempt restore preserves the original start time, answers, and question position', () => {
  const startedAtMs = 10_000;
  const snapshot = {
    ...createExamAttemptSnapshot('reading-test', startedAtMs),
    attemptId: 'attempt-1',
    answers: { q1: 'answer' },
    currentIndex: 3,
    lastSeenAtMs: startedAtMs + 20_000,
    lastExitAtMs: startedAtMs + 20_000,
  };

  const restored = restoreExamAttempt(JSON.stringify(snapshot), 'reading-test', startedAtMs + 22_000);

  assert.equal(restored.status, 'resumable');
  if (restored.status !== 'resumable') return;
  assert.equal(restored.snapshot.startedAtMs, startedAtMs);
  assert.equal(restored.snapshot.attemptId, 'attempt-1');
  assert.deepEqual(restored.snapshot.answers, { q1: 'answer' });
  assert.equal(restored.snapshot.currentIndex, 3);
  assert.equal(restored.snapshot.lastExitAtMs, null);
});

test('an exam attempt expires after more than five minutes away', () => {
  const lastExitAtMs = 50_000;
  const snapshot = {
    ...createExamAttemptSnapshot('listening-test', lastExitAtMs - 1000),
    lastExitAtMs,
    lastSeenAtMs: lastExitAtMs,
  };

  assert.equal(restoreExamAttempt(JSON.stringify(snapshot), 'listening-test', lastExitAtMs + EXAM_RETURN_GRACE_MS).status, 'resumable');
  assert.equal(restoreExamAttempt(JSON.stringify(snapshot), 'listening-test', lastExitAtMs + EXAM_RETURN_GRACE_MS + 1).status, 'expired');
});

test('exam attempt restore rejects invalid or mismatched snapshots', () => {
  assert.equal(restoreExamAttempt(null, 'test').status, 'missing');
  assert.equal(restoreExamAttempt('{broken', 'test').status, 'invalid');
  assert.equal(restoreExamAttempt(JSON.stringify(createExamAttemptSnapshot('another-test')), 'test').status, 'invalid');
});
