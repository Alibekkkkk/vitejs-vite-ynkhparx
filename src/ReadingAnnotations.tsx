import React, { useEffect, useRef, useState } from 'react';

type ReadingMark = {
  id: string;
  start: number;
  end: number;
  kind: 'highlight' | 'underline';
  color?: string;
};

type ReadingNote = {
  id: string;
  start: number;
  end: number;
  quote: string;
  body: string;
  x: number;
  y: number;
};

type Selection = { start: number; end: number; quote: string };
type SavedAnnotations = { marks: ReadingMark[]; notes: ReadingNote[] };

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fff3a3' },
  { name: 'Orange', value: '#ffd1a1' },
  { name: 'Coral', value: '#ffb4ab' },
  { name: 'Pink', value: '#ffc8dd' },
  { name: 'Purple', value: '#e4c1f9' },
  { name: 'Blue', value: '#bde0fe' },
  { name: 'Cyan', value: '#b8f2e6' },
  { name: 'Green', value: '#caffbf' },
  { name: 'Lime', value: '#e9ff70' },
  { name: 'Gray', value: '#d9e2ec' },
];

const readSavedAnnotations = (storageKey: string): SavedAnnotations => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const marks = Array.isArray(saved.marks) ? saved.marks : [];
    const notes = Array.isArray(saved.notes) ? saved.notes : [];
    return {
      marks: marks.filter((mark: ReadingMark) => mark && typeof mark.id === 'string'
        && Number.isInteger(mark.start) && Number.isInteger(mark.end)
        && ['highlight', 'underline'].includes(mark.kind)).slice(0, 200),
      notes: notes.filter((note: ReadingNote) => note && typeof note.id === 'string'
        && typeof note.quote === 'string' && typeof note.body === 'string'
        && Number.isInteger(note.start) && Number.isInteger(note.end)).slice(0, 50),
    };
  } catch (error) {
    console.warn('Could not restore reading annotations:', error);
    return { marks: [], notes: [] };
  }
};

