import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getEffectiveGrade, gradeAttempt, needsAutoGrading, percentOf } from '../src/grading.ts';
import { parseQuestionBank } from '../src/questionBank.ts';

const banksDirectory = join(process.cwd(), 'sample-data');
const skipBanks = !existsSync(join(banksDirectory, 'nuet-regression-pilot.json'))
  ? 'Teacher-only sample banks are local and Git-ignored; provide sample-data to run bank-content checks.'
  : false;

function perfectAnswer(question: any): unknown {
  switch (question.responseType) {
    case 'multiple-select': return question.correctAnswer;
    case 'ordering': return question.correctOrder;
    case 'multi-blank':
    case 'matching': return Object.fromEntries(question.answerSlots.map((slot: any) => [slot.id, slot.correctAnswers[0]]));
    default: return question.correctAnswer;
  }
}

const mixedQuestions = [
  { id: 'mcq', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'B', points: 1 },
  { id: 'short', responseType: 'short-text', correctAnswer: 'New York', acceptedAnswers: ['NYC'], points: 1 },
  { id: 'multi', responseType: 'multiple-select', options: ['A', 'B', 'C'], correctAnswer: ['A', 'C'], points: 2 },
  { id: 'match', responseType: 'matching', points: 2, sharedChoices: ['H1', 'H2'], answerSlots: [
    { id: 's1', label: '1', correctAnswers: ['H1'] }, { id: 's2', label: '2', correctAnswers: ['H2'] },
  ] },
  { id: 'order', responseType: 'ordering', options: ['x', 'y'], correctOrder: ['y', 'x'], points: 1 },
  { id: 'essay', responseType: 'long-text', manualReview: true, points: 9 },
];

test('objective questions are scored immediately and only writing stays pending', () => {
  const graded = gradeAttempt(mixedQuestions, {
    mcq: 'b', short: '  nyc ', multi: ['A', 'C'], match: { s1: 'H1', s2: 'H2' }, order: ['y', 'x'], essay: 'My essay text',
  });
  assert.equal(graded.score, 7);
  assert.equal(graded.maxPossibleScore, 16);
  assert.equal(graded.scoredMaximum, 7);
  assert.equal(graded.correctCount, 5);
  assert.equal(graded.incorrectCount, 0);
  assert.equal(graded.pendingReviewCount, 1);
  assert.equal(graded.reviewStatus, 'pending-review');
  assert.equal(percentOf(graded.score, graded.scoredMaximum), 100);
});

test('a test without writing is fully reviewed with a final score', () => {
  const graded = gradeAttempt(mixedQuestions.slice(0, 5), { mcq: 'A', short: 'Boston', multi: ['A'], match: { s1: 'H1', s2: 'H1' }, order: ['x', 'y'] });
  assert.equal(graded.pendingReviewCount, 0);
  assert.equal(graded.reviewStatus, 'reviewed');
  assert.equal(graded.maxPossibleScore, graded.scoredMaximum);
  assert.equal(graded.incorrectCount, 5);
  assert.ok(graded.score < graded.maxPossibleScore);
});

test('unanswered questions are counted separately and never as pending', () => {
  const graded = gradeAttempt(mixedQuestions, { mcq: 'B' });
  assert.equal(graded.answeredCount, 1);
  assert.equal(graded.unansweredCount, 5);
  assert.equal(graded.pendingReviewCount, 0);
  assert.equal(graded.score, 1);
});

test('teacher marking is preserved when a submission is graded again', () => {
  const first = gradeAttempt(mixedQuestions, { essay: 'Essay' });
  const reviewed = first.questionReviews.map(row => row.questionId === 'essay'
    ? { ...row, teacherReview: { points: 6, feedback: 'Good', reviewedAt: '2026-01-01T00:00:00.000Z' } }
    : row);
  const again = gradeAttempt(mixedQuestions, { essay: 'Essay' }, reviewed);
  assert.equal(again.pendingReviewCount, 0);
  assert.equal(again.score, 6);
  assert.equal(again.reviewStatus, 'reviewed');
});

test('formatted keys and answers still match', () => {
  const questions = [{ id: 'f', responseType: 'short-text', correctAnswer: '[[align:center]]**Paris**[[/align]]', points: 1 }];
  assert.equal(gradeAttempt(questions, { f: ' paris ' }).score, 1);
});

test('the trusted teacher score wins over the provisional student grade', () => {
  const rows = gradeAttempt(mixedQuestions.slice(0, 1), { mcq: 'B' });
  assert.equal(getEffectiveGrade({ selfGrade: rows }).source, 'provisional');
  assert.equal(getEffectiveGrade({ score: 1, questionReviews: rows.questionReviews, selfGrade: rows }).source, 'trusted');
  assert.equal(getEffectiveGrade({ score: null }).source, 'none');
  assert.equal(getEffectiveGrade(null).source, 'none');
});

test('submissions without a stored score are queued for automatic grading, legacy ones are not', () => {
  assert.equal(needsAutoGrading({ score: null }), true);
  assert.equal(needsAutoGrading({ score: 3, questionReviews: [] }), true);
  assert.equal(needsAutoGrading({ score: 3, questionReviews: [{} as any] }), false);
  assert.equal(needsAutoGrading({ score: null, gradingMode: 'legacy-unverified' }), false);
});

test('every sample bank scores perfectly with its own answer key and zero when left blank', { skip: skipBanks }, () => {
  const files = readdirSync(banksDirectory).filter(name => name.endsWith('.json') && name !== 'sat-combined-full.json');
  let checked = 0;
  for (const file of files) {
    const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, file), 'utf8')));
    const objective = bank.questions.filter((question: any) => question.responseType !== 'long-text' && !question.manualReview && !question.ungraded && question.responseType);
    if (!objective.length) continue;
    const perfect = gradeAttempt(objective, Object.fromEntries(objective.map((question: any) => [question.id, perfectAnswer(question)])));
    assert.equal(perfect.pendingReviewCount, 0, `${file} has no pending rows`);
    assert.equal(perfect.score, perfect.maxPossibleScore, `${file} perfect answers`);
    assert.equal(perfect.incorrectCount, 0, `${file} no incorrect rows`);
    const blank = gradeAttempt(objective, {});
    assert.equal(blank.score, 0, `${file} blank answers`);
    assert.equal(blank.unansweredCount, objective.length, `${file} blank count`);
    checked += objective.length;
  }
  assert.ok(checked > 50);
});

test('sample bank writing prompts stay pending while their objective questions are graded', { skip: skipBanks }, () => {
  const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, 'ielts-academic-writing-full.json'), 'utf8')));
  const graded = gradeAttempt(bank.questions, Object.fromEntries(bank.questions.map((question: any) => [question.id, 'A written answer'])));
  assert.equal(graded.pendingReviewCount, bank.questions.length);
  assert.equal(graded.reviewStatus, 'pending-review');
  assert.equal(graded.scoredMaximum, 0);
});
