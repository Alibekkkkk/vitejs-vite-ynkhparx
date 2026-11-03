import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { isAnswerPresent } from './questionEngine';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

// Asks the browser to confirm before the tab is closed or reloaded while answers are unsent.
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}

export function useFlaggedQuestions(storageKey: string) {
  const [flagged, setFlagged] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(flagged)); } catch { /* flags are a convenience only */ }
  }, [storageKey, flagged]);
  const toggle = (questionId: string) => setFlagged(previous => previous.includes(questionId) ? previous.filter(id => id !== questionId) : [...previous, questionId]);
  return { flagged, toggle };
}

export function ExamNotices({ online, secondsRemaining }: { online: boolean; secondsRemaining: number | null }) {
  const stage = secondsRemaining == null || secondsRemaining <= 0 ? null : secondsRemaining <= 60 ? 'minute' : secondsRemaining <= 300 ? 'five' : null;
  return (
    <>
      {!online && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100" role="alert">
          You are offline. Your answers are saved in this browser. Reconnect before you submit so your exam can be sent.
        </p>
      )}
      {stage && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100" role="status">
          {stage === 'minute' ? 'Less than 1 minute remains. Your answers will be submitted automatically when time is up.' : 'Less than 5 minutes remain. Check your unanswered and flagged questions.'}
        </p>
      )}
    </>
  );
}

type NavigatorProps = {
  questions: Array<{ id: string }>;
  answers: Record<string, unknown>;
  currentIndex: number;
  flagged: string[];
  disabled?: boolean;
  onGo: (index: number) => void;
  onToggleFlag: (questionId: string) => void;
};

export function QuestionNavigator({ questions, answers, currentIndex, flagged, disabled, onGo, onToggleFlag }: NavigatorProps) {
  if (questions.length < 2) return null;
  const current = questions[currentIndex];
  const isFlagged = Boolean(current && flagged.includes(current.id));
  const answered = questions.filter(question => isAnswerPresent(answers[question.id])).length;
  return (
    <nav className="mt-6 rounded-lg border border-slate-200 p-3 dark:border-slate-700" aria-label="Question navigator">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{answered} of {questions.length} answered{flagged.length ? `, ${flagged.length} flagged` : ''}</p>
        {current && (
          <button
            type="button"
            onClick={() => onToggleFlag(current.id)}
            disabled={disabled}
            aria-pressed={isFlagged}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${isFlagged ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'}`}
          >
            <Flag className="h-4 w-4" aria-hidden="true" />{isFlagged ? 'Flagged for review' : 'Flag for review'}
          </button>
        )}
      </div>
      <ol className="mt-3 flex flex-wrap gap-1.5">
        {questions.map((question, index) => {
          const isAnswered = isAnswerPresent(answers[question.id]);
          const isQuestionFlagged = flagged.includes(question.id);
          const isCurrent = index === currentIndex;
          const state = `${isAnswered ? 'answered' : 'unanswered'}${isQuestionFlagged ? ', flagged' : ''}${isCurrent ? ', current' : ''}`;
          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onGo(index)}
                disabled={disabled}
                aria-label={`Question ${index + 1}, ${state}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative h-9 w-9 rounded-md border text-sm font-semibold tabular-nums disabled:opacity-50 ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-800' : ''} ${isAnswered ? 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
              >
                {index + 1}
                {isQuestionFlagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-500 text-amber-700" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Green: answered. White: not answered yet. Flag questions you want to revisit.</p>
    </nav>
  );
}
