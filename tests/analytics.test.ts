import assert from 'node:assert/strict';
import test from 'node:test';
import { percentFromRows, questionDifficulty, questionDifficultyCsv, summarizeByGroup } from '../src/analytics.ts';
import { gradeAttempt } from '../src/grading.ts';

const questions = [
  { id: 'a', text: '**Easy** one', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'A', points: 1 },
  { id: 'b', text: 'Hard one', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'A', points: 1 },
  { id: 'w', text: 'Essay', responseType: 'long-text', manualReview: true, points: 4 },
];

const submission = (groupCode: string, answers: Record<string, unknown>, extra = {}) => ({
  groupCode,
  assessmentId: 'test-1',
  questionReviews: gradeAttempt(questions, answers).questionReviews,
  ...extra,
});

const submissions = [
  submission('group a', { a: 'A', b: 'A', w: 'essay' }),
  submission('group a', { a: 'A', b: 'B', w: 'essay' }),
  submission('group b', { a: 'A' }),
  submission('', { a: 'B', b: 'B' }),
  { groupCode: 'group a', assessmentId: 'test-1', gradingMode: 'legacy-unverified', questionReviews: [] },
];

test('a percentage ignores questions that are still pending review', () => {
  assert.equal(percentFromRows(submissions[0].questionReviews), 100);
  assert.equal(percentFromRows(submissions[1].questionReviews), 50);
  assert.equal(percentFromRows([]), null);
});

test('group averages cover every group and skip legacy records', () => {
  // An unanswered written task still counts toward the maximum, exactly like the results page.
  assert.deepEqual(summarizeByGroup(submissions), [
    { group: 'group a', attempts: 2, scoredAttempts: 2, averagePercent: 75 },
    { group: 'group b', attempts: 1, scoredAttempts: 1, averagePercent: 16.7 },
    { group: 'No group', attempts: 1, scoredAttempts: 1, averagePercent: 0 },
  ].sort((left, right) => left.group.localeCompare(right.group)));
});

test('the hardest questions come first and unanswered counts as missed', () => {
  const rows = questionDifficulty(submissions, 'test-1');
  assert.deepEqual(rows.map(row => [row.number, row.attempts, row.correct, row.percentCorrect]), [[2, 4, 1, 25], [1, 4, 3, 75]]);
  assert.equal(rows[0].commonWrongAnswer, 'B');
  assert.equal(rows[1].text, 'Easy one');
  assert.deepEqual(questionDifficulty(submissions, 'other'), []);
});

test('difficulty exports as quoted CSV', () => {
  const csv = questionDifficultyCsv(questionDifficulty(submissions, 'test-1'));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'question,attempts,correct,percentCorrect,mostCommonWrongAnswer,questionText');
  assert.equal(lines[1], '"2","4","1","25","B","Hard one"');
});

test('difficulty CSV neutralizes spreadsheet formulas in student content', () => {
  const malicious = submission('group a', { a: '=HYPERLINK("https://example.com")' });
  const rows = questionDifficulty([malicious], 'test-1');
  const csv = questionDifficultyCsv(rows);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.com""\)"/);
});
