'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { L } from './L';

/** Optional help stays out of document flow so opening it never moves its trigger. */
export function InfoNote({ children, labelEn = 'More information', labelAr = 'معلومات إضافية' }: {
  children: ReactNode; labelEn?: string; labelAr?: string;
}) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<{ insetBlockStart: number; insetInlineStart: number } | null>(null);
  const open = pinned || hovered;
  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const close = () => { cancelLeave(); setPinned(false); setHovered(false); };

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const box = panel.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const rtl = document.documentElement.dir === 'rtl';
      const x = Math.max(12, Math.min(rtl ? rect.right - box.width : rect.left, width - box.width - 12));
      const below = rect.bottom + 8;
      const y = below + box.height <= height - 12 || rect.top < height - rect.bottom
        ? Math.min(below, height - box.height - 12)
        : rect.top - box.height - 8;
      setPosition({ insetBlockStart: Math.max(12, y), insetInlineStart: rtl ? width - x - box.width : x });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    // Language switching changes text height and direction without a page load.
    const resize = new ResizeObserver(place);
    resize.observe(panel.current!);
    const language = new MutationObserver(place);
    language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); resize.disconnect(); language.disconnect(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  return (
    <span ref={root} className="info-note"
      onPointerEnter={(event) => { cancelLeave(); if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => { cancelLeave(); leaveTimer.current = setTimeout(() => setHovered(false), 160); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); trigger.current?.focus(); } }}>
      <button ref={trigger} type="button" className="info-note-trigger" aria-expanded={open} aria-controls={id}
        onClick={() => { cancelLeave(); setPinned(!pinned); setHovered(false); }}>
        <span aria-hidden="true">i</span><span className="info-note-label"><L en={labelEn} ar={labelAr} /></span>
      </button>
      <span ref={panel} id={id} className="info-note-content" role="note" hidden={!open}
        style={{ ...position, visibility: open && !position ? 'hidden' : undefined }}>{children}</span>
    </span>
  );
}
