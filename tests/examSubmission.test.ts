import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPendingExamSubmission,
  getSubmissionErrorCode,
  getSubmissionErrorMessage,
  isRetryableSubmissionError,
  loadPendingExamSubmission,
  retryWithBackoff,
  savePendingExamSubmission,
} from '../src/examSubmission.ts';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('Firebase codes are extracted from wrapped errors and explained without hiding the code', () => {
  const error = Object.assign(new Error('save failed'), { cause: Object.assign(new Error('permission denied'), { code: 'firestore/permission-denied' }) });
  assert.equal(getSubmissionErrorCode(error), 'permission-denied');
  assert.equal(isRetryableSubmissionError(error), false);
  assert.match(getSubmissionErrorMessage(error), /permission-denied/);
  assert.match(getSubmissionErrorMessage(error), /saved on this device/);
});

test('pending submissions survive reload and can be removed after success', () => {
  const storage = new MemoryStorage();
  const payload = { attemptId: 'attempt-1', answers: { q1: 'A' }, isAutoSubmitted: true };
  savePendingExamSubmission(storage, 'student-1', 'test-1', payload, { code: 'unavailable' }, 123);
  assert.deepEqual(loadPendingExamSubmission<typeof payload>(storage, 'student-1', 'test-1'), {
    userId: 'student-1', testId: 'test-1', payload, errorCode: 'unavailable', queuedAt: 123,
  });
  assert.equal(loadPendingExamSubmission(storage, 'student-2', 'test-1'), null);
  clearPendingExamSubmission(storage, 'student-1', 'test-1');
  assert.equal(loadPendingExamSubmission(storage, 'student-1', 'test-1'), null);
});

test('retry uses bounded exponential backoff for transient errors only', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await retryWithBackoff(async () => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    return 'saved';
  }, { delayMs: 10, wait: async delay => { delays.push(delay); } });
  assert.equal(result, 'saved');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);

  attempts = 0;
  await assert.rejects(retryWithBackoff(async () => {
    attempts++;
    throw Object.assign(new Error('denied'), { code: 'permission-denied' });
  }, { wait: async () => { throw new Error('must not retry permission errors'); } }));
  assert.equal(attempts, 1);
});
