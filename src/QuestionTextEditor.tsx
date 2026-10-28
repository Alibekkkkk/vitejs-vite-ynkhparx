import { useRef } from 'react';
import { FormattedQuestionText } from './FormattedQuestionText';

type Props = {
  value: string;
  onChange: (value: string) => void;
  insertions?: Array<{ label: string; token: string }>;
  rows?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

const formats = [
  { label: 'Bold', marker: '**', icon: <strong>B</strong> },
  { label: 'Italic', marker: '*', icon: <em>I</em> },
  { label: 'Underline', marker: '++', icon: <u>U</u> },
];

const fontSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];

export function QuestionTextEditor({ value, onChange, insertions = [], rows = 3, placeholder = 'Type the question text here...', className = '', ariaLabel = 'Formatted text' }: Props) {
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

  const applyFormat = (open: string, close = open) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = `${open}${selected}${close}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + open.length;
      textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  };

  return (
    <div className="question-text-editor mb-3">
      <div className="mb-1 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Text formatting">
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
        {(['left', 'center', 'right'] as const).map(alignment => (
          <button
            key={alignment}
            type="button"
            title={`Align selected text ${alignment}`}
            aria-label={`Align selected text ${alignment}`}
            onMouseDown={event => event.preventDefault()}
            onClick={() => applyFormat(`[[align:${alignment}]]`, '[[/align]]')}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >{alignment}</button>
        ))}
        <label className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          Size
          <select
            aria-label="Font size for selected text"
            defaultValue=""
            onChange={event => {
              const size = Number(event.target.value);
              if (fontSizes.includes(size)) applyFormat(`[[size:${size}]]`, '[[/size]]');
              event.target.value = '';
            }}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="" disabled>Choose</option>
            {fontSizes.map(size => <option key={size} value={size}>{size}px</option>)}
          </select>
        </label>
        {insertions.map(insertion => <button
          key={insertion.token}
          type="button"
          title={`Insert ${insertion.label.toLowerCase()} at the cursor`}
          aria-label={`Insert ${insertion.label.toLowerCase()} at the cursor`}
          onMouseDown={event => event.preventDefault()}
          onClick={() => replaceSelection(insertion.token)}
          className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
        >{insertion.label}</button>)}
        <span className="ml-2 text-xs text-slate-600 dark:text-slate-300">Select text, then choose a style, alignment, or font size{insertions.length ? '; blanks can be inserted at the cursor.' : '.'}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel}
        className={`w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white ${className}`}
      />
      {value.trim() && <div className="question-text-editor__preview" aria-label={`${ariaLabel} live preview`}>
        <span className="question-text-editor__preview-label">Live preview</span>
        <div className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">
          <FormattedQuestionText text={value} />
        </div>
      </div>}
    </div>
  );
}
