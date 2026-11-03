import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { ALL_GROUPS, normalizeGroupCodes, parseGroupCodeInput } from './groupCodes';

type GroupCodeInputProps = {
  value: string[];
  onChange: (groupCodes: string[]) => void;
  suggestions?: string[];
};

export function GroupCodeInput({ value, onChange, suggestions = [] }: GroupCodeInputProps) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const listId = useId();
  const hasAll = value.includes(ALL_GROUPS);
  const availableSuggestions = suggestions.filter(code => code !== ALL_GROUPS && !value.includes(code));

  const commit = (text: string) => {
    const added = parseGroupCodeInput(text);
    setDraft('');
    if (added.length) onChange(normalizeGroupCodes([...value, ...added]));
  };

  const remove = (code: string) => onChange(value.filter(item => item !== code));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-2 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-600 dark:bg-slate-700">
        {value.map(code => (
          <span key={code} className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
            <span className="truncate">{code === ALL_GROUPS ? 'All students' : code}</span>
            <button
              type="button"
              onClick={() => remove(code)}
              className="rounded-full p-0.5 hover:bg-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-blue-800"
              aria-label={`Remove group ${code === ALL_GROUPS ? 'all students' : code}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          list={listId}
          value={draft}
          disabled={hasAll}
          onChange={event => {
            const next = event.target.value;
            if (/[,;]/.test(next)) commit(next);
            else setDraft(next);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            } else if (event.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={hasAll ? 'Visible to every student' : value.length ? 'Add another group' : 'Type a group code and press Enter'}
          aria-label="Student group codes"
          className="min-w-[10rem] flex-1 bg-transparent p-1 text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-white"
        />
        <datalist id={listId}>
          {availableSuggestions.map(code => <option key={code} value={code} />)}
        </datalist>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => onChange(hasAll ? [] : [ALL_GROUPS])}
          aria-pressed={hasAll}
          className={`rounded-full border px-3 py-1 font-semibold ${hasAll ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'}`}
        >
          {hasAll ? 'Visible to all students' : 'Assign to all students'}
        </button>
        <span>Press Enter or comma to add a group. Leave empty to save as a draft hidden from students.</span>
      </div>
    </div>
  );
}
