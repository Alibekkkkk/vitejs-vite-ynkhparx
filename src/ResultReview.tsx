import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react';
import { FormattedQuestionText } from './FormattedQuestionText';
import { PromptFigure } from './PromptFigure';
import { describeResult, formatCorrectAnswer, formatDuration, formatStudentAnswer, pointsLabel, type ResultLabel } from './answerDisplay';
import { formatAssessmentTitle } from './assessmentTitle';
import { resolveReviewData, type ReviewRow } from './grading';

type ResultReviewProps = {
  record: any;
  test?: any;
  questions?: any[];
  teacherView?: boolean;
  backLabel?: string;
  onBack: () => void;
};

const CHIP_STYLES: Record<ResultLabel['kind'], string> = {
  correct: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  incorrect: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  partial: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  pending: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  unanswered: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  ungraded: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
};

function ResultChip({ label }: { label: ResultLabel }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP_STYLES[label.kind]}`}>
      <span aria-hidden="true">{label.symbol}</span>{label.text}
    </span>
  );
}

const submittedLabel = (record: any) => {
  const time = record?.submittedAtMs || record?.submittedAt;
  const date = time ? new Date(time) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '–';
};

export function ResultReview({ record, test, questions, teacherView = false, backLabel = 'Back', onBack }: ResultReviewProps) {
  const sourceQuestions = useMemo(() => questions?.length ? questions : (test?.questions || []), [questions, test]);
  const data = useMemo(() => resolveReviewData(record, teacherView ? sourceQuestions : []), [record, sourceQuestions, teacherView]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const questionsById = useMemo(() => new Map<string, any>(sourceQuestions.map((question: any) => [question.id, question])), [sourceQuestions]);
  const rows = data.questionReviews;
  const title = formatAssessmentTitle(record?.displayTitle || record?.assessmentTitle || test?.title, 'Assessment');

  useEffect(() => {
    if (selectedIndex !== null) headingRef.current?.focus();
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight') setSelectedIndex(index => index === null ? index : Math.min(rows.length - 1, index + 1));
      if (event.key === 'ArrowLeft') setSelectedIndex(index => index === null ? index : Math.max(0, index - 1));
      if (event.key === 'Escape') setSelectedIndex(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, rows.length]);

  const summary = data.summary;
  const header = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-slate-800 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {teacherView && record?.studentName ? `${record.studentName}. ` : ''}Submitted {submittedLabel(record)}
          {record?.isAutoSubmitted ? '. Submitted automatically when time ran out.' : '.'}
        </p>
      </div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}
      </button>
    </header>
  );

  if (!summary) {
    return (
      <section className="mx-auto max-w-3xl space-y-5 text-left">
        {header}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800" role="status">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{record?.isPractice ? 'Practice answers are saved' : 'Your answers are saved'}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {record?.isPractice
              ? 'Self-directed practice does not reveal or use an assigned assessment answer key.'
              : 'The score and answer review will appear here as soon as grading finishes. Open this attempt again from Past Results in a moment.'}
          </p>
        </div>
      </section>
    );
  }

  const scoreCard = (
    <aside className="order-first space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:order-last lg:sticky lg:top-4 lg:self-start" aria-label="Score summary">
      <div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{summary.pendingReviewCount ? 'Score so far' : 'Final score'}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
          {formatPoints(summary.score)}<span className="text-xl font-semibold text-slate-500 dark:text-slate-400"> / {formatPoints(summary.scoredMaximum)}</span>
        </p>
        {data.percentage != null && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Percentage correct" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(data.percentage)}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, data.percentage))}%` }} />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{data.percentage}%</p>
          </div>
        )}
      </div>
      {summary.pendingReviewCount > 0 && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/30 dark:text-blue-100" role="status">
          {summary.pendingReviewCount} {summary.pendingReviewCount === 1 ? 'question is' : 'questions are'} pending review. Writing marks are added after a teacher reviews the response.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <ScoreStat label="Correct" value={summary.correctCount} />
        <ScoreStat label="Incorrect" value={summary.incorrectCount} />
        <ScoreStat label="Unanswered" value={summary.unansweredCount} />
        <ScoreStat label="Pending review" value={summary.pendingReviewCount} />
      </dl>
      <p className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />Time spent: <strong>{formatDuration(record?.durationSeconds)}</strong>
      </p>
      {data.source === 'provisional' && <p className="text-xs text-slate-500 dark:text-slate-400">Scored automatically from the answer key.</p>}
    </aside>
  );

  const selectedRow = selectedIndex === null ? null : rows[selectedIndex];

  return (
    <section className="mx-auto max-w-6xl space-y-5 text-left">
      {header}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {scoreCard}
        <div className="min-w-0">
          {selectedRow && selectedIndex !== null ? (
            <QuestionDetail
              row={selectedRow}
              index={selectedIndex}
              total={rows.length}
              question={questionsById.get(selectedRow.questionId)}
              test={test}
              headingRef={headingRef}
              onPrevious={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
              onNext={() => setSelectedIndex(Math.min(rows.length - 1, selectedIndex + 1))}
              onBackToSummary={() => setSelectedIndex(null)}
            />
          ) : (
            <SummaryTable rows={rows} onOpen={setSelectedIndex} />
          )}
        </div>
      </div>
    </section>
  );
}

