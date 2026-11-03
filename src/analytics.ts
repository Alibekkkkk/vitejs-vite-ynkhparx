import { formatStudentAnswer } from './answerDisplay.ts';
import { stripQuestionTextFormatting } from './questionTextFormatting.ts';
import type { ReviewRow } from './grading.ts';

type SubmissionLike = {
  id?: string;
  groupCode?: string;
  assessmentId?: string;
  gradingMode?: string;
  questionReviews?: ReviewRow[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

// Score of one attempt as a percentage of the questions that have been marked. Questions
// still waiting for a teacher and ungraded practice are left out, like the results page.
export function percentFromRows(rows: ReviewRow[]): number | null {
  let earned = 0;
  let possible = 0;
  for (const row of rows) {
    if (row.status === 'ungraded') continue;
    if (row.status === 'manual-review') {
      if (!row.teacherReview?.reviewedAt) continue;
      earned += Math.min(row.points, Number(row.teacherReview.points || 0));
    } else if (row.status === 'graded') {
      earned += Math.min(row.points, Number(row.earnedPoints || 0));
    }
    possible += row.points;
  }
  return possible > 0 ? round1((earned / possible) * 100) : null;
}

export function summarizeByGroup(submissions: SubmissionLike[]) {
  const groups = new Map<string, { attempts: number; scored: number; total: number }>();
  for (const submission of submissions) {
    if (submission.gradingMode === 'legacy-unverified') continue;
    const group = String(submission.groupCode || '').trim() || 'No group';
    const entry = groups.get(group) || { attempts: 0, scored: 0, total: 0 };
    entry.attempts++;
    const percent = percentFromRows(submission.questionReviews || []);
    if (percent != null) {
      entry.scored++;
      entry.total += percent;
    }
    groups.set(group, entry);
  }
  return [...groups.entries()]
    .map(([group, entry]) => ({ group, attempts: entry.attempts, scoredAttempts: entry.scored, averagePercent: entry.scored ? round1(entry.total / entry.scored) : null }))
    .sort((left, right) => left.group.localeCompare(right.group));
}

export type QuestionDifficultyRow = {
  questionId: string;
  number: number;
  text: string;
  attempts: number;
  correct: number;
  percentCorrect: number;
  commonWrongAnswer: string;
};

// Hardest questions first. Unanswered questions count as missed; questions awaiting
// teacher marking are not part of the statistics.
export function questionDifficulty(submissions: SubmissionLike[], assessmentId: string): QuestionDifficultyRow[] {
  const stats = new Map<string, { order: number; text: string; attempts: number; correct: number; wrong: Map<string, number> }>();
  for (const submission of submissions) {
    if (submission.gradingMode === 'legacy-unverified' || submission.assessmentId !== assessmentId) continue;
    (submission.questionReviews || []).forEach((row, index) => {
      if (row.status !== 'graded' && row.status !== 'unanswered') return;
      if (row.responseType === 'long-text') return;
      const entry = stats.get(row.questionId) || { order: index, text: stripQuestionTextFormatting(row.questionText || '').slice(0, 120), attempts: 0, correct: 0, wrong: new Map() };
      entry.attempts++;
      if (row.status === 'graded' && row.isCorrect) entry.correct++;
      else if (row.status === 'graded') {
        const answer = formatStudentAnswer(row);
        entry.wrong.set(answer, (entry.wrong.get(answer) || 0) + 1);
      }
      stats.set(row.questionId, entry);
    });
  }
  return [...stats.entries()]
    .map(([questionId, entry]) => ({
      questionId,
      number: entry.order + 1,
      text: entry.text,
      attempts: entry.attempts,
      correct: entry.correct,
      percentCorrect: round1((entry.correct / entry.attempts) * 100),
      commonWrongAnswer: [...entry.wrong.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '',
    }))
    .sort((left, right) => left.percentCorrect - right.percentCorrect || left.number - right.number);
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  const spreadsheetSafe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
};

export function questionDifficultyCsv(rows: QuestionDifficultyRow[]): string {
  const header = ['question', 'attempts', 'correct', 'percentCorrect', 'mostCommonWrongAnswer', 'questionText'];
  return [header.join(','), ...rows.map(row => [row.number, row.attempts, row.correct, row.percentCorrect, row.commonWrongAnswer, row.text].map(csvCell).join(','))].join('\r\n');
}
