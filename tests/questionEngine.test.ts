import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeQuestion, normalizeQuestion, resolveResponseType, responseTypeForQuestionType, validateQuestion } from '../src/questionEngine.ts';

test('maps teacher-selected IELTS formats to the matching student response form', () => {
  assert.equal(responseTypeForQuestionType('multiple-choice'), 'single-choice');
  assert.equal(responseTypeForQuestionType('multiple-select'), 'multiple-select');
  assert.equal(responseTypeForQuestionType('ordering'), 'ordering');
  assert.equal(responseTypeForQuestionType('true-false-not-given'), 'single-choice');
  assert.equal(responseTypeForQuestionType('matching-headings'), 'matching');
  assert.equal(responseTypeForQuestionType('sentence-endings'), 'matching');
  assert.equal(responseTypeForQuestionType('completion'), 'multi-blank');
  assert.equal(responseTypeForQuestionType('map-labeling'), 'multi-blank');
  assert.equal(responseTypeForQuestionType('sat-student-produced-response'), 'numeric');
  assert.equal(responseTypeForQuestionType('writing-task'), 'long-text');
  assert.equal(responseTypeForQuestionType('short-answer'), 'short-text');
});

test('normalizes legacy NUET MCQ and IELTS TFNG records without migrating storage', () => {
  const legacy = { id: 'legacy', type: 'mcq', text: 'Pick one', options: ['A', 'B'], correctAnswer: 'B' };
  assert.equal(resolveResponseType(legacy), 'single-choice');
  assert.equal(gradeQuestion(legacy, 'B').isCorrect, true);
  const tfng = normalizeQuestion({ id: 'tfng', type: 'select', questionType: 'true-false-not-given', correctAnswer: 'Not Given' });
  assert.deepEqual(tfng.options, ['True', 'False', 'Not Given']);
  assert.equal(gradeQuestion(tfng, 'Not Given').isCorrect, true);
  assert.equal('responseType' in legacy, false);
});

test('normalizes case and whitespace and checks teacher accepted alternatives', () => {
  const q = { id: 'text', type: 'text', responseType: 'short-text', correctAnswer: 'New York', acceptedAnswers: ['NYC'] };
  assert.equal(gradeQuestion(q, '  nEW   york ').isCorrect, true);
  assert.equal(gradeQuestion(q, 'nyc').isCorrect, true);
  assert.equal(gradeQuestion(q, 'Boston').isCorrect, false);
});

test('compares numeric responses numerically and applies only configured tolerance', () => {
  const exact = { id: 'number', type: 'number', correctAnswer: 1.5 };
  assert.equal(gradeQuestion(exact, '1.50').isCorrect, true);
  assert.equal(gradeQuestion(exact, '1.51').isCorrect, false);
  assert.equal(gradeQuestion({ ...exact, numericTolerance: 0.02 }, '1.51').isCorrect, true);
});

test('awards proportional partial credit for multiple select', () => {
  const q = { id: 'multi', responseType: 'multiple-select', options: ['A', 'B', 'C'], correctAnswer: ['A', 'C'], points: 2 };
  assert.equal(gradeQuestion(q, ['A']).earnedPoints, 1);
  assert.equal(gradeQuestion(q, ['A', 'C']).isCorrect, true);
  assert.equal(gradeQuestion(q, ['A', 'B']).earnedPoints, 0);
});

test('grades matching and multiple blanks by independently keyed slots', () => {
  const matching = { id: 'matching', responseType: 'matching', points: 4, answerSlots: [
    { id: 'a', label: 'A', correctAnswers: ['Heading 1'] },
    { id: 'b', label: 'B', correctAnswers: ['Heading 2'] },
  ] };
  assert.equal(gradeQuestion(matching, { a: 'Heading 1', b: 'Heading 3' }).earnedPoints, 2);
  const noReuse = { id: 'no-reuse', responseType: 'matching', points: 2, answerSlots: [
    { id: 'x', label: 'X', correctAnswers: ['A'] },
    { id: 'y', label: 'Y', correctAnswers: ['A'] },
  ] };
  assert.equal(gradeQuestion(noReuse, { x: 'A', y: 'A' }).earnedPoints, 1);
  const completion = { id: 'blank', responseType: 'multi-blank', points: 2, answerSlots: [
    { id: 'x', label: '1', correctAnswers: ['colour', 'color'] },
    { id: 'y', label: '2', correctAnswers: ['water'] },
  ] };
  assert.equal(gradeQuestion(completion, { x: 'COLOR', y: 'water' }).isCorrect, true);
});

test('grades ordering by correctly placed items and keeps essay responses for review', () => {
  const order = { id: 'order', responseType: 'ordering', options: ['one', 'two', 'three'], correctOrder: ['two', 'one', 'three'] };
  assert.equal(gradeQuestion(order, ['two', 'one', 'three']).isCorrect, true);
  assert.equal(gradeQuestion(order, ['one', 'two', 'three']).earnedPoints, 1 / 3);
  assert.equal(gradeQuestion({ id: 'essay', responseType: 'long-text', correctAnswer: 'not used' }, 'A full essay').status, 'manual-review');
  assert.equal(gradeQuestion({ id: 'essay', responseType: 'long-text' }, '').status, 'unanswered');
  assert.equal(gradeQuestion({ id: 'practice', responseType: 'short-text', ungraded: true }, 'answer').status, 'ungraded');
});

test('validates answer keys and shared choices before publishing', () => {
  assert.deepEqual(validateQuestion({ id: 'bad', responseType: 'single-choice', text: 'Choose', options: ['A', 'B'] }), ['Set the correct answer or mark this question for manual review.']);
  assert.equal(validateQuestion({ id: 'ok', responseType: 'matching', text: 'Match', sharedChoices: ['A', 'B'], answerSlots: [{ id: 'a', label: '1', correctAnswers: ['A'] }] }).length, 0);
  assert.equal(validateQuestion({ id: 'manual', responseType: 'single-choice', text: 'Pick', options: ['A', 'B'], manualReview: true }).length, 0);
  assert.equal(validateQuestion({ id: 'essay', responseType: 'long-text', text: 'Write', manualReview: true }).length, 0);
});
