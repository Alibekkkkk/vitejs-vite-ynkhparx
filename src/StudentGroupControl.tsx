import { useState } from 'react';

type Props = {
  studentUid: string;
  studentName?: string;
  submittedGroup?: string;
  onChange: (studentUid: string, groupCode: string) => Promise<void>;
};

// Lets an approved teacher move a student to another group. Past submissions keep the
// group they were made under, so no result is lost.
export function StudentGroupControl({ studentUid, studentName, submittedGroup, onChange }: Props) {
  const [groupCode, setGroupCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onChange(studentUid, groupCode);
      setFailed(false);
      setMessage(`${studentName || 'The student'} now belongs to "${groupCode.trim().toLowerCase() || 'no group'}". Existing results are unchanged.`);
      setGroupCode('');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not change the group.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="font-semibold text-slate-800 dark:text-slate-100">Student group</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Group when submitted: {submittedGroup || 'none'}. Change the student's current group to show them a different set of assessments.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={groupCode}
          onChange={event => setGroupCode(event.target.value)}
          placeholder="New group code"
          aria-label={`New group code for ${studentName || 'this student'}`}
          className="min-w-[12rem] flex-1 rounded border border-slate-300 bg-white p-2 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <button type="button" onClick={() => void save()} disabled={busy || !groupCode.trim()} className="rounded-lg bg-slate-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Change group'}
        </button>
      </div>
      {message && <p className={`mt-2 text-xs ${failed ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`} role={failed ? 'alert' : 'status'}>{message}</p>}
    </div>
  );
}
