import { stripQuestionTextFormatting } from './questionTextFormatting.ts';
import type { ReviewRow } from './grading.ts';

const plain = (value: unknown) => stripQuestionTextFormatting(String(value ?? '')).trim();

type SlotLike = { id?: string; label?: string; prompt?: string; correctAnswers?: unknown[] };

const slotsOf = (row: Pick<ReviewRow, 'answerKey'>): SlotLike[] => {
  const slots = (row.answerKey as { answerSlots?: SlotLike[] } | undefined)?.answerSlots;
  return Array.isArray(slots) ? slots : [];
};

const slotName = (slot: SlotLike, index: number) => plain(slot.label || slot.prompt) || `Part ${index + 1}`;

// Text shown in the "Your answer" column.
export function formatStudentAnswer(row: Pick<ReviewRow, 'studentAnswer' | 'responseType' | 'answerKey'>): string {
  const answer = row.studentAnswer;
  if (answer == null || answer === '') return 'No answer';
  if (Array.isArray(answer)) {
    const items = answer.map(plain).filter(Boolean);
    if (!items.length) return 'No answer';
    return row.responseType === 'ordering' ? items.map((item, index) => `${index + 1}. ${item}`).join('  ') : items.join(', ');
  }
  if (typeof answer === 'object') {
    const values = answer as Record<string, unknown>;
    const slots = slotsOf(row);
    const entries = slots.length
      ? slots.map((slot, index) => [slotName(slot, index), values[slot.id || '']] as const)
      : Object.entries(values);
    const lines = entries.filter(([, value]) => plain(value)).map(([name, value]) => `${name}: ${plain(value)}`);
    return lines.length ? lines.join('; ') : 'No answer';
  }
  return plain(answer) || 'No answer';
}

// Text shown in the "Correct answer" column. Manual questions have no automatic key.
export function formatCorrectAnswer(row: Pick<ReviewRow, 'responseType' | 'answerKey' | 'status'>): string {
  if (row.status === 'manual-review' || row.responseType === 'long-text') return 'Teacher review';
  if (row.status === 'ungraded') return 'Not scored';
  const key = row.answerKey as { correctAnswer?: unknown; acceptedAnswers?: unknown[]; correctOrder?: unknown[] } | undefined;
  if (!key) return '';
  if (row.responseType === 'multi-blank' || row.responseType === 'matching') {
    const lines = slotsOf(row).map((slot, index) => `${slotName(slot, index)}: ${(slot.correctAnswers || []).map(plain).filter(Boolean).join(' / ')}`);
    return lines.join('; ');
  }
  if (row.responseType === 'ordering') return (key.correctOrder || []).map((item, index) => `${index + 1}. ${plain(item)}`).join('  ');
  if (row.responseType === 'multiple-select') return (Array.isArray(key.correctAnswer) ? key.correctAnswer : []).map(plain).filter(Boolean).join(', ');
  const main = plain(Array.isArray(key.correctAnswer) ? key.correctAnswer.join(', ') : key.correctAnswer);
  const alternatives = (key.acceptedAnswers || []).map(plain).filter(item => item && item !== main);
  return alternatives.length ? `${main} (also accepted: ${alternatives.join(', ')})` : main;
}

export type ResultLabel = { kind: 'correct' | 'incorrect' | 'partial' | 'pending' | 'unanswered' | 'ungraded'; symbol: string; text: string };

export function describeResult(row: Pick<ReviewRow, 'status' | 'isCorrect' | 'earnedPoints' | 'points' | 'teacherReview'>): ResultLabel {
  if (row.status === 'unanswered') return { kind: 'unanswered', symbol: '–', text: 'Unanswered' };
  if (row.status === 'ungraded') return { kind: 'ungraded', symbol: '–', text: 'Not scored' };
  if (row.status === 'manual-review') {
    if (!row.teacherReview?.reviewedAt) return { kind: 'pending', symbol: '…', text: 'Pending review' };
    const awarded = Number(row.teacherReview.points || 0);
    return awarded >= row.points
      ? { kind: 'correct', symbol: '✓', text: 'Reviewed' }
      : { kind: awarded > 0 ? 'partial' : 'incorrect', symbol: awarded > 0 ? '◐' : '✗', text: 'Reviewed' };
  }
  if (row.isCorrect) return { kind: 'correct', symbol: '✓', text: 'Correct' };
  if (Number(row.earnedPoints || 0) > 0) return { kind: 'partial', symbol: '◐', text: 'Partly correct' };
  return { kind: 'incorrect', symbol: '✗', text: 'Incorrect' };
}

export function pointsLabel(row: Pick<ReviewRow, 'status' | 'earnedPoints' | 'points' | 'teacherReview'>): string {
  const format = (value: number) => String(Math.round(value * 100) / 100);
  if (row.status === 'ungraded') return '–';
  if (row.status === 'manual-review') {
    return row.teacherReview?.reviewedAt ? `${format(Number(row.teacherReview.points || 0))} / ${format(row.points)}` : `? / ${format(row.points)}`;
  }
  return `${format(row.status === 'graded' ? Number(row.earnedPoints || 0) : 0)} / ${format(row.points)}`;
}

export function formatDuration(totalSeconds: unknown): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (!seconds) return '–';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m ${String(rest).padStart(2, '0')}s`;
}
