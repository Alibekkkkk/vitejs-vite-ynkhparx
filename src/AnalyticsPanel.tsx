import { useMemo } from 'react';
import { questionDifficulty, questionDifficultyCsv, summarizeByGroup } from './analytics';

type Props = {
  submissions: any[];
  assessmentId: string;
  assessmentTitle: string;
};

export function AnalyticsPanel({ submissions, assessmentId, assessmentTitle }: Props) {
  const groups = useMemo(() => summarizeByGroup(submissions), [submissions]);
  const difficulty = useMemo(() => assessmentId ? questionDifficulty(submissions, assessmentId) : [], [submissions, assessmentId]);

  if (!submissions.length) return null;

  const exportDifficulty = () => {
    const url = URL.createObjectURL(new Blob([questionDifficultyCsv(difficulty)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'question-difficulty.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-white">Analytics for the filters above</summary>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section aria-label="Group averages">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Average score by group</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400"><tr><th scope="col" className="py-1 pr-3">Group</th><th scope="col" className="py-1 pr-3">Attempts</th><th scope="col" className="py-1">Average</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {groups.map(group => (
                  <tr key={group.group}>
                    <th scope="row" className="py-1.5 pr-3 font-medium text-slate-800 dark:text-slate-100">{group.group}</th>
                    <td className="py-1.5 pr-3 tabular-nums">{group.attempts}</td>
                    <td className="py-1.5 tabular-nums">{group.averagePercent == null ? 'Not scored yet' : `${group.averagePercent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section aria-label="Question difficulty">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Hardest questions</h2>
            {difficulty.length > 0 && <button type="button" onClick={exportDifficulty} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-100">Export CSV</button>}
          </div>
          {!assessmentId ? <p className="text-sm text-slate-500 dark:text-slate-400">Choose one assessment in the filter to see which questions students miss most.</p>
            : difficulty.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No graded answers for {assessmentTitle} yet.</p>
              : (
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500 dark:text-slate-400"><tr><th scope="col" className="py-1 pr-3">Q</th><th scope="col" className="py-1 pr-3">Correct</th><th scope="col" className="py-1 pr-3">Question</th><th scope="col" className="py-1">Common wrong answer</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {difficulty.map(row => (
                        <tr key={row.questionId} className="align-top">
                          <th scope="row" className="py-1.5 pr-3 font-semibold tabular-nums">{row.number}</th>
                          <td className="py-1.5 pr-3 tabular-nums">{row.percentCorrect}% ({row.correct}/{row.attempts})</td>
                          <td className="py-1.5 pr-3 break-words">{row.text}</td>
                          <td className="py-1.5 break-words">{row.commonWrongAnswer || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        </section>
      </div>
    </details>
  );
}
