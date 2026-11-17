import { useState } from 'react';
import { createReviewRows } from './grading';
import { describeResult, formatCorrectAnswer, formatStudentAnswer } from './answerDisplay';
import { normalizeText } from './questionEngine';
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


// Read-only look at an earlier NUET/SAT Training question: nothing can be selected or changed.
export function TrainingReviewPanel({ question, answer, number, total, assessmentId, keyError }: { question: any; answer: unknown; number: number; total: number; assessmentId: string; keyError?: string }) {
  const options: string[] = Array.isArray(question?.options) ? question.options.filter(Boolean) : [];
  const hasKey = question?.correctAnswer != null || (Array.isArray(question?.answerSlots) && question.answerSlots.some((slot: any) => slot?.correctAnswers));
  const row = hasKey ? createReviewRows([question], { [question.id]: answer })[0] : null;
  const chosen = (Array.isArray(answer) ? answer : [answer]).filter(value => value != null && value !== '').map(value => normalizeText(value));
  const correctList = (Array.isArray(question?.correctAnswer) ? question.correctAnswer : [question?.correctAnswer]).filter((value: unknown) => value != null && value !== '').map((value: unknown) => normalizeText(value));
  const isChoice = ['single-choice', 'multiple-select'].includes(String(question?.responseType)) && options.length > 0;
  return (
    <section className="space-y-4" aria-label={`Review of question ${number}`}>
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100" role="status">
        Looking back at question {number} of {total}. This is a read-only review: you cannot change the answer. The timer for your current question keeps running.
      </p>
      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
        <p className="whitespace-pre-wrap text-base font-medium text-slate-800 dark:text-slate-100"><FormattedQuestionText text={question?.text || 'Question prompt'} /></p>
        <PromptFigure question={question} assessmentId={assessmentId} />
      </div>
      {isChoice ? (
        <ul className="space-y-2" aria-label="Answer options (read only)">
          {options.map((option, index) => {
            const norm = normalizeText(option);
            const isCorrect = correctList.includes(norm);
            const isChosen = chosen.includes(norm);
            const tone = isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-100'
              : isChosen ? 'border-red-400 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/30 dark:text-red-100'
                : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
            return (
              <li key={`${index}-${option}`} className={`flex items-start gap-3 rounded-lg border p-3 ${tone}`}>
                <span className="mt-0.5 font-semibold">{String.fromCharCode(65 + index)}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap"><FormattedQuestionText text={option} /></span>
                {isCorrect && <span className="text-sm font-semibold">Correct answer</span>}
                {isChosen && !isCorrect && <span className="text-sm font-semibold">Your answer</span>}
                {isChosen && isCorrect && <span className="text-sm font-semibold">(your answer)</span>}
              </li>
            );
          })}
        </ul>
      ) : row ? (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800"><span className="font-semibold">Your answer:</span> {formatStudentAnswer(row)}</p>
      ) : null}
      <TrainingFeedback key={question?.id} question={hasKey ? question : null} answer={answer} timedOut={false} keyError={keyError} />
    </section>
  );
}
