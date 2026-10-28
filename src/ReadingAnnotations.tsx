import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getQuestionTextFormattingRuns, stripQuestionTextFormatting } from './questionTextFormatting';

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
  width?: number;
  height?: number;
};

type Selection = { start: number; end: number; quote: string };
type AnnotationMenu = { x: number; y: number };
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

export function ReadingAnnotations({ text, storageKey, fontScale = 1 }: { text: string; storageKey: string; fontScale?: number }) {
  const plainText = stripQuestionTextFormatting(text);
  const formattingRuns = getQuestionTextFormattingRuns(text);
  const [saved] = useState(() => readSavedAnnotations(storageKey));
  const [marks, setMarks] = useState(saved.marks);
  const [notes, setNotes] = useState(saved.notes);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [visibleNotes, setVisibleNotes] = useState<string[]>([]);
  const [selectedMarkIds, setSelectedMarkIds] = useState<string[]>([]);
  const [selectedMarkAnchor, setSelectedMarkAnchor] = useState<number | null>(null);
  const [annotationMenu, setAnnotationMenu] = useState<AnnotationMenu | null>(null);
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
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const sizes = new Map<string, { width: number; height: number }>();
      entries.forEach(entry => {
        const noteId = (entry.target as HTMLElement).dataset.noteId;
        if (noteId) {
          const bounds = entry.target.getBoundingClientRect();
          sizes.set(noteId, { width: Math.round(bounds.width), height: Math.round(bounds.height) });
        }
      });
      if (sizes.size) setNotes(current => {
        let changed = false;
        const updated = current.map(note => {
          const size = sizes.get(note.id);
          if (!size || (Math.abs((note.width || 340) - size.width) < 2 && Math.abs((note.height || 300) - size.height) < 2)) return note;
          changed = true;
          return {
            ...note,
            width: Math.max(240, Math.min(760, size.width)),
            height: Math.max(220, Math.min(700, size.height)),
          };
        });
        return changed ? updated : current;
      });
    });
    canvas.querySelectorAll<HTMLElement>('.reading-sticky-note').forEach(note => observer.observe(note));
    return () => observer.disconnect();
  }, [visibleNotes.join(',')]);

  useEffect(() => {
    const hideAnnotationsOutside = (event: PointerEvent) => {
      const insideAnnotationMenu = event.target instanceof Element && Boolean(event.target.closest('.reading-annotations__context-menu'));
      if (!insideAnnotationMenu) setAnnotationMenu(null);
      if (!(event.target instanceof Element) || (!event.target.closest('.reading-sticky-note') && !event.target.closest('.reading-annotations__context-menu') && !event.target.closest('.reading-annotations__mark-remove') && !event.target.closest('[data-mark-ids]'))) {
        setVisibleNotes([]);
        setSelectedMarkIds([]);
        setSelectedMarkAnchor(null);
      }
    };
    document.addEventListener('pointerdown', hideAnnotationsOutside);
    return () => document.removeEventListener('pointerdown', hideAnnotationsOutside);
  }, []);

  useEffect(() => {
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAnnotationMenu(null);
    };
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => document.removeEventListener('keydown', closeMenuOnEscape);
  }, []);

  const captureSelection = () => {
    const currentSelection = window.getSelection();
    const range = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null;
    if (!range || !canvasRef.current
      || !canvasRef.current.contains(range.startContainer)
      || !canvasRef.current.contains(range.endContainer)) return null;
    const passageText = canvasRef.current.querySelector('.reading-annotations__text');
    if (!passageText?.contains(range.startContainer) || !passageText.contains(range.endContainer)) return null;
    const quote = currentSelection?.toString() || '';
    const trimmed = quote.trim();
    if (!trimmed) {
      setSelection(null);
      setNoteEditorOpen(false);
      return null;
    }
    const leadingWhitespace = quote.length - quote.trimStart().length;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(passageText);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length + leadingWhitespace;
    const boundedQuote = trimmed.slice(0, 1000);
    const nextSelection = { start, end: start + boundedQuote.length, quote: boundedQuote };
    setSelection(nextSelection);
    return nextSelection;
  };

  useEffect(() => {
    setMarks(current => current.filter(mark => mark.start >= 0 && mark.end <= plainText.length && mark.end > mark.start
      && (mark.kind === 'underline' || HIGHLIGHT_COLORS.some(color => color.value === mark.color))));
    setNotes(current => current.filter(note => note.start >= 0 && note.end <= plainText.length && note.end > note.start
      && plainText.slice(note.start, note.end) === note.quote));
  }, [plainText]);

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
    setAnnotationMenu(null);
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
      y: Math.min(70, Math.max(4, (selection.start / Math.max(1, plainText.length)) * 100)),
    }]);
    setVisibleNotes(current => [...current, id]);
    setNoteDraft('');
    setNoteEditorOpen(false);
    setAnnotationMenu(null);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const validMarks = marks.filter(item => item.start >= 0 && item.end <= plainText.length && item.end > item.start
    && (item.kind === 'underline' || HIGHLIGHT_COLORS.some(color => color.value === item.color)));
  const validNotes = notes.filter(item => item.start >= 0 && item.end <= plainText.length && item.end > item.start
    && plainText.slice(item.start, item.end) === item.quote);
  const sourceAnnotations = [...validMarks, ...validNotes];
  const boundaries = [...new Set([0, plainText.length, ...sourceAnnotations.flatMap(item => [item.start, item.end]), ...formattingRuns.flatMap(run => [run.start, run.end])])].sort((a, b) => a - b);
  const textSegments = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const activeMarks = validMarks.filter(mark => mark.start < end && mark.end > start);
    const activeNotes = validNotes.filter(note => note.start < end && note.end > start);
    const format = formattingRuns.find(run => run.start <= start && run.end >= end);
    return { start, end, value: plainText.slice(start, end), activeMarks, activeNotes, format };
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

  const renderPassageSegment = (segment: typeof textSegments[number], index: number) => {
    const highlight = [...segment.activeMarks].reverse().find(mark => mark.kind === 'highlight');
    const underlined = segment.activeMarks.some(mark => mark.kind === 'underline') || segment.format?.style === 'underline';
    const noteIds = segment.activeNotes.map(note => note.id);
    const markIds = segment.activeMarks.map(mark => mark.id);
    const hasFormatting = Boolean(segment.format && (segment.format.style !== 'plain' || segment.format.fontSize));
    if (!highlight && !underlined && !noteIds.length && !hasFormatting) return <React.Fragment key={`passage-${index}`}>{segment.value}</React.Fragment>;
    const isMarkSelected = markIds.some(id => selectedMarkIds.includes(id));
    const content = <span
      className={[
        underlined ? 'reading-annotations__underline' : '',
        highlight ? 'reading-annotations__highlighted' : '',
        isMarkSelected ? 'reading-annotations__mark-selected' : '',
      ].filter(Boolean).join(' ') || undefined}
      style={{
        ...(highlight ? { backgroundColor: highlight.color } : {}),
        ...(segment.format?.style === 'bold' ? { fontWeight: 700 } : {}),
        ...(segment.format?.style === 'italic' ? { fontStyle: 'italic' } : {}),
        ...(segment.format?.fontSize ? { fontSize: `${segment.format.fontSize * fontScale}px` } : {}),
      }}
      data-note-ids={noteIds.join(',')}
      data-mark-ids={markIds.join(',')}
      tabIndex={noteIds.length || markIds.length ? 0 : undefined}
      role={noteIds.length || markIds.length ? 'button' : undefined}
      aria-label={[
        noteIds.length ? `Open note${noteIds.length > 1 ? 's' : ''} on "${segment.value}"` : '',
        markIds.length ? `Select highlight or underline on "${segment.value}" for removal` : '',
      ].filter(Boolean).join('; ') || undefined}
      title={markIds.length ? 'Select this mark to reveal its delete button' : undefined}
      onClick={() => {
        if (markIds.length) {
          const alreadySelected = selectedMarkIds.length === markIds.length && markIds.every(id => selectedMarkIds.includes(id));
          setSelectedMarkIds(alreadySelected ? [] : markIds);
          setSelectedMarkAnchor(alreadySelected ? null : segment.start);
        }
        if (noteIds.length) setVisibleNotes(current => {
          const allVisible = noteIds.every(id => current.includes(id));
          return allVisible ? current.filter(id => !noteIds.includes(id)) : [...new Set([...current, ...noteIds])];
        });
      }}
      onKeyDown={event => {
        if ((noteIds.length || markIds.length) && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          if (markIds.length) {
            setSelectedMarkIds(markIds);
            setSelectedMarkAnchor(segment.start);
          }
          if (noteIds.length) setVisibleNotes(current => [...new Set([...current, ...noteIds])]);
        }
      }}
    >{segment.value}</span>;
    return <React.Fragment key={`passage-${index}`}>
      {content}
      {isMarkSelected && selectedMarkAnchor === segment.start && <button
        type="button"
        className="reading-annotations__mark-remove"
        onClick={() => {
          setMarks(current => current.filter(mark => !selectedMarkIds.includes(mark.id)));
          setSelectedMarkIds([]);
          setSelectedMarkAnchor(null);
        }}
        aria-label="Remove selected highlight or underline"
        title="Remove selected highlight or underline"
      ><Trash2 size={15} aria-hidden="true" /></button>}
    </React.Fragment>;
  };
  const renderedPassageSegments: React.ReactNode[] = [];
  for (let index = 0; index < textSegments.length;) {
    const segment = textSegments[index];
    if (segment.format?.align) {
      const alignment = segment.format.align;
      const group = [];
      while (index < textSegments.length && textSegments[index].format?.align === alignment) {
        group.push(renderPassageSegment(textSegments[index], index));
        index++;
      }
      renderedPassageSegments.push(<span key={`aligned-${index}`} style={{ display: 'block', textAlign: alignment }}>{group}</span>);
    } else {
      renderedPassageSegments.push(renderPassageSegment(segment, index));
      index++;
    }
  }

  return (
    <section className="reading-annotations" aria-label="Passage annotation tools">
      <p className="reading-annotations__hint">Select passage text, then right-click to highlight, underline, or add a note.</p>

      {annotationMenu && selection && <div
        className="reading-annotations__context-menu"
        role="group"
        aria-label="Actions for selected passage text"
        style={{ left: annotationMenu.x, top: annotationMenu.y }}
      >
        <p>Annotate selected text</p>
        <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => addMark('underline')} aria-label="Underline selected text"><u aria-hidden="true">U</u> Underline</button>
        <div className="reading-annotations__context-colors" role="group" aria-label="Highlight selected text">
          {HIGHLIGHT_COLORS.map(color => <button key={color.name} type="button" onMouseDown={event => event.preventDefault()} onClick={() => addMark('highlight', color.value)} style={{ backgroundColor: color.value }} aria-label={`${color.name} highlight`} title={`${color.name} highlight`} />)}
        </div>
        <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setNoteDraft(''); setNoteEditorOpen(true); setAnnotationMenu(null); }} aria-label="Add sticky note to selected text">＋ Sticky note</button>
      </div>}

      {selection && noteEditorOpen && <div className="reading-note-composer">
        <blockquote>“{selection.quote}”</blockquote>
        <textarea value={noteDraft} maxLength={1000} rows={2} onChange={event => setNoteDraft(event.target.value)} aria-label="Sticky note text" placeholder="Write a note about this part…" />
        <div className="reading-note-composer__actions">
          <button type="button" onClick={() => { setNoteEditorOpen(false); setNoteDraft(''); }}>Cancel</button>
          <button type="button" onClick={addNote} disabled={!noteDraft.trim() || notes.length >= 50}>Add note</button>
        </div>
      </div>}

      <div ref={canvasRef} className="reading-annotations__canvas" onMouseUp={captureSelection} onKeyUp={captureSelection} onContextMenu={event => {
        const nextSelection = captureSelection();
        if (!nextSelection) return;
        event.preventDefault();
        setNoteEditorOpen(false);
        setAnnotationMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 190)),
        });
      }}>
        <p className="reading-annotations__text" style={{ fontSize: `${20 * fontScale}px` }}>
          {renderedPassageSegments}
        </p>

        {validNotes.filter(note => visibleNotes.includes(note.id)).map((note, index) => <article
          key={note.id}
          className="reading-sticky-note"
          data-note-id={note.id}
          style={{ left: `${note.x}%`, top: `${note.y}%`, width: `${note.width || 340}px`, height: `${note.height || 300}px`, zIndex: index + 2 }}
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
