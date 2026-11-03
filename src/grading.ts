import { gradeQuestion, resolveResponseType, type EngineQuestion } from './questionEngine.ts';

export type TeacherReview = {
  feedback?: string;
  points?: number;
  annotations?: unknown[];
  reviewedAt?: string;
};

export type ReviewRow = {
  questionId: string;
  questionText: string;
  section: string;
  passageNumber: number | null;
  listeningSectionNumber: number | null;
  writingTaskType: number | null;
  satDomain: string;
  satSkill: string;
  responseType: string;
  studentAnswer: unknown;
  points: number;
  status: 'unanswered' | 'graded' | 'manual-review' | 'ungraded';
  isCorrect: boolean | null;
  earnedPoints: number | null;
  answerKey: Record<string, unknown>;
  acceptedAnswers: unknown[];
  explanation: string;
  teacherReview?: TeacherReview;
};

export type GradeSummary = {
  score: number;
  maxPossibleScore: number;
  maxAutoScore: number;
  scoredMaximum: number;
  correctCount: number;
  incorrectCount: number;
  answeredCount: number;
  unansweredCount: number;
  pendingReviewCount: number;
  manualReviewCount: number;
  ungradedCount: number;
  reviewStatus: 'pending-review' | 'reviewed';
};

export function createReviewRows(questions: any[], answers: Record<string, unknown>): ReviewRow[] {
  return questions.map((question: any) => {
    const studentAnswer = answers?.[question.id] ?? null;
    const grade = gradeQuestion(question as EngineQuestion, studentAnswer);
    return {
      questionId: question.id,
      questionText: question.text || '',
      section: question.section || '',
      passageNumber: question.passageNumber || null,
      listeningSectionNumber: question.listeningSectionNumber || null,
      writingTaskType: question.writingTaskType || null,
      satDomain: question.satDomain || '',
      satSkill: question.satSkill || '',
      responseType: resolveResponseType(question),
      studentAnswer,
      points: Math.max(0, Number(question.points ?? 1) || 0),
      status: grade.status,
      isCorrect: grade.isCorrect,
      earnedPoints: grade.status === 'graded' ? grade.earnedPoints : null,
      answerKey: {
        responseType: resolveResponseType(question),
        correctAnswer: question.correctAnswer ?? null,
        acceptedAnswers: question.acceptedAnswers || [],
        answerSlots: question.answerSlots || [],
        correctOrder: question.correctOrder || [],
      },
      acceptedAnswers: question.acceptedAnswers || [],
      explanation: question.explanation || '',
    };
  });
}

const isPending = (row: ReviewRow) => row.status === 'manual-review' && !row.teacherReview?.reviewedAt;

export function summarizeReviews(rows: ReviewRow[], questions: any[]): GradeSummary {
  const pending = rows.filter(isPending);
  const maxPossibleScore = questions
    .filter(question => !question.ungraded)
    .reduce((total, question) => total + Math.max(0, Number(question.points ?? 1) || 0), 0);
  const score = rows.reduce((total, row) => {
    if (row.status === 'graded') return total + Math.max(0, Math.min(row.points, Number(row.earnedPoints || 0)));
    if (row.status === 'manual-review' && row.teacherReview?.reviewedAt) return total + Math.max(0, Math.min(row.points, Number(row.teacherReview.points || 0)));
    return total;
  }, 0);
  const scoredRows = rows.filter(row => row.status === 'graded' || (row.status === 'manual-review' && row.teacherReview?.reviewedAt));
  const correctCount = scoredRows.filter(row => row.status === 'graded' ? row.isCorrect === true : Number(row.teacherReview?.points) >= row.points).length;
  const answeredCount = rows.filter(row => row.status !== 'unanswered').length;
  const pendingPoints = pending.reduce((total, row) => total + row.points, 0);
  return {
    score,
    maxPossibleScore,
    maxAutoScore: maxPossibleScore,
    scoredMaximum: Math.max(0, maxPossibleScore - pendingPoints),
    correctCount,
    incorrectCount: scoredRows.length - correctCount,
    answeredCount,
    unansweredCount: rows.length - answeredCount,
    pendingReviewCount: pending.length,
    manualReviewCount: pending.length,
    ungradedCount: rows.filter(row => row.status === 'ungraded').length,
    reviewStatus: pending.length ? 'pending-review' : 'reviewed',
  };
}

