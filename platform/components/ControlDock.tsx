'use client';

/** Display preferences stay behind one control; language is also in the header. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { L } from './L';

const SIZES = [100, 112, 125] as const;
type Size = (typeof SIZES)[number];

function setPref(name: string, value: string): void {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
  document.documentElement.setAttribute(
    name === 'textsize' ? 'data-textsize' : name === 'lang' ? 'lang' : `data-${name}`,
    value,
  );
  if (name === 'lang') {
    document.documentElement.setAttribute('dir', value === 'ar' ? 'rtl' : 'ltr');
  }
}

const dockBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
};

export function ControlDock() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  // Read once on mount from what the server already stamped, so the first press
  // continues the cycle rather than restarting it.
  const [size, setSize] = useState<Size>(() => {
    if (typeof document === 'undefined') return 100;
    const stamped = document.documentElement.getAttribute('data-textsize');
    return SIZES.find((s) => String(s) === stamped) ?? 100;
  });

  const cycleText = useCallback(() => {
    setSize((current) => {
      const next = SIZES[(SIZES.indexOf(current) + 1) % SIZES.length]!;
      setPref('textsize', String(next));
      return next;
    });
  }, []);

  const toggle = useCallback((name: 'theme' | 'palette' | 'lang') => {
    const h = document.documentElement;
    if (name === 'theme') {
      setPref('theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    } else if (name === 'palette') {
      setPref('palette', h.getAttribute('data-palette') === 'cedar' ? 'petrol' : 'cedar');
    } else {
      setPref('lang', h.getAttribute('lang') === 'ar' ? 'en' : 'ar');
    }
  }, []);

  const nextSize = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length]!;

  return (
    <div ref={root} data-dock="" data-noprint="" className="display-settings"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} type="button" style={dockBtn} aria-expanded={open} aria-controls="display-preferences"
        onClick={() => setOpen(!open)}>
        <span className="sr-only"><L en="Display settings" ar="إعدادات العرض" /></span>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--bg)"/><circle cx="15" cy="17" r="3" fill="var(--bg)"/></svg>
      </button>
      <div id="display-preferences" hidden={!open} className="display-preferences">
      <strong><L en="Display settings" ar="إعدادات العرض" /></strong>
      <div className="display-preference-row"><L en="Text size" ar="حجم النص" />
      <button
        type="button"
        style={{ ...dockBtn, fontSize: 13, alignItems: 'baseline', gridAutoFlow: 'column' }}
        title="Text size"
        aria-label={`Text size — currently ${size}%, press for ${nextSize}%`}
        onClick={cycleText}
      >
        A<span style={{ fontSize: 18 }}>A</span>
      </button></div>

      <div className="display-preference-row"><L en="Dark mode" ar="الوضع الداكن" /><button type="button" style={dockBtn} title="Dark mode" aria-label="Dark mode" onClick={() => toggle('theme')}>
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1.5px solid currentColor',
            background: 'linear-gradient(90deg, currentColor 50%, transparent 50%)',
          }}
        />
      </button></div>

      <div className="display-preference-row"><L en="Colors" ar="الألوان" /><button type="button" style={dockBtn} title="Palette" aria-label="Palette" onClick={() => toggle('palette')}>
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: 'inset 0 0 0 1.5px var(--brand)',
          }}
        />
      </button></div>

      <div className="display-preference-row"><L en="Language" ar="اللغة" /><button
        type="button"
        style={{ ...dockBtn, fontSize: 13, fontWeight: 500 }}
        title="Language"
        aria-label="Change language"
        onClick={() => toggle('lang')}
      >
        <span data-l="en">ع</span>
        <span data-l="ar">EN</span>
      </button></div>
      </div>
    </div>
  );
}
