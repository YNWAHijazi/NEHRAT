'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { L } from '../L';
import { saveDirtyIn } from './autosave';

export interface StepperStep {
  key: string;
  /** The id the step's card carries (req-B7, final-review). */
  anchor: string;
  labelEn: string;
  labelAr: string;
  stateEn: string;
  stateAr: string;
  state: 'complete' | 'pending' | 'notAdded' | 'notProvided' | 'waiting' | 'later' | 'final';
  kind: 'required' | 'recommended' | 'final';
  /** Whether the viewer may enter this step; another party's step reads grey and names who handles it. */
  yours: boolean;
  /** Who handles it, shown in place of the state on another party's step. */
  whoEn: string;
  whoAr: string;
  body: ReactNode;
}

/** The step a hash points into: the card itself, or anything inside it (a plan section, an item). */
function stepFor(hash: string): string | null {
  const id = hash.startsWith('#') ? hash.slice(1) : '';
  if (!id) return null;
  const wrap = document.getElementById(id)?.closest<HTMLElement>('[data-step]');
  return wrap?.dataset['step'] ?? null;
}

/**
 * One requirement at a time (owner direction, 2026-10-07). The numbered step list is a
 * side column on desktop and a sticky, collapsible bar on a phone; the current step's
 * card sits in the main column with Previous and Next beneath it. A summary row, a
 * blocker link, a deep link or a redirect's anchor names a step and this shows it.
 * Nothing here decides state: the steps arrive resolved.
 */
