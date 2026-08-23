'use client';

/**
 * The control dock: text size 100/112/125, dark mode, palette, language. Government
 * accessibility features, not decoration (SPEC 8). Hidden below 900px by the [data-dock]
 * media rule in globals.css. Choices persist in cookies so the server renders the right
 * html attributes and nothing flashes.
 */

import { useCallback } from 'react';

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
  height: 30,
  paddingInline: 10,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  borderRadius: 15,
  fontSize: 12,
  cursor: 'pointer',
};

export function ControlDock() {
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

  return (
    <div
      data-dock=""
      data-noprint=""
      style={{
        position: 'fixed',
        insetBlockStart: '50%',
        insetInlineEnd: 14,
        transform: 'translateY(-50%)',
        zIndex: 70,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 8px 26px rgba(0,0,0,.12)',
      }}
    >
      {([100, 112, 125] as const).map((size) => (
        <button
          key={size}
          type="button"
          style={dockBtn}
          aria-label={`Text size ${size}%`}
          onClick={() => setPref('textsize', String(size))}
        >
          A{size === 100 ? '' : size === 112 ? '+' : '++'}
        </button>
      ))}
      <button type="button" style={dockBtn} onClick={() => toggle('theme')}>
        <span data-l="en">Dark</span>
        <span data-l="ar">داكن</span>
      </button>
      <button type="button" style={dockBtn} onClick={() => toggle('palette')}>
        <span data-l="en">Palette</span>
        <span data-l="ar">لوحة</span>
      </button>
      <button type="button" style={dockBtn} onClick={() => toggle('lang')}>
        <span data-l="en">عربي</span>
        <span data-l="ar">EN</span>
      </button>
    </div>
  );
}