const formatPoints = (value: number) => String(Math.round(Number(value || 0) * 100) / 100);

function ScoreStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700/50">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function SummaryTable({ rows, onOpen }: { rows: ReviewRow[]; onOpen: (index: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">Question by question results. Select a row to review the question.</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
          <tr>
            <th scope="col" className="px-3 py-3">Question</th>
            <th scope="col" className="px-3 py-3">Your answer</th>
            <th scope="col" className="px-3 py-3">Correct answer</th>
            <th scope="col" className="px-3 py-3">Result</th>
            <th scope="col" className="px-3 py-3 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row, index) => (
            <tr key={row.questionId} onClick={() => onOpen(index)} className="cursor-pointer align-top hover:bg-blue-50 dark:hover:bg-slate-700/60">
              <th scope="row" className="px-3 py-3 font-semibold">
                <button type="button" onClick={event => { event.stopPropagation(); onOpen(index); }} className="rounded text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300" aria-label={`Review question ${index + 1}`}>
                  {index + 1}
                </button>
              </th>
              <td className="max-w-[14rem] break-words px-3 py-3 text-slate-800 dark:text-slate-100"><span className="line-clamp-3">{formatStudentAnswer(row)}</span></td>
              <td className="max-w-[14rem] break-words px-3 py-3 text-slate-800 dark:text-slate-100"><span className="line-clamp-3">{formatCorrectAnswer(row)}</span></td>
              <td className="px-3 py-3"><ResultChip label={describeResult(row)} /></td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{pointsLabel(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type QuestionDetailProps = {
  row: ReviewRow;
  index: number;
  total: number;
  question?: any;
  test?: any;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPrevious: () => void;
  onNext: () => void;
  onBackToSummary: () => void;
};

function QuestionDetail({ row, index, total, question, test, headingRef, onPrevious, onNext, onBackToSummary }: QuestionDetailProps) {
  const label = describeResult(row);
  const passage = question?.section === 'reading'
    ? test?.sections?.reading?.passages?.find((item: any) => item.passageNumber === (question.passageNumber || 1))
    : null;
  const options: string[] = Array.isArray(question?.options) ? question.options.filter(Boolean) : [];
  const isChoice = (row.responseType === 'single-choice' || row.responseType === 'multiple-select') && options.length > 0;
  const chosen = new Set((Array.isArray(row.studentAnswer) ? row.studentAnswer : [row.studentAnswer]).map(value => String(value ?? '').trim().toLowerCase()));
  const key = row.answerKey as { correctAnswer?: unknown; acceptedAnswers?: unknown[] };
  const correct = new Set([...(Array.isArray(key?.correctAnswer) ? key.correctAnswer : [key?.correctAnswer]), ...(key?.acceptedAnswers || [])]
    .filter(value => value != null && value !== '').map(value => String(value).trim().toLowerCase()));
  const promptText = question?.text ?? row.questionText;

  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800" aria-labelledby="review-question-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="review-question-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-slate-900 outline-none dark:text-white">
          Question {index + 1} of {total}
        </h2>
        <div className="flex items-center gap-2">
          <ResultChip label={label} />
          <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{pointsLabel(row)} points</span>
        </div>
      </div>

      {passage?.content && (
        <details open className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">{passage.title || `Passage ${passage.passageNumber}`}</summary>
          <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100"><FormattedQuestionText text={passage.content} /></div>
        </details>
      )}

      <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-900 dark:bg-slate-700/50 dark:text-slate-100">
        <FormattedQuestionText text={promptText || 'Question text is no longer available.'} />
      </div>
      {question && <PromptFigure question={question} assessmentId={test?.id || 'review'} />}

      {isChoice ? (
        <ul className="space-y-2" aria-label="Answer choices">
          {options.map(option => {
            const normalized = option.trim().toLowerCase();
            const isChosen = chosen.has(normalized);
            const isCorrect = correct.has(normalized);
            return (
              <li key={option} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${isCorrect ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20' : isChosen ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="min-w-0 break-words text-slate-900 dark:text-slate-100"><FormattedQuestionText text={option} /></span>
                <span className="flex gap-2 text-xs font-semibold">
                  {isChosen && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white dark:bg-slate-200 dark:text-slate-900">Your answer</span>}
                  {isCorrect && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-white"><Check className="h-3 w-3" aria-hidden="true" />Correct answer</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnswerBox title="Your answer" text={formatStudentAnswer(row)} />
          <AnswerBox title="Correct answer" text={formatCorrectAnswer(row)} tone="correct" />
        </div>
      )}

      {(row.explanation || question?.explanation) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Explanation</h3>
          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100"><FormattedQuestionText text={row.explanation || question?.explanation} /></div>
        </div>
      )}
      {row.teacherReview?.feedback && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20">
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">Teacher feedback</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{row.teacherReview.feedback}</p>
        </div>
      )}

      <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700" aria-label="Question navigation">
        <button type="button" onClick={onPrevious} disabled={index === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-100">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Previous
        </button>
        <button type="button" onClick={onBackToSummary} className="rounded-lg px-4 py-2 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Back to summary</button>
        <button type="button" onClick={onNext} disabled={index === total - 1} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Next<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </article>
  );
}

function AnswerBox({ title, text, tone }: { title: string; text: string; tone?: 'correct' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'correct' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100">{text || '–'}</p>
    </div>
  );
}
