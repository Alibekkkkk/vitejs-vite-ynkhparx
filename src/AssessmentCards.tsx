import type { ReactNode } from 'react';
import { Archive, Check, Clock, Copy, Edit3, EyeOff, FileText, Lock, Play, RotateCcw, Trash2, Users } from 'lucide-react';
import { FormattedQuestionText } from './FormattedQuestionText';
import { formatAssessmentTitle } from './assessmentTitle';
import { ALL_GROUPS, getAssessmentGroupCodes } from './groupCodes';

type Tone = 'slate' | 'green' | 'amber' | 'purple' | 'blue' | 'rose';

const TONES: Record<Tone, string> = {
  slate: 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100',
  amber: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100',
  purple: 'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-100',
  blue: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100',
  rose: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-100',
};

// A small "Label: value" pill that wraps instead of clipping or overlapping its neighbours.
function Badge({ label, value, tone = 'slate' }: { label: string; value: string; tone?: Tone }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs leading-none ${TONES[tone]}`}>
      <span className="font-medium opacity-80">{label}:</span>
      <span className="truncate font-semibold">{value}</span>
    </span>
  );
}

const categoryTone = (category: string): Tone => category === 'Exam' ? 'purple' : category === 'Homework' ? 'amber' : 'blue';

function GroupChips({ groups, emptyText }: { groups: string[]; emptyText: string }) {
  if (!groups.length) return <p className="text-xs italic text-slate-500 dark:text-slate-400">{emptyText}</p>;
  const shown = groups.slice(0, 4);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Assigned groups">
      {shown.map(group => (
        <li key={group} className="max-w-full truncate rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-100" title={group === ALL_GROUPS ? 'All students' : group}>
          {group === ALL_GROUPS ? 'All students' : group}
        </li>
      ))}
      {groups.length > shown.length && (
        <li className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100" title={groups.slice(shown.length).join(', ')}>
          +{groups.length - shown.length} more
        </li>
      )}
    </ul>
  );
}

function IconAction({ label, onClick, tone = 'default', children }: { label: string; onClick: () => void; tone?: 'default' | 'danger' | 'warning'; children: ReactNode }) {
  const color = tone === 'danger' ? 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300'
    : tone === 'warning' ? 'hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-300'
      : 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white';
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 ${color}`}>
      {children}
    </button>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{icon}</span>
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <strong className="font-semibold text-slate-800 dark:text-slate-100">{value}</strong>
    </span>
  );
}

const durationLabel = (seconds: unknown) => {
  const minutes = Math.round(Number(seconds || 0) / 60);
  return minutes ? `${minutes} min` : 'No limit';
};

export type AssessmentCardActions = {
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnpublish: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

type TeacherCardProps = {
  test: any;
  archived: boolean;
  migrationFailed: boolean;
  actions: AssessmentCardActions;
};

export function TeacherAssessmentCard({ test, archived, migrationFailed, actions }: TeacherCardProps) {
  const title = formatAssessmentTitle(test.title);
  const groups = getAssessmentGroupCodes(test);
  const isPublished = !archived && test.published === true && test.status !== 'draft' && groups.length > 0;
  const status = archived ? 'Archived' : isPublished ? 'Published' : 'Draft';
  const statusTone: Tone = archived ? 'rose' : isPublished ? 'green' : 'amber';
  const security = !isPublished ? null
    : migrationFailed ? { text: 'Migration failed', tone: 'amber' as Tone }
      : test.answerKeysSecured && test.teacherKeyComplete ? { text: 'Secure', tone: 'green' as Tone }
        : test.answerKeysSecured ? { text: 'Missing teacher key', tone: 'amber' as Tone } : { text: 'Needs security migration', tone: 'amber' as Tone };

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800" aria-label={title}>
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 break-words text-lg font-bold leading-snug text-slate-900 dark:text-white line-clamp-3" title={title}>{title}</h3>
        <div className="-mr-1 flex shrink-0 items-center">
          {archived ? (
            <>
              <IconAction label={`Restore ${title} to drafts`} onClick={actions.onRestore}><RotateCcw className="h-4 w-4" /></IconAction>
              <IconAction label={`Permanently delete ${title}`} onClick={actions.onDelete} tone="danger"><Trash2 className="h-4 w-4" /></IconAction>
            </>
          ) : (
            <>
              {isPublished && <IconAction label={`Unpublish ${title} and hide it from students`} onClick={actions.onUnpublish} tone="warning"><EyeOff className="h-4 w-4" /></IconAction>}
              <IconAction label={`Duplicate ${title}`} onClick={actions.onDuplicate}><Copy className="h-4 w-4" /></IconAction>
              <IconAction label={`Edit ${title}`} onClick={actions.onEdit}><Edit3 className="h-4 w-4" /></IconAction>
              <IconAction label={`Archive ${title}`} onClick={actions.onArchive} tone="warning"><Archive className="h-4 w-4" /></IconAction>
            </>
          )}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge label="Type" value={test.type || 'General'} tone="blue" />
        <Badge label="Category" value={test.category || 'Practice'} tone={categoryTone(test.category)} />
        <Badge label="Status" value={status} tone={statusTone} />
        {security && <Badge label="Answer key" value={security.text} tone={security.tone} />}
        {test.pin && <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"><Lock className="h-3 w-3" aria-hidden="true" />PIN protected</span>}
      </div>

      {test.description && <div className="mt-3 text-sm text-slate-600 line-clamp-2 dark:text-slate-300"><FormattedQuestionText text={test.description} /></div>}

      <section className="mt-3" aria-label="Student groups">
        <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" />Groups</h4>
        <GroupChips groups={groups} emptyText="Not assigned, hidden from students" />
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-700">
        <Meta icon={<Clock className="h-4 w-4" />} label="Duration" value={durationLabel(test.durationSeconds)} />
        <Meta icon={<FileText className="h-4 w-4" />} label="Questions" value={String(test.questions?.length || 0)} />
      </footer>
    </article>
  );
}

type StudentCardProps = {
  test: any;
  completed: boolean;
  onStart: () => void;
};

export function StudentAssessmentCard({ test, completed, onStart }: StudentCardProps) {
  const title = formatAssessmentTitle(test.title);
  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800" aria-label={title}>
      <h3 className="flex min-w-0 items-start gap-2 break-words text-lg font-bold leading-snug text-slate-900 dark:text-white" title={title}>
        {test.pin && <Lock className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-label="PIN required" />}
        <span className="min-w-0 flex-1 line-clamp-3">{title}</span>
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge label="Type" value={test.type || 'General'} tone="blue" />
        <Badge label="Category" value={test.category || 'Practice'} tone={categoryTone(test.category)} />
      </div>
      {test.description && <div className="mt-3 text-sm text-slate-600 line-clamp-3 dark:text-slate-300"><FormattedQuestionText text={test.description} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Meta icon={<Clock className="h-4 w-4" />} label="Duration" value={durationLabel(test.durationSeconds)} />
        <Meta icon={<FileText className="h-4 w-4" />} label="Questions" value={String(test.questions?.length || 0)} />
      </div>
      <div className="mt-auto pt-5">
        {completed ? (
          <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 py-2.5 font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <Check className="h-5 w-5" aria-hidden="true" />Completed
          </button>
        ) : (
          <button type="button" onClick={onStart} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <Play className="h-5 w-5" aria-hidden="true" />Start Task
          </button>
        )}
      </div>
    </article>
  );
}
