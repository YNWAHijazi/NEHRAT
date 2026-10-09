'use client';

import { PhoneInput } from '../PhoneInput';
import { UseMyDetails } from '../UseMyDetails';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../L';
import { fileSubmissionAction, saveComplianceAction } from '../../app/actions';
import { missingCertificationFields, type RequirementInstance } from '../../lib/rules';
import type { SubmissionRow } from '../../lib/queries';
import { fieldInput } from '../workspace-styles';
import { SaveDraftButton } from './SaveDraftButton';

export interface ReviewRow { key: string; labelEn: string; labelAr: string; stateEn: string; stateAr: string; anchor: string; complete: boolean }

/**
 * The foot of the record page (brief item 16): the remaining required items with jump
 * links, the optional choices separately, the applicable organizer declaration and
 * Submit. The declaration fields autosave; the server re-validates everything on
 * Submit and a refusal opens the exact incomplete card.
 */
export function FinalReview({ eventId, level, remaining, optional, statements, declarationInst, initial, filed, revisionOpen, expedited, certificationStatement, externalBlockers, fee, headerRows, me = null }: {
  eventId: string;
  /** The signed-in organizer, to prefill an empty declaration and for "Use my details". */
  me?: { name: string; phone: string } | null;
  level: 1 | 2 | 3;
  /** The compliance form's header fields, filled from the record. */
  headerRows: { en: string; ar: string; valueEn: string; valueAr: string }[];
  remaining: ReviewRow[];
  optional: ReviewRow[];
  /** The compliance statements the level applies (none at Level 1 unless requested). */
  statements: { en: string; ar: string }[];
  declarationInst: RequirementInstance;
  initial: SubmissionRow | null;
  filed: boolean;
  revisionOpen: boolean;
  expedited: boolean;
  certificationStatement: { en: string; ar: string } | null;
  /** Blockers that are not requirement rows: a cancelled lifecycle, the fee. */
  externalBlockers: { kind: string; en: string; ar: string }[];
  fee: { amount: string; currency: string; paid: boolean; paidAt: string | null } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, startAutosave] = useTransition();
  const [ticked, setTicked] = useState<Record<string, boolean>>(initial?.declarations ?? {});
  // The signed-in organizer's own name and number until the form holds others (owner, 9 October 2026).
  const [representative, setRepresentative] = useState(initial?.representative || me?.name || '');
  const [telephone, setTelephone] = useState(initial?.telephone || me?.phone || '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const locked = filed && !revisionOpen;

  const missingCert = new Set(missingCertificationFields('organizer', { representative, telephone, position }).map((f) => f.key));
  const declComplete = statements.every((_, i) => ticked[String(i)] === true);
  const certComplete = missingCert.size === 0;
  const outstanding = remaining.filter((r) => r.key !== 'P-C').length + externalBlockers.length + (declComplete ? 0 : 1) + (certComplete ? 0 : 1);
  const canFile = outstanding === 0 && !locked;

  const latest = useRef({ declarations: ticked, insurance: initial?.insurance ?? {}, representative, telephone, position });
  latest.current = { declarations: ticked, insurance: initial?.insurance ?? {}, representative, telephone, position };
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filing = useRef(false);
  const lastSaved = useRef(JSON.stringify(latest.current));
  const persist = () => {
    if (locked || filing.current) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const snapshot = latest.current;
    const key = JSON.stringify(snapshot);
    if (key === lastSaved.current) return;
    startAutosave(async () => {
      const result = await saveComplianceAction(eventId, snapshot);
      if ('ok' in result && !filing.current) { lastSaved.current = key; setSaved(true); router.refresh(); }
    });
  };
  useEffect(() => {
    if (locked) return;
    if (!dirty.current) { dirty.current = true; return; }
    setSaved(false);
    timer.current = setTimeout(persist, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticked, representative, telephone, position]);

  const file = () => {
    setFileError(null);
    filing.current = true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    startTransition(async () => {
      await saveComplianceAction(eventId, latest.current);
      const result = await fileSubmissionAction(eventId);
      if ('reference' in result) router.push(`/events/${eventId}/acknowledgment`);
      else { filing.current = false; setFileError(result.error); router.refresh(); }
    });
  };

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '8px 14px', color: 'var(--ink)', borderBlockEnd: '1px solid var(--line)', textDecoration: 'none' };
  const cardStyle: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', marginBlockEnd: 16 };

  return (
    <section id="final-review" data-region="final-review" tabIndex={-1} style={{ marginBlockStart: 40, scrollMarginBlockStart: 16 }}>
      <h2 style={{ fontSize: 24, margin: '0 0 16px', fontWeight: 600, letterSpacing: '-.025em' }}><L en="Review and submit" ar="المراجعة والتقديم" /></h2>

      {locked ? (
        <div data-region="filed-band" style={{ ...cardStyle, border: '1px solid var(--brand)', background: 'var(--brand-soft)', fontSize: 15, lineHeight: 1.65 }}>
          <L en={`Submitted. The record ID is ${initial?.mophReference ?? eventId}.`} ar={`قُدِّم. معرّف السجل هو ⁦${initial?.mophReference ?? eventId}⁩.`} />{' '}
          <a href={`/events/${eventId}/acknowledgment`} style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}><L en="Open the acknowledgment of receipt" ar="فتح إشعار الاستلام" /></a>
        </div>
      ) : (
        <>
          {revisionOpen ? (
            <div style={{ ...cardStyle, border: '1px solid var(--accent)', background: 'var(--accent-soft)', fontSize: '14.5px', lineHeight: 1.65 }}>
              <L en={`The Ministry's determination asks for more. The record is open for revision; re-filing archives version ${initial?.version ?? 1} and the record ID does not change.`} ar={`نتيجة الوزارة تطلب المزيد. السجل مفتوح للتعديل؛ وإعادة التقديم تؤرشف النسخة ${initial?.version ?? 1} ولا يتغير معرّف السجل.`} />
            </div>
          ) : null}
          {expedited ? (
            <div style={{ ...cardStyle, border: '1px solid var(--accent)', background: 'var(--accent-soft)', fontSize: '14.5px', lineHeight: 1.65 }}>
              <L en="The deadline has passed. You can still submit for urgent review. All requirements still apply." ar="انتهت مهلة التقديم. يمكنكم تقديم الطلب للمراجعة العاجلة. تبقى جميع المتطلبات واجبة." />
            </div>
          ) : null}

          {/* With nothing left the card goes: no sentence saying so (owner, 8 October 2026). */}
          <div data-region="remaining" hidden={outstanding === 0} style={cardStyle}>
            <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>
              <L en={outstanding === 1 ? '1 item remaining' : `${outstanding} items remaining`} ar={`${outstanding} متبقٍ`} />
            </h3>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {remaining.filter((r) => r.key !== 'P-C').map((r) => (
                <a key={r.key} href={`#${r.anchor}`} data-remaining={r.key} style={{ ...rowStyle, borderInlineStart: '3px solid var(--accent)' }}>
                  <span style={{ fontSize: '14.5px' }}><L en={r.labelEn} ar={r.labelAr} /></span>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}><L en={r.stateEn} ar={r.stateAr} /></span>
                </a>
              ))}
              {externalBlockers.map((b) => (
                <div key={b.kind} data-remaining={b.kind} style={{ ...rowStyle, borderInlineStart: '3px solid var(--accent)' }}>
                  <span style={{ fontSize: '14.5px' }}><L en={b.en} ar={b.ar} /></span>
                </div>
              ))}
              {!declComplete || !certComplete ? (
                <a href="#organizer-declaration" data-remaining="P-C" style={{ ...rowStyle, borderInlineStart: '3px solid var(--accent)' }}>
                  <span style={{ fontSize: '14.5px' }}><L en={declarationInst.labelEn} ar={declarationInst.labelAr} /></span>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}><L en="Pending" ar="قيد الإنجاز" /></span>
                </a>
              ) : null}
            </div>
            {optional.length > 0 ? (
              <details style={{ marginBlockStart: 12, fontSize: '13.5px', color: 'var(--muted)' }}>
                <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}><L en="Optional choices not added" ar="الخيارات الاختيارية غير المضافة" /></summary>
                <div style={{ marginBlockStart: 6 }}>
                  {optional.map((r) => (
                    <a key={r.key} href={`#${r.anchor}`} data-optional={r.key} style={{ ...rowStyle, minHeight: 36, color: 'var(--muted)' }}>
                      <span><L en={r.labelEn} ar={r.labelAr} /></span><span><L en={r.stateEn} ar={r.stateAr} /></span>
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </>
      )}

      <div id="organizer-declaration" data-region="organizer-declaration" tabIndex={-1} style={{ ...cardStyle, scrollMarginBlockStart: 16 }}>
        <details data-region="submission-details" style={{ marginBlockEnd: 16 }}>
          <summary style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', fontSize: '14.5px', color: 'var(--muted)' }}><L en="Submission details" ar="تفاصيل التقديم" /></summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockStart: 8 }}>
            {headerRows.map((h) => (
              <div key={h.en} style={{ background: 'var(--bg)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '13.5px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--muted)' }}><L en={h.en} ar={h.ar} /></span>
                <span style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}><L en={h.valueEn} ar={h.valueAr} /></span>
              </div>
            ))}
          </div>
        </details>
        <h3 style={{ fontSize: 16, margin: '0 0 6px' }}><L en={declarationInst.labelEn} ar={declarationInst.labelAr} /></h3>
        <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.55 }}><L en={declarationInst.promptEn} ar={declarationInst.promptAr} /></p>
        {statements.length > 0 ? (
          <div data-region="compliance-statements" style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 18 }}>
            {statements.map((d, i) => {
              const on = ticked[String(i)] === true;
              return (
                <label key={d.en} style={{ display: 'flex', gap: 14, alignItems: 'start', padding: '12px 14px', borderBlockEnd: '1px solid var(--line)', fontSize: '14.5px', cursor: locked ? 'default' : 'pointer', minHeight: 44 }}>
                  <input type="checkbox" checked={on} disabled={locked} onChange={() => setTicked((prev) => ({ ...prev, [String(i)]: !on }))} style={{ flex: 'none', width: 20, height: 20, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
                  <span style={{ flex: 1, lineHeight: 1.5 }}><L en={d.en} ar={d.ar} /></span>
                  <span style={{ flex: 'none', fontSize: 13, color: on ? 'var(--success)' : 'var(--muted)' }}>{on ? <L en="Declared" ar="مُقَرّ به" /> : <L en="Not declared" ar="غير مُقَرّ به" />}</span>
                </label>
              );
            })}
          </div>
        ) : null}
        {certificationStatement ? (
          <div data-region="certification-statement" style={{ paddingBlock: 13, paddingInlineStart: 16, paddingInlineEnd: 16, background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
            <L en={certificationStatement.en} ar={certificationStatement.ar} />
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
          {([['representative', representative, setRepresentative, 'Authorized representative', 'الممثل المفوّض'], ['position', position, setPosition, 'Position', 'الصفة'], ['telephone', telephone, setTelephone, 'Telephone', 'الهاتف']] as const).map(([key, value, set, en, ar]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onBlur={() => { if (!locked) persist(); }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en={en} ar={ar} /></span>
              {key === 'telephone' ? (
                <PhoneInput name={key} value={value} disabled={locked} required invalid={!locked && missingCert.has(key) && dirty.current} onChange={set} />
              ) : (
                <input name={key} value={value} disabled={locked} required aria-invalid={!locked && missingCert.has(key) && dirty.current ? true : undefined}
                  onChange={(e) => set(e.target.value)}
                  style={{ ...fieldInput, ...(!locked && missingCert.has(key) && dirty.current ? { border: '1px solid var(--bad)' } : {}) }} />
              )}
            </label>
          ))}
        </div>
        {!locked && me && (me.name || me.phone) && (representative !== me.name || telephone !== me.phone) ? (
          <div style={{ marginBlockStart: 6 }}><UseMyDetails onUse={() => { if (me.name) setRepresentative(me.name); if (me.phone) setTelephone(me.phone); }} /></div>
        ) : null}
        {!locked ? (
          <div aria-live="polite" style={{ marginBlockStart: 10, minHeight: 20 }}>
            {saved ? <span data-region="autosaved" style={{ fontSize: '13.5px', color: 'var(--success)' }}><L en="Saved." ar="حُفظ." /></span> : null}
          </div>
        ) : null}
      </div>

      {fee ? (
        <div id="amount-due" data-region="amount-due" style={{ ...cardStyle, border: `1px solid ${fee.paid ? 'var(--line)' : 'var(--accent-ink)'}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}><L en="Application fee" ar="رسم الطلب" /></span>
            <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
              {fee.paid ? <L en={`Paid — ${fee.paidAt ?? ''}`} ar={`مسدَّد — ⁦${fee.paidAt ?? ''}⁩`} /> : <L en={`Amount due: ${fee.amount} ${fee.currency}`} ar={`المبلغ المستحق: ${fee.amount} ${fee.currency}`} />}
            </span>
          </div>
          {!fee.paid ? (
            <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '80ch' }}>
              <L en="No payment channel is configured on the platform yet. The Ministry announces how the fee is paid; the record is updated when payment is received." ar="لا قناة سداد مهيّأة على المنصة بعد. تعلن الوزارة كيفية سداد الرسم؛ ويُحدَّث السجل عند استلام السداد." />
            </p>
          ) : null}
        </div>
      ) : null}

      {!locked ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <button type="button" data-region="submit-button" disabled={!canFile || pending} onClick={file}
            style={{ minHeight: 48, paddingInline: 26, border: 0, borderRadius: 24, background: canFile ? 'var(--brand)' : 'var(--surface2)', color: canFile ? 'var(--bg)' : 'var(--muted)', fontSize: 15, fontWeight: 500, cursor: canFile ? 'pointer' : 'not-allowed' }}>
            {revisionOpen
              ? outstanding > 0 ? <L en={`Submit the revised record — ${outstanding} remaining`} ar={`تقديم السجل المعدَّل — ${outstanding} متبقٍ`} /> : <L en="Submit the revised record" ar="تقديم السجل المعدَّل" />
              : outstanding > 0 ? <L en={`Submit — ${outstanding} remaining`} ar={`تقديم — ${outstanding} متبقٍ`} /> : <L en="Submit" ar="تقديم" />}
          </button>
          <SaveDraftButton />
          {fileError ? (
            <span role="alert" style={{ fontSize: '13.5px', color: 'var(--bad)' }}>
              {fileError === 'blocked' ? <L en="The server found a requirement still incomplete. The list above names it." ar="وجد الخادم متطلباً لم يكتمل. القائمة أعلاه تسمّيه." /> : <L en="The record could not be submitted." ar="تعذّر تقديم السجل." />}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
