'use client';

/**
 * The post-event medical report form. Aggregate figures (required even at zero), the
 * eight significant-event checkboxes, lessons with a name-screened narrative, and the
 * signature block -- two signatures at Level 3, and the report is not complete with one.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { POST_EVENT_CERTIFICATION_STATEMENT } from '../../../../lib/rules';
import { savePostEventReportAction, signAndSubmitPostEventAction } from '../../../actions';
import type { PostEventReportRow } from '../../../../lib/queries';

interface Field {
  key: string;
  en: string;
  ar: string;
}

export function PostEventForm({
  eventId,
  level,
  activityFields,
  significantEvents,
  initial,
  directorConfirmed,
}: {
  eventId: string;
  level: 1 | 2 | 3;
  activityFields: Field[];
  significantEvents: Field[];
  initial: PostEventReportRow | null;
  directorConfirmed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activity, setActivity] = useState<Record<string, string>>(initial?.activity ?? {});
  const [significant, setSignificant] = useState<Record<string, boolean>>(initial?.significant ?? {});
  const [lessonsNone, setLessonsNone] = useState(initial?.lessonsNone ?? false);
  const [lessonsText, setLessonsText] = useState(initial?.lessonsText ?? '');
  const [message, setMessage] = useState<'saved' | 'personal-name' | 'awaiting-director' | 'submitted' | null>(null);

  const submitted = initial?.submittedAt != null;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await savePostEventReportAction(eventId, {
        activity,
        significant,
        lessonsNone,
        lessonsText,
      });
      if ('ok' in result) {
        setMessage('saved');
        router.refresh();
      } else if (result.error === 'personal-name') {
        setMessage('personal-name');
      }
    });
  };

  const signAndSubmit = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await signAndSubmitPostEventAction(eventId);
      if ('ok' in result) {
        setMessage('submitted');
        router.refresh();
      } else if (result.error === 'awaiting-director') {
        setMessage('awaiting-director');
        router.refresh();
      }
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div data-region="counts" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 18 }}>
          <L en="Counts" ar="الأعداد" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
          {activityFields.map((f) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                <L en={f.en} ar={f.ar} />
              </span>
              <input
                value={activity[f.key] ?? ''}
                disabled={submitted}
                onChange={(e) => setActivity((prev) => ({ ...prev, [f.key]: e.target.value }))}
                style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
              />
            </label>
          ))}
        </div>
      </div>

      <div style={{ padding: 28, border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
          <L en="Significant events" ar="الوقائع المهمة" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          {significantEvents.map((s) => {
            const on = significant[s.key] === true;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                disabled={submitted}
                onClick={() =>
                  setSignificant((prev) => {
                    if (s.key === 'none') return on ? {} : { none: true };
                    const next = { ...prev, [s.key]: !on };
                    delete next['none'];
                    return next;
                  })
                }
                style={{ textAlign: 'start', background: 'var(--bg)', padding: '13px 16px', border: 0, cursor: submitted ? 'default' : 'pointer', display: 'flex', gap: 12, alignItems: 'center', fontSize: '14.5px' }}
              >
                <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', borderRadius: 3 }} />
                <L en={s.en} ar={s.ar} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 28, border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
          <L en="Lessons and corrective actions" ar="الدروس والإجراءات التصحيحية" />
        </div>
        <button
          type="button"
          aria-pressed={lessonsNone}
          disabled={submitted}
          onClick={() => setLessonsNone((v) => !v)}
          style={{ textAlign: 'start', display: 'flex', gap: 12, alignItems: 'center', padding: '13px 16px', border: `1px solid ${lessonsNone ? 'var(--brand)' : 'var(--line)'}`, background: lessonsNone ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 8, cursor: submitted ? 'default' : 'pointer', fontSize: '14.5px', width: '100%', marginBlockEnd: 12 }}
        >
          <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${lessonsNone ? 'var(--brand)' : 'var(--muted)'}`, background: lessonsNone ? 'var(--brand)' : 'transparent', borderRadius: 3 }} />
          <L en="No significant issues identified." ar="لم تُحدّد أي مشكلات مهمة." />
        </button>
        {!lessonsNone ? (
          <>
            <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Issues or corrective actions identified:" ar="حُدّدت مشكلات أو إجراءات تصحيحية، وهي:" />
            </div>
            <textarea
              rows={4}
              value={lessonsText}
              disabled={submitted}
              onChange={(e) => setLessonsText(e.target.value)}
              style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.65, resize: 'vertical' }}
            />
            <p style={{ margin: '10px 0 0', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
              <L
                en="The report carries aggregate event data. Do not name a patient or any person — submission is blocked when a personal name is detected."
                ar="يحمل التقرير بيانات إجمالية للفعالية. لا تذكروا اسم مريض أو أي شخص — يُحجب التقديم عند رصد اسم شخصي."
              />
            </p>
          </>
        ) : null}
      </div>

      {/* Signatures: the organizer's here; the Director's own signature arrives on their
          surface. At Level 3 the report is not complete with one. */}
      <div style={{ padding: 28, border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 16 }}>
          <L en="Signatures" ar="التواقيع" />
        </div>
        {POST_EVENT_CERTIFICATION_STATEMENT ? (
          <div data-region="certification-statement" style={{ padding: '14px 18px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
            <L en={POST_EVENT_CERTIFICATION_STATEMENT.en} ar={POST_EVENT_CERTIFICATION_STATEMENT.ar} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg)', borderRadius: 8, fontSize: '14.5px' }}>
            <span>
              <L en="Organizer representative" ar="ممثل المنظم" />
            </span>
            {initial?.organizerSignedAt ? (
              <span style={{ padding: '4px 10px', borderRadius: 4, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
                <L en={`Signed ${initial.organizerSignedAt.slice(0, 10)}`} ar={`وُقّع في ⁦${initial.organizerSignedAt.slice(0, 10)}⁩`} />
              </span>
            ) : (
              <span style={{ padding: '4px 10px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 13 }}>
                <L en="Signature owed" ar="التوقيع مستحق" />
              </span>
            )}
          </div>
          {level === 3 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg)', borderRadius: 8, fontSize: '14.5px' }}>
              <span>
                <L en="Event Medical Director (Level 3)" ar="المدير الطبي للفعالية (المستوى الثالث)" />
              </span>
              {initial?.directorSignedAt ? (
                <span style={{ padding: '4px 10px', borderRadius: 4, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
                  <L en={`Signed ${initial.directorSignedAt.slice(0, 10)}`} ar={`وُقّع في ⁦${initial.directorSignedAt.slice(0, 10)}⁩`} />
                </span>
              ) : (
                <span style={{ padding: '4px 10px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 13 }}>
                  {directorConfirmed ? (
                    <L en="Awaiting the Director's signature on their own surface" ar="بانتظار توقيع المدير على واجهته الخاصة" />
                  ) : (
                    <L en="No confirmed Event Medical Director on this event" ar="لا مدير طبي مؤكَّد لهذه الفعالية" />
                  )}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {message === 'personal-name' ? (
        <div style={{ padding: '16px 20px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.6 }}>
          <L
            en="A personal name appears to be present in the corrective-actions text. Remove it — the report carries aggregate data and never identifies a patient or a person."
            ar="يبدو أن اسماً شخصياً ورد في نص الإجراءات التصحيحية. احذفوه — يحمل التقرير بيانات إجمالية ولا يحدد هوية مريض أو شخص أبداً."
          />
        </div>
      ) : null}
      {message === 'awaiting-director' ? (
        <div style={{ padding: '16px 20px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.6 }}>
          <L
            en="Your signature is recorded. At Level 3 the report carries two signatures and is not complete with one — it is submitted when the Event Medical Director signs."
            ar="سُجّل توقيعكم. في المستوى 3 يحمل التقرير توقيعين ولا يكتمل بواحد — يُقدَّم عندما يوقّع المدير الطبي للفعالية."
          />
        </div>
      ) : null}
      {message === 'submitted' || submitted ? (
        <div style={{ padding: '16px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 16, fontSize: '14.5px', lineHeight: 1.6 }}>
          <L en="The report has been submitted to the Ministry." ar="قُدِّم التقرير إلى الوزارة." />
        </div>
      ) : null}

      {!submitted ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
          >
            <L en="Save the report" ar="حفظ التقرير" />
          </button>
          <button
            type="button"
            disabled={pending || !initial}
            onClick={signAndSubmit}
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: initial ? 'var(--brand)' : 'var(--surface2)', color: initial ? 'var(--bg)' : 'var(--muted)', fontSize: '14.5px', fontWeight: 500, cursor: initial ? 'pointer' : 'not-allowed' }}
          >
            <L en="Sign and submit" ar="التوقيع والتقديم" />
          </button>
          {message === 'saved' ? (
            <span style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
              <L en="Saved." ar="حُفظ." />
            </span>
          ) : null}
          {!initial ? (
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Save the report before signing." ar="احفظوا التقرير قبل التوقيع." />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
