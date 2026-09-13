'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { L } from './L';

const SERVICES = [
  { href: '/events/new', en: 'Start an event', ar: 'بدء فعالية' },
  { href: '/venues/new', en: 'Register a recurring venue', ar: 'تسجيل موقع فعاليات متكرر' },
  { href: '/facilities/new', en: 'Register a facility', ar: 'تسجيل منشأة' },
];

/** Three direct choices; requirements are presented in the selected service. */
export function StartServiceMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  return (
    <div ref={container} data-service-picker="" style={{ flex: 'none', position: 'relative' }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{ height: 44, paddingInline: 20, border: 0, borderRadius: 22,
          background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px',
          fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10 }}
      >
        <L en="Start a service" ar="بدء خدمة" />
        <span aria-hidden="true" style={{ fontSize: 11 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div id={panelId} data-svc-menu="" style={{ position: 'absolute', insetInlineEnd: 0,
          top: 52, zIndex: 30, width: 300, maxWidth: '86vw', background: 'var(--bg)',
          border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          padding: 6, display: 'grid', gap: 2 }}>
          {SERVICES.map((service) => (
            <Link key={service.href} href={service.href} onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '14px 12px', borderRadius: 8,
                fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
              <L en={service.en} ar={service.ar} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
