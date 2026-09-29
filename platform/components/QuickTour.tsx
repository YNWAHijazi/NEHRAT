'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { acknowledgeTour } from '../app/tour-actions';
import { quickTourSteps } from '../lib/quick-tour';
import { L } from './L';
import { TOUR_LAYOUT } from '../lib/presentation';
import styles from './QuickTour.module.css';

type Box = { x: number; y: number; width: number; height: number };
export function QuickTour({ accountId, role, home, pending }: { accountId: number; role: string; home: string; pending: boolean }) {
  const pathname = usePathname();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [panelHeight, setPanelHeight] = useState(260);
  const [saveFailed, setSaveFailed] = useState(false);
  const started = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const originalScroll = useRef(0);
  const titleId = useId();
  const bodyId = useId();
  const steps = quickTourSteps(role);
  const step = index === null ? null : steps[index];

  useEffect(() => { started.current = false; }, [accountId]);
  useEffect(() => {
    if (pathname !== home || started.current) return;
    const url = new URL(window.location.href);
    const replay = url.searchParams.get('tour') === '1';
    let seenInTab = false;
    try { seenInTab = sessionStorage.getItem(`quick-tour-seen:${accountId}`) === '1'; } catch { /* Storage may be disabled; account persistence still works. */ }
    if (!replay && (!pending || seenInTab)) return;
    started.current = true;
    try { sessionStorage.setItem(`quick-tour-seen:${accountId}`, '1'); } catch { /* Optional tab cache only. */ }
    if (replay) {
      url.searchParams.delete('tour');
      window.history.replaceState(window.history.state, '', url);
    }
    originalScroll.current = window.scrollY;
    setIndex(0);
    // Persist when shown so reloads, navigation and skipped tours do not repeat it.
    void acknowledgeTour().then((ok) => { if (!ok) setSaveFailed(true); }).catch(() => setSaveFailed(true));
  }, [pathname, home, pending, accountId]);

  const close = () => {
    dialog.current?.close();
    setIndex(null);
    window.scrollTo({ top: originalScroll.current, behavior: 'instant' });
    document.querySelector<HTMLButtonElement>('[data-tour="account"]')?.focus({ preventScroll: true });
    if (saveFailed) void acknowledgeTour().catch(() => {});
  };

  useEffect(() => {
    if (index === null) return;
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    next.current?.focus({ preventScroll: true });
    const target = step?.target ? document.querySelector<HTMLElement>(step.target) : null;
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (panel.current) setPanelHeight(panel.current.getBoundingClientRect().height);
      if (!target || !target.isConnected || !target.getClientRects().length) { setBox(null); return; }
      const rect = target.getBoundingClientRect();
      const x = Math.max(8, rect.x - 5);
      const y = Math.max(8, rect.y - 5);
      const right = Math.min(window.innerWidth - 8, rect.right + 5);
      const bottom = Math.min(window.innerHeight - 8, rect.bottom + 5);
      setBox(right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (target) observer.observe(target);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [index, step?.target]);

  if (index === null || !step) return null;
  const width = Math.min(360, Math.max(0, viewport.width - 32));
  const rtl = document.documentElement.dir === 'rtl';
  // DOMRect uses physical coordinates; convert to logical inset for RTL.
  const inline = box ? (rtl ? viewport.width - box.x - box.width : box.x) : (viewport.width - width) / 2;
  const top = box && box.y + box.height + TOUR_LAYOUT.gap + panelHeight < viewport.height - 16
    ? box.y + box.height + TOUR_LAYOUT.gap
    : box && box.y - panelHeight - TOUR_LAYOUT.gap > 16 ? box.y - panelHeight - TOUR_LAYOUT.gap : (viewport.height - panelHeight) / 2;
  return createPortal(
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={bodyId}
      onCancel={(event) => { event.preventDefault(); close(); }} data-quick-tour="">
      {box ? <div aria-hidden="true" className={styles.spotlight} style={{ insetInlineStart: rtl ? viewport.width - box.x - box.width : box.x, insetBlockStart: box.y, width: box.width, height: box.height }} /> : <div aria-hidden="true" className={styles.shade} />}
      <div ref={panel} className={styles.panel} style={{ width, insetInlineStart: Math.max(16, Math.min(inline, viewport.width - width - 16)), insetBlockStart: Math.max(16, top), visibility: viewport.width ? 'visible' : 'hidden' }}>
        <h2 id={titleId}><L {...step.title} /></h2>
        <p id={bodyId}><L {...step.body} /></p>
        {saveFailed ? <p role="status"><L en="We could not save your tour preference. It may appear again when you sign in." ar="تعذّر حفظ تفضيل الجولة. قد تظهر مجدداً عند تسجيل الدخول." /></p> : null}
        <div className={styles.controls}>
          <span className={styles.count} aria-live="polite"><L en={`${index + 1} of ${steps.length}`} ar={`${index + 1} من ${steps.length}`} /></span>
          {index > 0 ? <button type="button" onClick={() => setIndex(index - 1)}><L en="Back" ar="السابق" /></button> : null}
          <button type="button" onClick={close}><L en="Skip" ar="تخطّي" /></button>
          <button ref={next} type="button" className={styles.next} onClick={() => index === steps.length - 1 ? close() : setIndex(index + 1)}>
            <L en={index === steps.length - 1 ? 'Done' : 'Next'} ar={index === steps.length - 1 ? 'تمّ' : 'التالي'} />
          </button>
        </div>
      </div>
    </dialog>, document.body,
  );
}
