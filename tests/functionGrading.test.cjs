const assert = require('node:assert/strict');
const test = require('node:test');
const { gradeAssessment } = require('../functions/grading.js');

test('trusted grading keeps manual writing out of auto-score and computes an informative denominator', () => {
  const result = gradeAssessment([
    { id: 'mcq', responseType: 'single-choice', options: ['A', 'B'], correctAnswer: 'B', points: 2 },
    { id: 'essay', responseType: 'long-text', manualReview: true, points: 1, text: 'Write.' },
  ], { mcq: 'B', essay: 'My response' });
  assert.equal(result.score, 2);
  assert.equal(result.maxPossibleScore, 2);
  assert.equal(result.manualReviewCount, 1);
  assert.equal(result.questionReviews[1].status, 'manual-review');
});

test('trusted grading supports slot answers, accepted alternatives, and numeric tolerance', () => {
  const result = gradeAssessment([
    { id: 'slots', responseType: 'multi-blank', points: 2, answerSlots: [
      { id: 'a', correctAnswers: ['colour', 'color'] }, { id: 'b', correctAnswers: ['blue'] },
    ] },
    { id: 'number', responseType: 'numeric', correctAnswer: 10, numericTolerance: 0.1 },
  ], { slots: { a: 'COLOR', b: 'blue' }, number: '10.05' });
  assert.equal(result.score, 3);
  assert.equal(result.questionReviews.every(review => review.isCorrect), true);
});
