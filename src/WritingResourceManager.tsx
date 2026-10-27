import { useEffect, useState } from 'react';
import { createEmptyWritingResource, parseWritingResource, validateWritingResource, type WritingResource } from './writingResources';
import { WritingResourceTable } from './WritingResourceTable';

type Props = {
  resources: WritingResource[];
  resourceError?: string;
  tests: any[];
  teacherUid: string;
  onSave: (resource: WritingResource) => Promise<void>;
  onDelete: (resourceId: string) => Promise<void>;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function WritingResourceManager({ resources, resourceError, tests, teacherUid, onSave, onDelete }: Props) {
  const [resource, setResource] = useState<WritingResource | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [selectedFigure, setSelectedFigure] = useState('');
  const [pendingAction, setPendingAction] = useState<null | 'publish' | 'unpublish' | 'delete'>(null);
  const [discardDialog, setDiscardDialog] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const isDirty = Boolean(resource) && (savedSnapshot !== JSON.stringify(resource) || jsonText !== JSON.stringify(resource, null, 2));

  useEffect(() => {
    if (resource) setJsonText(JSON.stringify(resource, null, 2));
  }, [resource]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const updateResource = (update: (current: WritingResource) => WritingResource) => {
    setResource(current => current ? update(current) : current);
  };

  const save = async (nextStatus: 'draft' | 'published') => {
    if (!resource) return;
    const updated = { ...resource, status: nextStatus, updatedAt: new Date().toISOString() };
    const errors = validateWritingResource(updated);
    if (nextStatus === 'published' && errors.length) {
      setStatus(errors.join(' '));
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await onSave(updated);
      setResource(updated);
      setSavedSnapshot(JSON.stringify(updated));
      setStatus(nextStatus === 'published'
        ? 'Resource published and available to matching Writing Practice tasks.'
        : 'Draft saved. Students cannot see it until you publish it.');
    } catch (error) {
      console.error('Could not save writing resource:', error);
      setStatus(error instanceof Error ? error.message : 'Could not save this resource.');
    } finally {
      setBusy(false);
    }
  };

  const importJson = () => {
    try {
      setResource(parseWritingResource(JSON.parse(jsonText)));
      setSavedSnapshot('');
      setStatus('Resource JSON applied for review. Preview it, save it, then publish it for students.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invalid resource JSON.');
    }
  };

  const confirmPendingAction = async () => {
    if (!resource || !pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'delete') {
      setBusy(true);
      try {
        await onDelete(resource.id);
        setResource(null);
        setSavedSnapshot('');
        setStatus('Resource deleted.');
      } catch (error) {
        console.error('Could not delete writing resource:', error);
        setStatus(error instanceof Error ? error.message : 'Could not delete this resource.');
      } finally {
        setBusy(false);
      }
      return;
    }
    await save(action === 'publish' ? 'published' : 'draft');
  };

  const requestBack = () => {
    if (isDirty) setDiscardDialog(true);
    else setResource(null);
  };

  const discardChanges = () => {
    setDiscardDialog(false);
    setResource(null);
    setJsonText('');
    setSavedSnapshot('');
  };

  const exportJson = () => {
    if (!resource) return;
    const blob = new Blob([JSON.stringify(resource, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const linkableQuestions = tests.flatMap(test => (test.questions || []).map((question: any) => ({ id: `${test.id}:${question.id}`, test, question })));

  if (!resource) {
    return (
      <section className="writing-resource-manager space-y-4 text-left text-slate-900 dark:text-slate-100">
        {pendingAction && <div role="dialog" aria-modal="true" aria-labelledby="resource-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-lg rounded-xl bg-white p-6 text-slate-900 dark:bg-slate-800 dark:text-white">
            <h2 id="resource-confirm-title" className="text-xl font-bold">Confirm resource action</h2>
            <p className="mt-3">Are you sure you want to continue with this resource action?</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPendingAction(null)}>Cancel</button><button type="button" onClick={() => void confirmPendingAction()} className="rounded bg-red-700 px-3 py-2 text-white">Confirm</button></div>
          </div>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Writing resources</h1><p className="text-slate-600 dark:text-slate-300">Create teacher-authored vocabulary tables for IELTS Writing.</p></div>
          <button type="button" className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white" onClick={() => { setResource(createEmptyWritingResource(teacherUid)); setSavedSnapshot(''); }}>Create resource</button>
        </div>
        {resourceError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">Could not load writing resources: {resourceError}</p>}
        <label className="block font-semibold">Import canonical resource JSON
          <textarea value={jsonText} onChange={event => setJsonText(event.target.value)} rows={6} placeholder="Paste a schemaVersion 1 writing resource JSON document" />
        </label>
        <button type="button" onClick={importJson} className="rounded-lg border px-4 py-2">Review imported JSON</button>
        {status && <p role="status">{status}</p>}
        {!resources.length && <p className="rounded-xl border border-dashed p-6">No writing resources have been created yet.</p>}
        {resources.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-slate-800">
          <div><h2 className="font-bold">{item.title || 'Untitled resource'}</h2><p>{item.status === 'published' ? 'Published · visible to matching Writing Practice tasks' : 'Draft · not visible to students until published'} · {item.sections.length} section(s)</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setResource(clone(item)); setSavedSnapshot(JSON.stringify(item)); }} className="rounded border px-3 py-2">Edit</button>
            <button type="button" onClick={() => { setResource({ ...clone(item), id: crypto.randomUUID(), title: `${item.title} (Copy)`, createdBy: teacherUid, status: 'draft', sections: item.sections.map(section => ({ ...section, id: crypto.randomUUID() })) }); setSavedSnapshot(''); }} className="rounded border px-3 py-2">Duplicate</button>
            <button type="button" onClick={() => { setResource(clone(item)); setPendingAction('delete'); }} className="rounded border border-red-400 px-3 py-2 text-red-700">Delete</button>
          </div>
        </article>)}
      </section>
    );
  }

  if (preview) return <section className="writing-resource-manager space-y-4 text-left text-slate-900 dark:text-slate-100">
    <button type="button" className="rounded border px-3 py-2" onClick={() => setPreview(false)}>Back to editor</button>
    <WritingResourceTable
      resources={[{ ...resource, status: 'published' }]}
      taskType={resource.taskType || 1}
      assessmentId={resource.linkedAssessmentId}
      questionId={resource.linkedQuestionId}
    />
  </section>;

  return (
    <section className="writing-resource-manager space-y-4 text-left text-slate-900 dark:text-slate-100">
      {discardDialog && <div role="dialog" aria-modal="true" aria-labelledby="resource-discard-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
        <div className="max-w-lg rounded-xl bg-white p-6 text-slate-900 dark:bg-slate-800 dark:text-white">
          <h2 id="resource-discard-title" className="text-xl font-bold">Discard unsaved resource changes?</h2>
          <p className="mt-3">Your edits have not been saved. Leaving this editor will discard them.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDiscardDialog(false)}>Keep editing</button><button type="button" onClick={discardChanges} className="rounded bg-red-700 px-3 py-2 text-white">Discard changes</button></div>
        </div>
      </div>}
      {pendingAction && <div role="dialog" aria-modal="true" aria-labelledby="resource-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="max-w-lg rounded-xl bg-white p-6 text-slate-900 dark:bg-slate-800 dark:text-white">
          <h2 id="resource-confirm-title" className="text-xl font-bold">{pendingAction === 'delete' ? 'Delete resource?' : pendingAction === 'publish' ? 'Publish resource?' : 'Unpublish resource?'}</h2>
          <p className="mt-3">{pendingAction === 'delete' ? 'This removes the resource from student access and cannot be undone automatically.' : 'This changes student visibility. The resource text and assessment data remain intact.'}</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPendingAction(null)}>Cancel</button><button type="button" onClick={() => void confirmPendingAction()} className="rounded bg-red-700 px-3 py-2 text-white">Confirm</button></div>
        </div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-2xl font-bold">Edit writing resource</h1>{isDirty && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Unsaved changes</p>}</div><div className="flex gap-2"><button type="button" className="rounded border px-3 py-2" onClick={requestBack}>Back to resources</button><button type="button" className="rounded border border-red-400 px-3 py-2 text-red-700" onClick={() => setPendingAction('delete')}>Delete resource</button></div></div>
      <label className="block font-semibold">Title<input value={resource.title} onChange={event => updateResource(current => ({ ...current, title: event.target.value }))} /></label>
      <label className="block font-semibold">Description<textarea value={resource.description || ''} onChange={event => updateResource(current => ({ ...current, description: event.target.value }))} rows={2} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block font-semibold">Task type<select value={resource.taskType || ''} onChange={event => updateResource(current => ({ ...current, taskType: event.target.value ? Number(event.target.value) as 1 | 2 : undefined }))}><option value="">All writing tasks</option><option value="1">Task 1</option><option value="2">Task 2</option></select></label>
        <label className="block font-semibold">Assessment / figure
          <select value={selectedFigure || (resource.linkedAssessmentId && resource.linkedQuestionId ? `${resource.linkedAssessmentId}:${resource.linkedQuestionId}` : '')} onChange={event => {
            setSelectedFigure(event.target.value);
            const target = linkableQuestions.find(item => item.id === event.target.value);
            updateResource(current => target ? {
              ...current,
              linkedAssessmentId: target.test.id,
              linkedQuestionId: target.question.id,
              ...(target.question.imageAsset ? { figureAsset: target.question.imageAsset } : { figureAsset: undefined }),
            } : { ...current, linkedAssessmentId: undefined, linkedQuestionId: undefined, figureAsset: undefined });
          }}>
            <option value="">No linked figure</option>
            {linkableQuestions.map(item => <option key={item.id} value={item.id}>{item.test.title} — {item.question.text?.slice(0, 60) || item.question.id}{item.question.imageAsset ? ' (figure attached)' : ''}</option>)}
          </select>
        </label>
      </div>
      {resource.sections.map((section, sectionIndex) => <fieldset key={section.id} className="space-y-3 rounded-xl border p-4">
        <legend className="px-2 font-bold">{section.title || `Section ${sectionIndex + 1}`}</legend>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Section heading" value={section.title} onChange={event => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, title: event.target.value } : item) }))} />
          <button type="button" onClick={() => updateResource(current => {
            if (sectionIndex === 0) return current;
            const sections = [...current.sections];
            [sections[sectionIndex - 1], sections[sectionIndex]] = [sections[sectionIndex], sections[sectionIndex - 1]];
            return { ...current, sections };
          })} aria-label={`Move ${section.title} up`}>↑</button>
          <button type="button" onClick={() => updateResource(current => {
            if (sectionIndex >= current.sections.length - 1) return current;
            const sections = [...current.sections];
            [sections[sectionIndex + 1], sections[sectionIndex]] = [sections[sectionIndex], sections[sectionIndex + 1]];
            return { ...current, sections };
          })} aria-label={`Move ${section.title} down`}>↓</button>
          <button type="button" onClick={() => updateResource(current => {
            const copy = clone(section);
            copy.id = crypto.randomUUID();
            return { ...current, sections: [...current.sections.slice(0, sectionIndex + 1), copy, ...current.sections.slice(sectionIndex + 1)] };
          })}>Duplicate section</button>
          <button type="button" onClick={() => updateResource(current => ({ ...current, sections: current.sections.filter((_, index) => index !== sectionIndex) }))}>Delete section</button>
        </div>
        <div className="space-y-3">{section.rows.map((row, rowIndex) => <div key={`${section.id}-${rowIndex}`} className="grid gap-2 sm:grid-cols-3">
          <label>Original<input value={row.original} onChange={event => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: item.rows.map((entry, row) => row === rowIndex ? { ...entry, original: event.target.value } : entry) } : item) }))} /></label>
          <label>Definition<textarea value={row.definition} rows={2} onChange={event => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: item.rows.map((entry, row) => row === rowIndex ? { ...entry, definition: event.target.value } : entry) } : item) }))} /></label>
          <label>Alternatives (one per line)<textarea value={row.alternatives.join('\n')} rows={2} onChange={event => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: item.rows.map((entry, row) => row === rowIndex ? { ...entry, alternatives: event.target.value.split(/\r?\n/) } : entry) } : item) }))} /><div className="flex gap-2">
            <button type="button" onClick={() => updateResource(current => {
              if (rowIndex === 0) return current;
              const sections = [...current.sections];
              const rows = [...sections[sectionIndex].rows];
              [rows[rowIndex - 1], rows[rowIndex]] = [rows[rowIndex], rows[rowIndex - 1]];
              sections[sectionIndex] = { ...sections[sectionIndex], rows };
              return { ...current, sections };
            })}>↑</button>
            <button type="button" onClick={() => updateResource(current => {
              if (rowIndex >= current.sections[sectionIndex].rows.length - 1) return current;
              const sections = [...current.sections];
              const rows = [...sections[sectionIndex].rows];
              [rows[rowIndex + 1], rows[rowIndex]] = [rows[rowIndex], rows[rowIndex + 1]];
              sections[sectionIndex] = { ...sections[sectionIndex], rows };
              return { ...current, sections };
            })}>↓</button>
            <button type="button" onClick={() => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: [...item.rows.slice(0, rowIndex + 1), clone(row), ...item.rows.slice(rowIndex + 1)] } : item) }))}>Duplicate row</button>
            <button type="button" onClick={() => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: item.rows.filter((_, row) => row !== rowIndex) } : item) }))}>Delete row</button>
          </div></label>
        </div>)}</div>
        <button type="button" onClick={() => updateResource(current => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, rows: [...item.rows, { original: '', definition: '', alternatives: [] }] } : item) }))}>Add row</button>
      </fieldset>)}
      <button type="button" onClick={() => updateResource(current => ({ ...current, sections: [...current.sections, { id: crypto.randomUUID(), title: '', columns: ['Original Word/Phrase', 'Definition', 'Synonyms / Alternative Phrases'], rows: [{ original: '', definition: '', alternatives: [] }] }] }))}>Add section</button>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPreview(true)} className="rounded border px-3 py-2">Preview student view</button>
        <button type="button" onClick={exportJson} className="rounded border px-3 py-2">Export JSON</button>
        <button type="button" disabled={busy} onClick={() => void save('draft')} className="rounded border px-3 py-2 disabled:opacity-50">Save draft</button>
        <button type="button" disabled={busy} onClick={() => setPendingAction(resource.status === 'published' ? 'unpublish' : 'publish')} className="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">{resource.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      </div>
      <label className="block font-semibold">Canonical JSON<input value={jsonText} onChange={event => setJsonText(event.target.value)} /></label>
      <button type="button" onClick={importJson} className="rounded border px-3 py-2">Validate and apply JSON</button>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </section>
  );
}
