import { useState } from 'react';
import { createReviewRows } from './grading';
import { describeResult, formatCorrectAnswer } from './answerDisplay';
import { FormattedQuestionText } from './FormattedQuestionText';
import { explanationFigureQuestion, PromptFigure } from './PromptFigure';

type Props = {
  /** The question merged with its answer key, or null while the key is unavailable. */
  question: any | null;
  answer: unknown;
  timedOut: boolean;
  keyError?: string;
};

// Shown after a NUET Training question is checked or its time runs out.
// The correct answer is visible straight away; the explanation stays closed until asked for.
export function TrainingFeedback({ question, answer, timedOut, keyError }: Props) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  if (!question) {
    return (
      <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100" role="status">
        {keyError || 'Loading the correct answer…'}
      </div>
    );
  }
  const [row] = createReviewRows([question], { [question.id]: answer });
  const result = describeResult(row);
  const tone = result.kind === 'correct'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100'
    : result.kind === 'unanswered' || result.kind === 'pending' || result.kind === 'ungraded'
      ? 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
      : 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100';
  const correctAnswer = formatCorrectAnswer(row);
  const explanation = String(row.explanation || '').trim();
  const explanationFigure = explanationFigureQuestion(question);
  return (
    <div className={`mt-5 rounded-lg border p-4 ${tone}`} role="status" aria-live="polite">
      <p className="font-semibold">{timedOut && result.kind === 'unanswered' ? 'Time is up. ' : ''}{result.symbol} {result.text}</p>
      {correctAnswer && <p className="mt-1 text-sm"><span className="font-semibold">Correct answer:</span> {correctAnswer}</p>}
      {(explanation || explanationFigure) && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExplanationOpen(open => !open)}
            aria-expanded={explanationOpen}
            className="rounded-lg border border-current px-3 py-1.5 text-sm font-semibold"
          >
            {explanationOpen ? 'Hide explanation' : 'Show explanation'}
          </button>
          {explanationOpen && (
            <div className="mt-3 text-sm">
              {explanation && <p className="whitespace-pre-wrap"><FormattedQuestionText text={explanation} /></p>}
              {explanationFigure && <PromptFigure question={explanationFigure} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
