import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  insertions?: Array<{ label: string; token: string }>;
};

const formats = [
  { label: 'Bold', marker: '**', icon: <strong>B</strong> },
  { label: 'Italic', marker: '*', icon: <em>I</em> },
  { label: 'Underline', marker: '++', icon: <u>U</u> },
];

export function QuestionTextEditor({ value, onChange, insertions = [] }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replaceSelection = (replacement: string, selectionOffset = replacement.length) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + selectionOffset;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const applyFormat = (marker: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = `${marker}${selected}${marker}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + marker.length;
      textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  };

  return (
    <div className="question-text-editor mb-3">
      <div className="mb-1 flex items-center gap-1" role="toolbar" aria-label="Question text formatting">
        {formats.map(format => (
          <button
            key={format.label}
            type="button"
            title={format.label}
            aria-label={`Format selected text as ${format.label.toLowerCase()}`}
            onMouseDown={event => event.preventDefault()}
            onClick={() => applyFormat(format.marker)}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {format.icon}
          </button>
        ))}
        {insertions.map(insertion => <button
          key={insertion.token}
          type="button"
          title={`Insert ${insertion.label.toLowerCase()} at the cursor`}
          aria-label={`Insert ${insertion.label.toLowerCase()} at the cursor`}
          onMouseDown={event => event.preventDefault()}
          onClick={() => replaceSelection(insertion.token)}
          className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
        >{insertion.label}</button>)}
        <span className="ml-2 text-xs text-slate-600 dark:text-slate-300">{insertions.length ? 'Add blanks at the cursor or format selected text.' : 'Select text, then choose bold, italic, or underline.'}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Type the question text here..."
        rows={3}
        className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      />
    </div>
  );
}
