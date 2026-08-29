'use client';

/**
 * The control dock: text size, dark mode, palette, language. Government accessibility
 * features, not decoration (SPEC 8). Hidden below 900px by the [data-dock] media rule
 * in globals.css. Choices persist in cookies so the server renders the right html
 * attributes and nothing flashes.
 *
 * FOUR ROUND BUTTONS, NOT SIX STACKED LABELS. Text size CYCLES on one button rather
 * than offering three — the three sizes are one setting, and rendering them as three
 * controls made the dock read as a menu of six unrelated things sitting over the page.
 * The glyphs are the prototype's: two A's for size, a half-filled disc for theme, a
 * two-colour disc for palette, and the other language's own name.
 *
 * Each carries a title and an aria-label, because a glyph is not a name. Cycling means
 * the button's meaning changes with its state, so the label says what pressing it does
 * NEXT rather than what the current size is.
 */

import { useCallback, useState } from 'react';

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
    <div
      data-dock=""
      data-noprint=""
      style={{
        position: 'fixed',
        insetBlockStart: '50%',
        insetInlineEnd: 22,
        transform: 'translateY(-50%)',
        zIndex: 70,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <button
        type="button"
        style={{ ...dockBtn, fontSize: 13, alignItems: 'baseline', gridAutoFlow: 'column' }}
        title="Text size"
        aria-label={`Text size — currently ${size}%, press for ${nextSize}%`}
        onClick={cycleText}
      >
        A<span style={{ fontSize: 18 }}>A</span>
      </button>

      <button type="button" style={dockBtn} title="Dark mode" aria-label="Dark mode" onClick={() => toggle('theme')}>
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
      </button>

      <button type="button" style={dockBtn} title="Palette" aria-label="Palette" onClick={() => toggle('palette')}>
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
      </button>

      <button
        type="button"
        style={{ ...dockBtn, fontSize: 13, fontWeight: 500 }}
        title="Language"
        aria-label="Change language"
        onClick={() => toggle('lang')}
      >
        <span data-l="en">ع</span>
        <span data-l="ar">EN</span>
      </button>
    </div>
  );
}
