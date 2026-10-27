import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLegacyResult, parseLegacyResultPath } from '../src/legacyMigration.ts';

const appId = 'portal';
const validPath = 'artifacts/portal/users/student-a/results/attempt-1';

test('legacy migration accepts only the expected private result path', () => {
  assert.deepEqual(parseLegacyResultPath(validPath, appId), { studentUid: 'student-a', resultId: 'attempt-1' });
  assert.equal(parseLegacyResultPath('artifacts/other/users/student-a/results/attempt-1', appId), null);
  assert.equal(parseLegacyResultPath('artifacts/portal/public/data/results/attempt-1', appId), null);
  assert.equal(parseLegacyResultPath('artifacts/portal/users/../results/attempt-1', appId), null);
});

test('legacy import uses deterministic IDs and isolates client-controlled score fields', () => {
  const imported = mapLegacyResult({
    testId: 'test-1',
    displayTitle: 'Historical test',
    score: 9,
    questionReviews: [{ answerKey: 'secret' }],
    arbitraryTrustedField: true,
    studentName: '  Learner  ',
  }, validPath, appId, 'teacher-a', 'timestamp');

  assert.equal(imported.id, 'legacy_student-a_attempt-1');
  assert.equal(imported.gradingMode, 'legacy-unverified');
  assert.equal(imported.studentName, 'Learner');
  assert.equal('score' in imported, false);
  assert.equal(imported.legacyHistoricalData.score, 9);
  assert.equal('arbitraryTrustedField' in imported.legacyHistoricalData, false);
});

test('legacy mapper rejects malformed source paths instead of creating records', () => {
  assert.throws(() => mapLegacyResult({}, 'artifacts/portal/users/a/results', appId, 'teacher-a', null), /expected private student results path/);
});
