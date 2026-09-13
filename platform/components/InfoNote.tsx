'use client';

import { useId, useState, type ReactNode } from 'react';
import { L } from './L';

/** Secondary help, available by pointer, keyboard and touch; never a home for errors. */
export function InfoNote({ children, labelEn = 'More information', labelAr = 'معلومات إضافية' }: {
  children: ReactNode; labelEn?: string; labelAr?: string;
}) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  return (
    <span className="info-note" onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)} onKeyDown={(event) => {
        if (event.key === 'Escape') { setPinned(false); setHovered(false); }
      }}>
      <button type="button" className="info-note-trigger" aria-expanded={open} aria-controls={id}
        onClick={() => { setPinned(!pinned); setHovered(false); }}>
        <span aria-hidden="true">i</span><span className="info-note-label"><L en={labelEn} ar={labelAr} /></span>
      </button>
      <span id={id} className="info-note-content" hidden={!open}>{children}</span>
    </span>
  );
}
