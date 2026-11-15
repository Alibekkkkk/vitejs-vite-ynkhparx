// Per-question timing for NUET training tests.
//
// A test opts in with `perQuestionTimer: true`. Every question then gets
// `defaultQuestionSeconds` (120 s = 2 minutes unless the teacher changes it),
// and an individual question can override that with `timeLimitSeconds`.

export const NUET_DEFAULT_QUESTION_SECONDS = 120;
export const MIN_QUESTION_SECONDS = 10;
export const MAX_QUESTION_SECONDS = 600;

export const NUET_TRAINING_TYPE = 'NUET Training';
export const SAT_TRAINING_TYPE = 'SAT Training';
/** Assessment types that run one countdown per question and reveal each answer afterwards. */
export const TRAINING_TYPES = [NUET_TRAINING_TYPE, SAT_TRAINING_TYPE];

export function isTrainingType(type: unknown): boolean {
  return typeof type === 'string' && TRAINING_TYPES.includes(type);
}

type TimedTest = { type?: unknown; perQuestionTimer?: unknown; defaultQuestionSeconds?: unknown } | null | undefined;
type TimedQuestion = { timeLimitSeconds?: unknown } | null | undefined;

/** Whole seconds inside the allowed range, or null when the value is blank/invalid. */
export function normalizeQuestionSeconds(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const seconds = Number(value);
  if (!Number.isInteger(seconds)) return null;
  if (seconds < MIN_QUESTION_SECONDS || seconds > MAX_QUESTION_SECONDS) return null;
  return seconds;
}

export function isPerQuestionTimerEnabled(test: TimedTest): boolean {
  return isTrainingType(test?.type) || test?.perQuestionTimer === true;
}

export function getDefaultQuestionSeconds(test: TimedTest): number {
  return normalizeQuestionSeconds(test?.defaultQuestionSeconds) ?? NUET_DEFAULT_QUESTION_SECONDS;
}

/** Seconds allowed for this question, or null when the test has no per-question timer. */
export function resolveQuestionTimeLimit(test: TimedTest, question: TimedQuestion): number | null {
  if (!isPerQuestionTimerEnabled(test)) return null;
  return normalizeQuestionSeconds(question?.timeLimitSeconds) ?? getDefaultQuestionSeconds(test);
}

export function totalQuestionSeconds(test: TimedTest, questions: TimedQuestion[]): number {
  return questions.reduce((sum, question) => sum + (resolveQuestionTimeLimit(test, question) ?? 0), 0);
}

/** Error messages for a teacher-entered override (blank means "use the default"). */
export function validateQuestionTimeLimit(value: unknown): string[] {
  if (value === '' || value == null) return [];
  return normalizeQuestionSeconds(value) === null
    ? [`Question time limit must be a whole number of seconds from ${MIN_QUESTION_SECONDS} to ${MAX_QUESTION_SECONDS}.`]
    : [];
}

/** Whole seconds left for a question that started at `startedAtMs` (never negative). */
export function secondsRemaining(limitSeconds: number, startedAtMs: number, now: number): number {
  return Math.max(0, Math.ceil((startedAtMs + limitSeconds * 1000 - now) / 1000));
}
