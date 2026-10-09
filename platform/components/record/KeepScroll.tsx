'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A row action that returns to the same record page (an invitation sent from the EMS row)
 * must leave the screen where it was (owner, 8 October 2026): the redirect otherwise
 * scrolls to the top and the hand-off dialog opens over the page header. The form notes
 * the scroll position as it submits; the record page puts it back when it returns.
 */
const KEY = 'record:keep-scroll';

/** Inside a form: remembers the scroll position when that form submits. */
export function KeepScrollOnSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const note = () => {
      try { sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, y: window.scrollY, at: Date.now() })); } catch { /* storage unavailable: the page simply scrolls as before */ }
    };
    form.addEventListener('submit', note);
    return () => form.removeEventListener('submit', note);
  }, []);
  return <span ref={ref} hidden />;
}

/** On the record page: puts the remembered position back after the action's redirect. */
export function RestoreScroll() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    let saved: { path: string; y: number; at: number } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { saved = null; }
    if (!saved || saved.path !== pathname || Date.now() - saved.at > 60_000) return;
    try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
    const y = saved.y;
    // The router scrolls to the top after it commits the new page; put the position back after it has.
    const put = () => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    put();
    const frame = requestAnimationFrame(put);
    const timers = [120, 400].map((ms) => window.setTimeout(put, ms));
    return () => { cancelAnimationFrame(frame); timers.forEach((t) => window.clearTimeout(t)); };
  }, [pathname, search]);
  return null;
}