// Grades every objective question and keeps any teacher marking already stored for
// writing or other manual-review questions.
export function gradeAttempt(questions: any[], answers: Record<string, unknown>, previousReviews: Array<Partial<ReviewRow>> = []) {
  const previous = new Map(previousReviews.map(review => [review.questionId, review]));
  const questionReviews = createReviewRows(questions, answers).map(row => {
    const teacherReview = previous.get(row.questionId)?.teacherReview;
    return teacherReview ? { ...row, teacherReview } : row;
  });
  return { questionReviews, ...summarizeReviews(questionReviews, questions) };
}

export function percentOf(score: number, maximum: number): number | null {
  return maximum > 0 ? Math.round((score / maximum) * 1000) / 10 : null;
}

type GradedRecord = {
  score?: number | null;
  maxPossibleScore?: number | null;
  maxAutoScore?: number | null;
  questionReviews?: ReviewRow[];
  selfGrade?: (Partial<GradeSummary> & { questionReviews?: ReviewRow[] }) | null;
  gradingMode?: string;
};

// Prefers the score written by a teacher client. Until that happens the student's own
// provisional grade (computed after submission from the released key) is shown.
export function getEffectiveGrade(record: GradedRecord | null | undefined): {
  source: 'trusted' | 'provisional' | 'none';
  summary: GradeSummary | null;
  questionReviews: ReviewRow[];
} {
  if (!record) return { source: 'none', summary: null, questionReviews: [] };
  if (record.score != null && Array.isArray(record.questionReviews) && record.questionReviews.length) {
    return { source: 'trusted', summary: record as unknown as GradeSummary, questionReviews: record.questionReviews };
  }
  const selfGrade = record.selfGrade;
  if (selfGrade && Array.isArray(selfGrade.questionReviews) && selfGrade.questionReviews.length) {
    return { source: 'provisional', summary: selfGrade as unknown as GradeSummary, questionReviews: selfGrade.questionReviews };
  }
  return { source: 'none', summary: null, questionReviews: [] };
}

export function needsAutoGrading(submission: GradedRecord & { reviewStatus?: string }): boolean {
  if (submission.gradingMode === 'legacy-unverified') return false;
  return submission.score == null || !Array.isArray(submission.questionReviews) || submission.questionReviews.length === 0;
}

export type ReviewData = {
  source: 'trusted' | 'provisional' | 'computed' | 'none';
  summary: GradeSummary | null;
  questionReviews: ReviewRow[];
  percentage: number | null;
};

// Everything the results page needs, whichever grade is available. Teachers can pass the
// assessment questions so an ungraded submission is still shown from the live answer key.
export function resolveReviewData(record: (GradedRecord & { answers?: Record<string, unknown> }) | null | undefined, fallbackQuestions: any[] = []): ReviewData {
  const effective = getEffectiveGrade(record);
  let source: ReviewData['source'] = effective.source;
  let rows = effective.questionReviews;
  let summary = effective.summary ? { ...effective.summary } : null;
  if (!summary && record && fallbackQuestions.length && record.answers) {
    const graded = gradeAttempt(fallbackQuestions, record.answers, record.questionReviews || []);
    rows = graded.questionReviews;
    summary = graded;
    source = 'computed';
  }
  if (!summary) return { source: 'none', summary: null, questionReviews: [], percentage: null };
  const pendingPoints = rows.filter(isPending).reduce((total, row) => total + row.points, 0);
  const maxPossibleScore = Number(summary.maxPossibleScore ?? summary.maxAutoScore ?? rows.reduce((total, row) => total + row.points, 0));
  const answeredCount = rows.filter(row => row.status !== 'unanswered').length;
  const completed: GradeSummary = {
    ...summary,
    score: Number(summary.score || 0),
    maxPossibleScore,
    maxAutoScore: maxPossibleScore,
    scoredMaximum: Math.max(0, maxPossibleScore - pendingPoints),
    answeredCount,
    unansweredCount: rows.length - answeredCount,
    pendingReviewCount: rows.filter(isPending).length,
  };
  return { source, summary: completed, questionReviews: rows, percentage: percentOf(completed.score, completed.scoredMaximum) };
}
