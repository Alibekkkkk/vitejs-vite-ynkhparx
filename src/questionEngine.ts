export type ResponseType =
  | 'single-choice'
  | 'multiple-select'
  | 'short-text'
  | 'multi-blank'
  | 'numeric'
  | 'matching'
  | 'ordering'
  | 'long-text';

export type AnswerSlot = {
  id: string;
  label: string;
  prompt?: string;
  correctAnswers?: Array<string | number>;
};

export type EngineQuestion = {
  id: string;
  type?: string;
  responseType?: ResponseType;
  questionType?: string;
  text?: string;
  options?: string[];
  correctAnswer?: string | number | string[];
  acceptedAnswers?: Array<string | number>;
  answerSlots?: AnswerSlot[];
  sharedChoices?: string[];
  correctOrder?: string[];
  allowChoiceReuse?: boolean;
  numericTolerance?: number;
  points?: number;
  manualReview?: boolean;
  ungraded?: boolean;
  [key: string]: unknown;
};

export type GradeResult = {
  status: 'unanswered' | 'graded' | 'manual-review' | 'ungraded';
  earnedPoints: number;
  possiblePoints: number;
  isCorrect: boolean | null;
};

export const RESPONSE_TYPE_LABELS: Array<[ResponseType, string]> = [
  ['single-choice', 'Single choice / MCQ / True-False-Not Given'],
  ['multiple-select', 'Multiple-select'],
  ['short-text', 'Short answer / single blank / completion'],
  ['multi-blank', 'Multiple blanks / table / form / notes / labels'],
  ['numeric', 'Numeric / student-produced response'],
  ['matching', 'Matching pairs / headings / features'],
  ['ordering', 'Ordering / sequencing'],
  ['long-text', 'Long written response (manual review)'],
];

export function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function resolveResponseType(question: EngineQuestion): ResponseType {
  const explicit = question.responseType;
  if (explicit && RESPONSE_TYPE_LABELS.some(([type]) => type === explicit)) return explicit;
  if (question.questionType === 'writing-task' || question.manualReview || question.ungraded) return 'long-text';
  if (question.questionType === 'sat-student-produced-response' || question.type === 'number') return 'numeric';
  if (['matching-headings', 'matching-information', 'matching-features', 'sentence-endings'].includes(question.questionType || '')) return 'matching';
  if (question.questionType === 'completion' || question.questionType === 'map-labeling') return 'multi-blank';
  if (question.type === 'mcq' || question.type === 'select') return 'single-choice';
  return 'short-text';
}

export function normalizeQuestion<T extends EngineQuestion>(question: T): T & { responseType: ResponseType } {
  const responseType = resolveResponseType(question);
  const legacyDefaultOptions = question.questionType === 'true-false-not-given' ? ['True', 'False', 'Not Given']
    : question.questionType === 'yes-no-not-given' ? ['Yes', 'No', 'Not Given'] : [];
  const options = Array.isArray(question.options) && question.options.length
    ? question.options.filter(value => typeof value === 'string')
    : legacyDefaultOptions;
  const correctAnswers = Array.isArray(question.correctAnswer)
    ? question.correctAnswer
    : question.correctAnswer == null || question.correctAnswer === '' ? [] : [question.correctAnswer];
  const acceptedAnswers = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];

  return {
    ...question,
    responseType,
    options,
    acceptedAnswers,
    answerSlots: Array.isArray(question.answerSlots) ? question.answerSlots : [],
    sharedChoices: Array.isArray(question.sharedChoices) ? question.sharedChoices : [],
    correctOrder: Array.isArray(question.correctOrder) ? question.correctOrder : [],
    ...(question.correctAnswer === undefined && correctAnswers.length ? { correctAnswer: correctAnswers[0] } : {}),
  };
}

export function getQuestionAnswerKey(question: EngineQuestion): Array<string | number> {
  const normalized = normalizeQuestion(question);
  if (normalized.responseType === 'multi-blank' || normalized.responseType === 'matching') return [];
  if (normalized.responseType === 'multiple-select') {
    const explicit = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    return [...explicit, ...(question.acceptedAnswers || [])];
  }
  if (normalized.responseType === 'ordering') return normalized.correctOrder || [];
  return [question.correctAnswer, ...(question.acceptedAnswers || [])]
    .filter((answer): answer is string | number => answer !== null && answer !== undefined && String(answer).trim() !== '');
}

function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAnswer);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasAnswer);
  return String(value ?? '').trim().length > 0;
}

export const isAnswerPresent = hasAnswer;

function textMatches(value: unknown, accepted: Array<string | number>): boolean {
  return accepted.some(candidate => normalizeText(candidate) === normalizeText(value));
}