export function RecordStepper({ steps, initialKey, listHref, groups, finalNext = { en: 'Next: review and submit', ar: 'التالي: المراجعة والتقديم' } }: {
  steps: StepperStep[];
  initialKey: string;
  listHref?: string | null;
  groups: { required: { en: string; ar: string }; recommended: { en: string; ar: string } };
  /** The Next button into the final step; a facility registers rather than submits. */
  finalNext?: { en: string; ar: string };
}) {
  const [current, setCurrent] = useState(initialKey);
  const [navOpen, setNavOpen] = useState(false);
  const pendingHash = useRef<string | null>(null);
  const keys = steps.map((s) => s.key).join('|');
  const index = Math.max(0, steps.findIndex((s) => s.key === current));
  const step = steps[index];

  const [saving, setSaving] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  // On a phone the list is a bar pinned under the header. Opened while pinned it covered the
  // step's fields (owner, 9 October 2026): opened, it leaves the pin and sits in the page above
  // the step, and the page scrolls to it -- the step is pushed down, never covered.
  const openNav = () => {
    const next = !navOpen;
    setNavOpen(next);
    if (!next || !window.matchMedia('(max-width: 900px)').matches) return;
    requestAnimationFrame(() => {
      const el = nav.current;
      if (!el) return;
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 56;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - header) });
    });
  };
  const show = (key: string) => {
    const target = steps.find((s) => s.key === key);
    if (!target) return;
    pendingHash.current = `#${target.anchor}`;
    history.replaceState(null, '', `#${target.anchor}`);
    setNavOpen(false);
    setCurrent(key);
  };
  // Leaving a step saves what was typed on it (owner, 8 October 2026); a refused save keeps the step on screen.
  const go = async (key: string) => {
    if (key === current) { show(key); return; }
    setSaving(true);
    const ok = await saveDirtyIn(body.current?.querySelector(`[data-step="${current}"]`) ?? null);
    setSaving(false);
    if (ok) show(key);
  };

  useEffect(() => {
    const fromHash = (hash: string) => {
      const key = stepFor(hash);
      if (!key || !keys.split('|').includes(key)) return;
      pendingHash.current = hash;
      setNavOpen(false);
      setCurrent(key);
    };
    fromHash(window.location.hash);
    const onHash = () => fromHash(window.location.hash);
    const onJump = (event: Event) => fromHash((event as CustomEvent<string>).detail);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('record:jump', onJump);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('record:jump', onJump); };
  }, [keys]);

  // Once the step is on screen, open whatever the hash named inside it, scroll to it and give it focus.
  // On mount the hash may name a step that is not yet current: it is left for the render that shows it.
  useEffect(() => {
    const hash = pendingHash.current;
    if (!hash) return;
    if (stepFor(hash) !== current) return;
    pendingHash.current = null;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    let node: HTMLElement | null = target;
    while (node) { if (node instanceof HTMLDetailsElement) node.open = true; node = node.parentElement; }
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // A form control or link inside the step takes focus; the card's summary never does (its ring read as a stray box).
    const focusable = target.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]');
    if (focusable) focusable.focus({ preventScroll: true });
  }, [current]);

  // The viewer's own open steps are amber until done, then green; another party's steps stay grey (owner, 2026-10-07).
  const numberStyle = (s: StepperStep, i: number): React.CSSProperties => ({
    flex: 'none', inlineSize: 28, blockSize: 28, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
    ...(i === index ? { background: 'var(--ink)', color: 'var(--bg)' }
      : s.state === 'complete' ? { background: 'var(--brand)', color: 'var(--bg)' }
        : s.yours && s.kind === 'required' ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid var(--accent)' }
          : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--line)' }),
  });
  const stateLine = (s: StepperStep) => s.yours
    ? { en: s.stateEn, ar: s.stateAr, color: s.state === 'complete' ? 'var(--success)' : s.state === 'waiting' || s.kind === 'required' ? 'var(--accent-ink)' : 'var(--muted)' }
    : { en: s.state === 'complete' ? s.stateEn : s.whoEn, ar: s.state === 'complete' ? s.stateAr : s.whoAr, color: s.state === 'complete' ? 'var(--success)' : 'var(--muted)' };
  const total = steps.length;
  let lastKind: StepperStep['kind'] | null = null;

  return (
    <div data-region="record-stepper" className="record-stepper">
      <nav ref={nav} aria-label="Requirement steps" data-region="step-nav" data-open={navOpen || undefined} className="step-nav">
        <button type="button" className="step-nav-toggle" aria-expanded={navOpen} onClick={openNav}>
          <span style={numberStyle(step!, index)}>{index + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'start' }}>
            <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><L en={step!.labelEn} ar={step!.labelAr} /></span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={`Step ${index + 1} of ${total}`} ar={`الخطوة ${index + 1} من ${total}`} /></span>
          </span>
          <span aria-hidden="true" style={{ flex: 'none', fontSize: 18, color: 'var(--muted)', transform: navOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>⌄</span>
        </button>
        <div className="step-list-wrap">
          <div className="step-list-head">
            <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}><L en="Steps" ar="الخطوات" /></span>
            {listHref ? (
              <a href={listHref} data-region="requirement-list-link" style={{ fontSize: 12.5, color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                <L en="Download the full list" ar="تنزيل القائمة الكاملة" />
              </a>
            ) : null}
          </div>
          <ol className="step-list">
            {steps.map((s, i) => {
              const head = s.kind !== lastKind ? s.kind : null;
              lastKind = s.kind;
              return (
                <li key={s.key} data-step-item={s.key} data-step-state={i === index ? 'current' : s.state} data-step-yours={s.yours || undefined} className="step-item">
                  {head === 'recommended' ? <div className="step-group"><L en={`${groups.recommended.en} — optional`} ar={`${groups.recommended.ar} — اختياري`} /></div> : null}
                  <a href={`#${s.anchor}`} aria-current={i === index ? 'step' : undefined} onClick={(e) => { e.preventDefault(); void go(s.key); }} className="step-link">
                    <span style={numberStyle(s, i)}>{s.state === 'complete' && i !== index ? '✓' : i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 14.5, lineHeight: 1.35, fontWeight: i === index ? 600 : 400, color: i === index || (s.yours && s.state !== 'complete') ? 'var(--ink)' : 'var(--muted)' }}><L en={s.labelEn} ar={s.labelAr} /></span>
                      {s.kind !== 'final' ? <span style={{ fontSize: 12, color: stateLine(s).color }}><L en={stateLine(s).en} ar={stateLine(s).ar} /></span> : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
      <div data-region="step-body" className="step-body" ref={body}>
        {steps.map((s) => (
          <div key={s.key} data-step={s.key} hidden={s.key !== current}>{s.body}</div>
        ))}
        <div data-region="step-actions" className="step-actions">
          {index > 0 ? (
            <button type="button" data-region="step-previous" disabled={saving} onClick={() => { void go(steps[index - 1]!.key); }} style={{ minHeight: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14.5, cursor: 'pointer', color: 'var(--ink)' }}>
              <L en="Previous" ar="السابق" />
            </button>
          ) : <span />}
          {index < total - 1 ? (
            <button type="button" data-region="step-next" disabled={saving} onClick={() => { void go(steps[index + 1]!.key); }} style={{ minHeight: 44, paddingInline: 22, border: 0, background: 'var(--brand)', color: 'var(--bg)', borderRadius: 22, fontSize: 14.5, fontWeight: 500, cursor: 'pointer' }}>
              {saving ? <L en="Saving…" ar="جارٍ الحفظ…" /> : <L en={steps[index + 1]!.kind === 'final' ? finalNext.en : 'Next'} ar={steps[index + 1]!.kind === 'final' ? finalNext.ar : 'التالي'} />}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
