import assert from 'node:assert/strict';
import test from 'node:test';
import { describeResult, formatCorrectAnswer, formatDuration, formatStudentAnswer, pointsLabel } from '../src/answerDisplay.ts';
import { gradeAttempt, resolveReviewData } from '../src/grading.ts';

const slotQuestion = {
  id: 'blanks', responseType: 'multi-blank', points: 2,
  answerSlots: [
    { id: 'a', label: '1', correctAnswers: ['colour', 'color'] },
    { id: 'b', label: '2', correctAnswers: ['water'] },
  ],
};

test('answers are formatted for single, multiple, slot and ordered responses', () => {
  const rows = gradeAttempt([
    { id: 'm', responseType: 'single-choice', options: ['**A**', 'B'], correctAnswer: '**A**', points: 1 },
    { id: 's', responseType: 'short-text', correctAnswer: 'New York', acceptedAnswers: ['NYC'], points: 1 },
    { id: 'ms', responseType: 'multiple-select', options: ['A', 'B', 'C'], correctAnswer: ['A', 'C'], points: 1 },
    slotQuestion,
    { id: 'o', responseType: 'ordering', options: ['x', 'y'], correctOrder: ['y', 'x'], points: 1 },
    { id: 'w', responseType: 'long-text', manualReview: true, points: 5 },
  ], { m: 'B', s: 'nyc', ms: ['A'], blanks: { a: 'color', b: 'oil' }, o: ['x', 'y'], w: 'text' }).questionReviews;
  const byId = Object.fromEntries(rows.map(row => [row.questionId, row]));
  assert.equal(formatStudentAnswer(byId.m), 'B');
  assert.equal(formatCorrectAnswer(byId.m), 'A');
  assert.equal(formatCorrectAnswer(byId.s), 'New York (also accepted: NYC)');
  assert.equal(formatStudentAnswer(byId.ms), 'A');
  assert.equal(formatCorrectAnswer(byId.ms), 'A, C');
  assert.equal(formatStudentAnswer(byId.blanks), '1: color; 2: oil');
  assert.equal(formatCorrectAnswer(byId.blanks), '1: colour / color; 2: water');
  assert.equal(formatStudentAnswer(byId.o), '1. x  2. y');
  assert.equal(formatCorrectAnswer(byId.o), '1. y  2. x');
  assert.equal(formatCorrectAnswer(byId.w), 'Teacher review');
});

test('empty answers read as "No answer"', () => {
  const [row] = gradeAttempt([{ id: 'q', responseType: 'short-text', correctAnswer: 'x', points: 1 }], {}).questionReviews;
  assert.equal(formatStudentAnswer(row), 'No answer');
  assert.equal(describeResult(row).kind, 'unanswered');
  assert.equal(pointsLabel(row), '0 / 1');
});

test('result labels distinguish correct, partial, incorrect and pending rows', () => {
  const rows = gradeAttempt([
    { id: 'a', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'A', points: 1 },
    { id: 'b', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'A', points: 1 },
    { ...slotQuestion },
    { id: 'w', responseType: 'long-text', manualReview: true, points: 5 },
  ], { a: 'A', b: 'B', blanks: { a: 'colour', b: 'oil' }, w: 'x' }).questionReviews;
  assert.deepEqual(rows.map(row => describeResult(row).kind), ['correct', 'incorrect', 'partial', 'pending']);
  assert.equal(pointsLabel(rows[2]), '1 / 2');
  assert.equal(pointsLabel(rows[3]), '? / 5');
});

test('reviewed writing rows show the awarded marks', () => {
  const [row] = gradeAttempt([{ id: 'w', responseType: 'long-text', manualReview: true, points: 9 }], { w: 'x' }, [
    { questionId: 'w', teacherReview: { points: 6, reviewedAt: '2026-01-01T00:00:00.000Z' } },
  ]).questionReviews;
  assert.equal(pointsLabel(row), '6 / 9');
  assert.equal(describeResult(row).kind, 'partial');
});

test('durations are readable', () => {
  assert.equal(formatDuration(0), '–');
  assert.equal(formatDuration(75), '1m 15s');
  assert.equal(formatDuration(3725), '1h 02m');
});

test('review data prefers trusted scores, then the student grade, then a live computation', () => {
  const questions = [
    { id: 'a', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'A', points: 1 },
    { id: 'w', responseType: 'long-text', manualReview: true, points: 4 },
  ];
  const graded = gradeAttempt(questions, { a: 'A', w: 'essay' });
  const trusted = resolveReviewData({ ...graded, answers: { a: 'A', w: 'essay' } });
  assert.equal(trusted.source, 'trusted');
  assert.equal(trusted.summary?.pendingReviewCount, 1);
  assert.equal(trusted.summary?.scoredMaximum, 1);
  assert.equal(trusted.percentage, 100);

  const provisional = resolveReviewData({ score: null, selfGrade: graded });
  assert.equal(provisional.source, 'provisional');

  const computed = resolveReviewData({ score: null, answers: { a: 'B' } }, questions);
  assert.equal(computed.source, 'computed');
  assert.equal(computed.summary?.score, 0);
  assert.equal(computed.percentage, 0);

  assert.equal(resolveReviewData({ score: null }).source, 'none');
  assert.equal(resolveReviewData(null).summary, null);
});
