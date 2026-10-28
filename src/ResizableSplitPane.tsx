import React, { useEffect, useRef, useState } from 'react';

type Props = {
  workspaceKey: string;
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  className?: string;
};

export function ResizableSplitPane({
  workspaceKey,
  left,
  right,
  leftLabel,
  rightLabel,
  defaultLeftPercent = 58,
  minLeftPercent = 35,
  maxLeftPercent = 72,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`split-pane:${workspaceKey}`));
      if (Number.isFinite(saved) && saved >= minLeftPercent && saved <= maxLeftPercent) setLeftPercent(saved);
    } catch (error) {
      console.warn('Could not restore split-pane width:', error);
    }
  }, [workspaceKey, minLeftPercent, maxLeftPercent]);

  const saveWidth = (value: number) => {
    const bounded = Math.min(maxLeftPercent, Math.max(minLeftPercent, value));
    setLeftPercent(bounded);
    try {
      localStorage.setItem(`split-pane:${workspaceKey}`, String(bounded));
    } catch (error) {
      console.warn('Could not persist split-pane width:', error);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    saveWidth(((event.clientX - bounds.left) / bounds.width) * 100);
  };

  return (
    <div className={`split-pane ${className} ${dragging ? 'is-dragging' : ''}`} ref={containerRef} style={{ '--split-left': `${leftPercent}fr`, '--split-right': `${100 - leftPercent}fr` } as React.CSSProperties}>
      <div className={`split-pane__panel split-pane__left ${activePane === 'left' ? 'is-active' : ''}`} role="region" aria-label={leftLabel}>{left}</div>
      <div
        className="split-pane__divider"
        role="separator"
        aria-label={`Resize ${leftLabel} and ${rightLabel} panes`}
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPercent)}
        aria-valuemin={minLeftPercent}
        aria-valuemax={maxLeftPercent}
        tabIndex={0}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); saveWidth(leftPercent - 3); }
          if (event.key === 'ArrowRight') { event.preventDefault(); saveWidth(leftPercent + 3); }
          if (event.key === 'Home') { event.preventDefault(); saveWidth(minLeftPercent); }
          if (event.key === 'End') { event.preventDefault(); saveWidth(maxLeftPercent); }
        }}
      ><span aria-hidden="true" /></div>
      <div className={`split-pane__panel split-pane__right ${activePane === 'right' ? 'is-active' : ''}`} role="region" aria-label={rightLabel}>{right}</div>
      <button type="button" className="split-pane__reset" onClick={() => saveWidth(defaultLeftPercent)}>Reset pane width</button>
      <div className="split-pane__mobile-tabs" role="tablist" aria-label="Workspace panels">
        <button type="button" role="tab" aria-selected={activePane === 'left'} onClick={() => setActivePane('left')}>{leftLabel}</button>
        <button type="button" role="tab" aria-selected={activePane === 'right'} onClick={() => setActivePane('right')}>{rightLabel}</button>
      </div>
    </div>
  );
}
