import { useEffect, useState } from 'react';
import { getFigureSource, requiresTaskFigure } from './figureAssets';

type PromptFigureProps = {
  question: Record<string, any>;
  assessmentId?: string;
  teacherFacing?: boolean;
};

export function PromptFigure({ question, assessmentId = 'unknown', teacherFacing = false }: PromptFigureProps) {
  const source = getFigureSource(question);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(source ? 'loading' : 'error');
  const assetPath = question.imageAsset?.storagePath || (source ? new URL(source).pathname : 'missing');
  const alt = question.imageAsset?.alt || question.imageAlt || 'Assessment task figure';
  const caption = question.imageAsset?.caption || question.figureCaption || '';

  useEffect(() => {
    setStatus(source ? 'loading' : 'error');
  }, [source]);

  if (!source && !requiresTaskFigure(question)) return null;

  return (
    <figure className="my-4 w-full min-w-0">
      {source && status === 'loading' && (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" role="status">
          Loading task figure…
        </div>
      )}
      {source && (
        <img
          src={source}
          alt={alt}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain ${status === 'loaded' ? 'block' : 'hidden'}`}
          style={question.imageAsset?.width && question.imageAsset?.height
            ? { aspectRatio: `${question.imageAsset.width} / ${question.imageAsset.height}` }
            : undefined}
        />
      )}
      {status === 'error' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          The task figure is unavailable. Please notify your teacher.
        </div>
      )}
      {status === 'loaded' && caption && <figcaption className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">{caption}</figcaption>}
      {status === 'loaded' && (
        <a href={source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-700 underline dark:text-blue-300">
          Open figure in a new tab
        </a>
      )}
      {teacherFacing && (
        <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer">Figure diagnostics</summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 break-all">
            <dt>Assessment</dt><dd>{assessmentId}</dd>
            <dt>Question</dt><dd>{question.id || 'unknown'}</dd>
            <dt>Asset version</dt><dd>{question.imageAsset?.assetVersion || 'legacy URL'}</dd>
            <dt>URL/path</dt><dd>{assetPath}</dd>
            <dt>Status</dt><dd>{status === 'loaded' ? 'Available' : status === 'loading' ? 'Loading' : 'Unavailable'}</dd>
          </dl>
        </details>
      )}
    </figure>
  );
}
