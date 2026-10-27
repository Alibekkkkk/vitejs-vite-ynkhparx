import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnswerKeyQuestions, hasCompleteAnswerKey, stripPublicAnswerFields } from '../src/answerKeyMigration.ts';

const question = {
  id: 'q1',
  text: 'Prompt text',
  imageAsset: { storagePath: 'figures/chart.png' },
  correctAnswer: 'A',
  acceptedAnswers: ['a'],
  answerSlots: [{ id: 'blank1', label: 'Answer', correctAnswers: ['tree'] }],
  explanation: 'Because',
};

test('answer-key migration combines existing private keys and public answers without losing IDs', () => {
  const mapped = buildAnswerKeyQuestions([question], [{ id: 'q1', explanation: 'Saved explanation' }], ['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation']);
  assert.equal(mapped[0].correctAnswer, 'A');
  assert.equal(mapped[0].explanation, 'Saved explanation');
  assert.equal(hasCompleteAnswerKey([question], mapped), true);
});

test('answer-key completeness checks every question and answer slot', () => {
  assert.equal(hasCompleteAnswerKey([question], []), false);
  const incomplete = buildAnswerKeyQuestions([question], [], ['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation']);
  incomplete[0].answerSlots = [];
  assert.equal(hasCompleteAnswerKey([question], incomplete), false);
});

test('public answer stripping preserves prompt and figure content', () => {
  const [visible] = stripPublicAnswerFields([question], ['correctAnswer', 'acceptedAnswers', 'explanation']);
  assert.equal(visible.text, 'Prompt text');
  assert.deepEqual(visible.imageAsset, question.imageAsset);
  assert.equal('correctAnswer' in visible, false);
  assert.equal('correctAnswers' in visible.answerSlots[0], false);
});
