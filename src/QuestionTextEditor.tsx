import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const formats = [
  { label: 'Bold', marker: '**', icon: <strong>B</strong> },
  { label: 'Italic', marker: '*', icon: <em>I</em> },
  { label: 'Underline', marker: '++', icon: <u>U</u> },
];

export function QuestionTextEditor({ value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (marker: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const nextValue = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`;
    onChange(nextValue);
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
        <span className="ml-2 text-xs text-slate-600 dark:text-slate-300">Select text, then choose bold, italic, or underline.</span>
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
