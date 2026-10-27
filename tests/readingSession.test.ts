import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingSessionViewModel } from '../src/readingSession.ts';

const makeSession = (passages: number[]) => buildReadingSessionViewModel({
  configuredPassages: passages.map(passageNumber => ({ passageNumber })),
  questions: passages.map((passageNumber, index) => ({ id: `question-${index}`, passageNumber })),
  activePassageId: String(passages.at(-1)),
  activeQuestionId: `question-${passages.length - 1}`,
  answers: { 'question-0': 'saved' },
  visitedQuestionIds: ['question-0'],
  leftScrollTopByPassage: { '1': 40 },
  rightScrollTopByPassage: { '1': 80 },
});

test('reading session derives one, two, or three passages and stable question ID groups', () => {
  for (const passages of [[1], [1, 2], [1, 2, 3]]) {
    const session = makeSession(passages);
    assert.deepEqual(session.passageIds, passages.map(String));
    assert.deepEqual(Object.keys(session.questionIdsByPassage), passages.map(String));
    assert.equal(session.activeQuestionId, `question-${passages.length - 1}`);
    assert.equal(session.activePassageId, String(passages.at(-1)));
  }
});

test('reading session retains answer and per-passage scroll data while changing passages', () => {
  const session = makeSession([1, 2]);
  assert.deepEqual(session.answers, { 'question-0': 'saved' });
  assert.deepEqual(session.leftScrollTopByPassage, { '1': 40 });
  assert.deepEqual(session.rightScrollTopByPassage, { '1': 80 });
  assert.deepEqual(session.visitedQuestionIds, ['question-0']);
});