export function ReadingAnnotations({ text, storageKey }: { text: string; storageKey: string }) {
  const [saved] = useState(() => readSavedAnnotations(storageKey));
  const [marks, setMarks] = useState(saved.marks);
  const [notes, setNotes] = useState(saved.notes);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [visibleNotes, setVisibleNotes] = useState<string[]>([]);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ marks, notes }));
    } catch (error) {
      console.warn('Could not save reading annotations:', error);
    }
  }, [storageKey, marks, notes]);

  useEffect(() => {
    const hideNotesOutsideSticker = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.reading-sticky-note')) {
        setVisibleNotes([]);
      }
    };
    document.addEventListener('pointerdown', hideNotesOutsideSticker);
    return () => document.removeEventListener('pointerdown', hideNotesOutsideSticker);
  }, []);

  const captureSelection = () => {
    const currentSelection = window.getSelection();
    const range = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null;
    if (!range || !canvasRef.current
      || !canvasRef.current.contains(range.startContainer)
      || !canvasRef.current.contains(range.endContainer)) return;
    const passageText = canvasRef.current.querySelector('.reading-annotations__text');
    if (!passageText?.contains(range.startContainer) || !passageText.contains(range.endContainer)) return;
    const quote = currentSelection?.toString() || '';
    const trimmed = quote.trim();
    if (!trimmed) {
      setSelection(null);
      setNoteEditorOpen(false);
      return;
    }
    const leadingWhitespace = quote.length - quote.trimStart().length;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(passageText);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length + leadingWhitespace;
    const boundedQuote = trimmed.slice(0, 1000);
    setSelection({ start, end: start + boundedQuote.length, quote: boundedQuote });
  };

  useEffect(() => {
    setMarks(current => current.filter(mark => mark.start >= 0 && mark.end <= text.length && mark.end > mark.start
      && (mark.kind === 'underline' || HIGHLIGHT_COLORS.some(color => color.value === mark.color))));
    setNotes(current => current.filter(note => note.start >= 0 && note.end <= text.length && note.end > note.start
      && text.slice(note.start, note.end) === note.quote));
  }, [text]);

  const addMark = (kind: ReadingMark['kind'], color?: string) => {
    if (!selection || marks.length >= 200) return;
    setMarks(current => [...current, {
      id: crypto.randomUUID(),
      start: selection.start,
      end: selection.end,
      kind,
      ...(color ? { color } : {}),
    }]);
    setSelection(null);
    setHighlightMenuOpen(false);
    window.getSelection()?.removeAllRanges();
  };

  const addNote = () => {
    const body = noteDraft.trim();
    if (!selection || !body || notes.length >= 50) return;
    const id = crypto.randomUUID();
    setNotes(current => [...current, {
      id,
      start: selection.start,
      end: selection.end,
      quote: selection.quote,
      body: body.slice(0, 1000),
      x: 4,
      y: Math.min(70, Math.max(4, (selection.start / Math.max(1, text.length)) * 100)),
    }]);
    setVisibleNotes(current => [...current, id]);
    setNoteDraft('');
    setNoteEditorOpen(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const validMarks = marks.filter(item => item.start >= 0 && item.end <= text.length && item.end > item.start
    && (item.kind === 'underline' || HIGHLIGHT_COLORS.some(color => color.value === item.color)));
  const validNotes = notes.filter(item => item.start >= 0 && item.end <= text.length && item.end > item.start
    && text.slice(item.start, item.end) === item.quote);
  const sourceAnnotations = [...validMarks, ...validNotes];
  const boundaries = [...new Set([0, text.length, ...sourceAnnotations.flatMap(item => [item.start, item.end])])].sort((a, b) => a - b);
  const textSegments = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const activeMarks = validMarks.filter(mark => mark.start < end && mark.end > start);
    const activeNotes = validNotes.filter(note => note.start < end && note.end > start);
    return { start, end, value: text.slice(start, end), activeMarks, activeNotes };
  }).filter(segment => segment.value);

  const updateNotePosition = (id: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const noteBounds = event.currentTarget.closest('.reading-sticky-note')?.getBoundingClientRect();
    const maxX = noteBounds ? Math.max(0, 100 - (noteBounds.width / bounds.width) * 100) : 76;
    const maxY = noteBounds ? Math.max(0, 100 - (noteBounds.height / bounds.height) * 100) : 88;
    const x = Math.max(0, Math.min(maxX, ((event.clientX - bounds.left - dragOffset.current.x) / bounds.width) * 100));
    const y = Math.max(0, Math.min(maxY, ((event.clientY - bounds.top - dragOffset.current.y) / bounds.height) * 100));
    setNotes(current => current.map(note => note.id === id ? { ...note, x, y } : note));
  };

  return (
    <section className="reading-annotations" aria-label="Passage annotation tools">
      <div className="reading-annotations__toolbar">
        <p className="reading-annotations__hint">Select passage text to highlight, underline, or add a note.</p>
        <div className="reading-annotations__actions">
          <button type="button" className="reading-annotations__tool" disabled={!selection} onClick={() => addMark('underline')} aria-label="Underline selected text"><u aria-hidden="true">U</u> <span>Underline</span></button>
          <div className="reading-highlight-menu">
            <button type="button" className="reading-annotations__tool" disabled={!selection} aria-expanded={highlightMenuOpen} onClick={() => setHighlightMenuOpen(open => !open)}>
              <span className="reading-highlight-menu__swatch" aria-hidden="true" /> Highlight <span aria-hidden="true">▾</span>
            </button>
            {highlightMenuOpen && <div className="reading-highlight-menu__popover" role="group" aria-label="Choose highlight color">
              {HIGHLIGHT_COLORS.map(color => <button key={color.name} type="button" title={`${color.name} highlight`} aria-label={`${color.name} highlight`} onClick={() => addMark('highlight', color.value)} style={{ backgroundColor: color.value }} />)}
            </div>}
          </div>
          <button type="button" className="reading-annotations__tool" disabled={!selection} onClick={() => setNoteEditorOpen(open => !open)}>＋ <span>Sticky note</span></button>
        </div>
      </div>

      {selection && noteEditorOpen && <div className="reading-note-composer">
        <blockquote>“{selection.quote}”</blockquote>
        <textarea value={noteDraft} maxLength={1000} rows={2} onChange={event => setNoteDraft(event.target.value)} aria-label="Sticky note text" placeholder="Write a note about this part…" />
        <div className="reading-note-composer__actions">
          <button type="button" onClick={() => { setNoteEditorOpen(false); setNoteDraft(''); }}>Cancel</button>
          <button type="button" onClick={addNote} disabled={!noteDraft.trim() || notes.length >= 50}>Add note</button>
        </div>
      </div>}

      <div ref={canvasRef} className="reading-annotations__canvas" onMouseUp={captureSelection} onKeyUp={captureSelection}>
        <p className="reading-annotations__text">
          {textSegments.map((segment, index) => {
            const highlight = [...segment.activeMarks].reverse().find(mark => mark.kind === 'highlight');
            const underlined = segment.activeMarks.some(mark => mark.kind === 'underline');
            const noteIds = segment.activeNotes.map(note => note.id);
            if (!highlight && !underlined && !noteIds.length) return <React.Fragment key={`passage-${index}`}>{segment.value}</React.Fragment>;
            return <span
              key={`passage-${index}`}
              className={underlined ? 'reading-annotations__underline' : undefined}
              style={highlight ? { backgroundColor: highlight.color } : undefined}
              data-note-ids={noteIds.join(',')}
              tabIndex={noteIds.length ? 0 : undefined}
              role={noteIds.length ? 'button' : undefined}
              aria-label={noteIds.length ? `Open note${noteIds.length > 1 ? 's' : ''} on "${segment.value}"` : undefined}
              onClick={() => noteIds.length && setVisibleNotes(current => {
                const allVisible = noteIds.every(id => current.includes(id));
                return allVisible ? current.filter(id => !noteIds.includes(id)) : [...new Set([...current, ...noteIds])];
              })}
              onKeyDown={event => {
                if (noteIds.length && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  setVisibleNotes(current => [...new Set([...current, ...noteIds])]);
                }
              }}
            >{segment.value}</span>;
          })}
        </p>

        {validNotes.filter(note => visibleNotes.includes(note.id)).map((note, index) => <article
          key={note.id}
          className="reading-sticky-note"
          style={{ left: `${note.x}%`, top: `${note.y}%`, zIndex: index + 2 }}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <button type="button" className="reading-sticky-note__handle" onPointerDown={event => {
            event.preventDefault();
            event.stopPropagation();
            const noteBounds = event.currentTarget.closest('.reading-sticky-note')?.getBoundingClientRect();
            if (noteBounds) dragOffset.current = { x: event.clientX - noteBounds.left, y: event.clientY - noteBounds.top };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={event => {
            if (event.buttons === 1) updateNotePosition(note.id, event);
          }} aria-label="Drag sticky note" title="Drag to move">
            <span aria-hidden="true">⠿</span><span>Note {index + 1}</span>
          </button>
          <blockquote>{note.quote}</blockquote>
          <textarea aria-label={`Note on ${note.quote}`} maxLength={1000} value={note.body} onChange={event => setNotes(current => current.map(item => item.id === note.id ? { ...item, body: event.target.value } : item))} />
          <div className="reading-sticky-note__actions">
            <button type="button" onClick={() => setVisibleNotes(current => current.filter(id => id !== note.id))}>Hide</button>
            <button type="button" className="is-delete" onClick={() => { setNotes(current => current.filter(item => item.id !== note.id)); setVisibleNotes(current => current.filter(id => id !== note.id)); }}>Delete</button>
          </div>
        </article>)}
      </div>
      <div className="reading-annotations__counts" aria-live="polite">
        {validMarks.length} marks · {notes.length} notes
        {selection && <span> · {selection.quote.length} characters selected</span>}
      </div>
    </section>
  );
}
