'use client';

import { useEffect, useRef, useState } from 'react';
import { L } from '../L';

export interface HandoffStep { n: number; anchor: string; labelEn: string; labelAr: string }

/**
 * After the organizer invites the EMS agency or the Medical Director (owner, 8 October
 * 2026): which steps that party fills, the questions of the step the invitation came from,
 * and a way on to the steps the organizer fills. The organizer cannot fill these steps;
 * the party's answers appear on them once it has accepted.
 */
export function HandoffDialog({ party, steps, questions, skipTo }: {
  party: { en: string; ar: string };
  steps: readonly HandoffStep[];
  questions: readonly { en: string; ar: string }[];
  /** The next step the organizer fills, or null when none is left. */
  skipTo: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => {
    setOpen(false);
    // The invitation's own query leaves the address so a reload does not open this again.
    const url = new URL(window.location.href);
    url.searchParams.delete('invited');
    history.replaceState(null, '', url.toString());
  };
  const skip = () => {
    close();
    if (skipTo) window.dispatchEvent(new CustomEvent('record:jump', { detail: `#${skipTo}` }));
  };
  return (
    <dialog ref={ref} data-region="handoff-dialog" onCancel={close} aria-labelledby="handoff-title"
      style={{ maxInlineSize: 'min(560px, calc(100vw - 32px))', border: '1px solid var(--line)', borderRadius: 14, padding: '22px 24px', background: 'var(--bg)', color: 'var(--ink)' }}>
      <h2 id="handoff-title" style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>
        <L en={`The ${party.en} fills some steps, not you`} ar={`تملأ ${party.ar} بعض الخطوات، لا أنتم`} />
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.6 }}>
        <L en={`Once the ${party.en} accepts your invitation, it answers these steps. You will see its answers on them; you cannot fill them yourself.`} ar={`بعد أن تقبل ${party.ar} دعوتكم، تجيب عن هذه الخطوات. سترون إجاباتها عليها؛ ولا يمكنكم ملؤها بأنفسكم.`} />
      </p>
      <ol data-region="handoff-steps" style={{ margin: '0 0 14px', paddingInlineStart: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '14.5px' }}>
        {steps.map((s) => (
          <li key={s.anchor} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ flex: 'none', minInlineSize: 24, fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{s.n}</span>
            <L en={s.labelEn} ar={s.labelAr} />
          </li>
        ))}
      </ol>
      {questions.length > 0 ? (
        <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 6 }}><L en="On this step it answers:" ar="في هذه الخطوة تجيب عن:" /></div>
          <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '13.5px', lineHeight: 1.5 }}>
            {questions.map((q) => <li key={q.en}><L en={q.en} ar={q.ar} /></li>)}
          </ul>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" data-region="handoff-close" onClick={close} style={{ minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer', color: 'var(--ink)' }}>
          <L en="Close" ar="إغلاق" />
        </button>
        {skipTo ? (
          <button type="button" data-region="handoff-skip" onClick={skip} style={{ minHeight: 44, paddingInline: 20, border: 0, background: 'var(--brand)', color: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
            <L en="Skip to the steps you fill" ar="الانتقال إلى الخطوات التي تملؤونها" />
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