function numericMatches(value: unknown, accepted: Array<string | number>, tolerance = 0): boolean {
  const actual = Number(String(value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(actual)) return false;
  return accepted.some(candidate => {
    const expected = Number(String(candidate).trim().replace(',', '.'));
    return Number.isFinite(expected) && Math.abs(actual - expected) <= Math.max(0, tolerance);
  });
}

function slotAnswers(question: EngineQuestion, answer: unknown): unknown[] {
  const normalized = normalizeQuestion(question);
  if (Array.isArray(answer)) return answer;
  if (answer && typeof answer === 'object') {
    const values = answer as Record<string, unknown>;
    return normalized.answerSlots!.map(slot => values[slot.id]);
  }
  return normalized.answerSlots!.length === 1 ? [answer] : [];
}

export function gradeQuestion(question: EngineQuestion, answer: unknown): GradeResult {
  const points = Math.max(0, Number(question.points ?? 1) || 0);
  const normalized = normalizeQuestion(question);
  if (!hasAnswer(answer)) return { status: 'unanswered', earnedPoints: 0, possiblePoints: points, isCorrect: null };
  if (normalized.ungraded) return { status: 'ungraded', earnedPoints: 0, possiblePoints: 0, isCorrect: null };
  if (normalized.manualReview || normalized.responseType === 'long-text') {
    return { status: 'manual-review', earnedPoints: 0, possiblePoints: points, isCorrect: null };
  }

  const keys = getQuestionAnswerKey(question);
  let ratio = 0;
  switch (normalized.responseType) {
    case 'single-choice':
    case 'short-text':
      ratio = keys.length > 0 && (normalized.responseType === 'short-text'
        ? textMatches(answer, keys)
        : keys.some(value => normalizeText(value) === normalizeText(answer))) ? 1 : 0;
      break;
    case 'numeric':
      ratio = numericMatches(answer, keys, Number(question.numericTolerance || 0)) ? 1 : 0;
      break;
    case 'multiple-select': {
      const selected = Array.isArray(answer) ? answer : [answer];
      const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
      if (correct.length) {
        const correctSet = new Set(correct.map(normalizeText));
        const selectedSet = new Set(selected.map(normalizeText).filter(Boolean));
        const matches = [...selectedSet].filter(value => correctSet.has(value)).length;
        const wrong = [...selectedSet].filter(value => !correctSet.has(value)).length;
        ratio = Math.max(0, (matches - wrong) / correctSet.size);
      }
      break;
    }
    case 'multi-blank':
    case 'matching': {
      const values = slotAnswers(question, answer);
      const slots = normalized.answerSlots || [];
      const answeredSlots = slots.map((slot, index) => ({ slot, value: values[index] }))
        .filter(({ value }) => hasAnswer(value));
      const slotPoints = points / Math.max(1, slots.length);
      const usedMatches = new Set<string>();
      const earned = answeredSlots.reduce((sum, { slot, value }) => {
        const accepted = slot.correctAnswers || [];
        const normalizedValue = normalizeText(value);
        const duplicate = normalized.responseType === 'matching' && !normalized.allowChoiceReuse && usedMatches.has(normalizedValue);
        if (normalized.responseType === 'matching' && normalizedValue) usedMatches.add(normalizedValue);
        const correct = normalized.responseType === 'matching'
          ? !duplicate && accepted.some(candidate => normalizeText(candidate) === normalizedValue)
          : textMatches(value, accepted);
        return sum + (correct ? slotPoints : 0);
      }, 0);
      const possible = slots.length ? points : points;
      return { status: 'graded', earnedPoints: earned, possiblePoints: possible, isCorrect: slots.length > 0 && earned >= points };
    }
    case 'ordering': {
      const expected = normalized.correctOrder || [];
      const actual = Array.isArray(answer) ? answer : [];
      if (expected.length) ratio = actual.reduce((count, item, index) => count + (normalizeText(item) === normalizeText(expected[index]) ? 1 : 0), 0) / expected.length;
      break;
    }
  }
  const earnedPoints = points * ratio;
  return { status: 'graded', earnedPoints, possiblePoints: points, isCorrect: ratio === 1 };
}

export function validateQuestion(question: EngineQuestion): string[] {
  const normalized = normalizeQuestion(question);
  const errors: string[] = [];
  if (!String(question.text || '').trim()) errors.push('Add the question prompt.');
  if (normalized.responseType === 'long-text') return errors;
  const keyOptional = Boolean(normalized.manualReview || normalized.ungraded);

  switch (normalized.responseType) {
    case 'single-choice':
    case 'multiple-select': {
      const options = normalized.options || [];
      if (options.filter(option => option.trim()).length < 2) errors.push('Add at least two non-empty choices.');
      const correct = normalized.responseType === 'multiple-select'
        ? Array.isArray(question.correctAnswer) ? question.correctAnswer : []
        : getQuestionAnswerKey(question);
      if (!correct.length && !keyOptional) errors.push('Set the correct answer or mark this question for manual review.');
      if (correct.some(value => !options.some(option => normalizeText(option) === normalizeText(value)))) errors.push('Every correct choice must exist in the choices list.');
      break;
    }
    case 'short-text':
    case 'numeric':
      if (!getQuestionAnswerKey(question).length && !keyOptional) errors.push('Add a correct answer or mark this question for manual review.');
      break;
    case 'multi-blank':
    case 'matching': {
      const slots = normalized.answerSlots || [];
      if (!slots.length) errors.push('Add at least one answer slot.');
      slots.forEach((slot, index) => {
        if (!(slot.correctAnswers || []).length && !keyOptional) errors.push(`Add the answer key for slot ${index + 1}.`);
      });
      if (normalized.responseType === 'matching') {
        const choices = (normalized.sharedChoices || []).filter(value => value.trim());
        if (choices.length < 2) errors.push('Add at least two shared choices.');
        slots.forEach((slot, index) => {
          if ((slot.correctAnswers || []).some(key => !choices.some(choice => normalizeText(choice) === normalizeText(key)))) errors.push(`The answer key for slot ${index + 1} must match a shared choice.`);
        });
        if (new Set(choices.map(normalizeText)).size !== choices.length) errors.push('Shared matching choices must be unique.');
      }
      break;
    }
    case 'ordering': {
      const options = normalized.options || [];
      const filledOptions = options.filter(option => option.trim());
      if (filledOptions.length < 2) errors.push('Add at least two items to order.');
      if (!keyOptional && (normalized.correctOrder?.length !== filledOptions.length
        || new Set((normalized.correctOrder || []).map(normalizeText)).size !== filledOptions.length
        || filledOptions.some(option => !(normalized.correctOrder || []).some(item => normalizeText(item) === normalizeText(option))))) errors.push('Set the complete correct order, using each item once.');
      break;
    }
  }
  return errors;
}
