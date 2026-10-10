'use client';

import { useState } from 'react';
import { L } from './L';

/**
 * "Show more" for the service pages (owner, 10 October 2026, after TAMM): a paragraph clamped
 * to a few lines, or a list showing its first few items, each with one control to see the rest.
 * Everything is in the page from the start -- collapsed text is clamped and collapsed items are
 * hidden, never fetched later -- so a search engine, a printer and a screen reader's "read all"
 * see the whole service.
 */

const toggleStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, minBlockSize: 44, padding: 0, border: 0, background: 'none',
  color: 'var(--brand)', fontSize: 16, fontWeight: 500, cursor: 'pointer',
};

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

function Toggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} data-show-more="" style={toggleStyle} data-noprint="">
      {open ? <L en="Show less" ar="عرض أقل" /> : <L en="Show more" ar="عرض المزيد" />}
      <Chevron open={open} />
    </button>
  );
}

/** A paragraph clamped to `lines` lines until opened. */
export function ShowMoreText({ children, lines = 3, region }: { children: React.ReactNode; lines?: number; region?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-region={region}>
      <div style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {children}
      </div>
      <Toggle open={open} onClick={() => setOpen((o) => !o)} />
    </div>
  );
}

/**
 * A list showing its first `visible` items until opened. Each item is a direct `div` child of
 * the region, so the region's structure is the same open or closed.
 */
export function ShowMoreList({ items, visible = 3, region, style }: { items: React.ReactNode[]; visible?: number; region?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div data-region={region} style={style}>
        {items.map((item, i) => (
          <div key={i} hidden={!open && i >= visible} data-show-item="">{item}</div>
        ))}
      </div>
      {items.length > visible ? <Toggle open={open} onClick={() => setOpen((o) => !o)} /> : null}
    </>
  );
}
