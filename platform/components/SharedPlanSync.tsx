'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';

/** Refresh clean views only. Server-side version checks also reject stale writes. */
export function useSharedPlanSync(eventId: string, version: number, dirty: RefObject<boolean>, paused: boolean) {
  const router = useRouter();
  const [newVersion, setNewVersion] = useState(false);
  useEffect(() => { setNewVersion(false); }, [version]);
  useEffect(() => {
    if (paused) return;
    const abort = new AbortController();
    let running = false;
    const check = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/plan-state`, { cache: 'no-store', signal: abort.signal });
        if (!response.ok) return;
        const state = await response.json() as { version: number };
        if (abort.signal.aborted) return;
        if (state.version !== version) {
          if (dirty.current) setNewVersion(true);
          else router.refresh();
        }
      } catch { /* A temporary connection failure must not disturb local edits. */ }
      finally { running = false; }
    };
    const timer = window.setInterval(check, 8000);
    window.addEventListener('focus', check);
    return () => { abort.abort(); window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, [eventId, version, dirty, paused, router]);
  return newVersion;
}

export function SharedPlanSync({ eventId, version }: { eventId: string; version: number }) {
  const dirty = useRef(false);
  useSharedPlanSync(eventId, version, dirty, false);
  return null;
}
