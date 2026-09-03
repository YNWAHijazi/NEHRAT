'use client';

/**
 * The annual venue assessment: the same nine domains as the event assessment, over one
 * routine operating session. The classification is derived, never chosen; both results
 * and which governed are reported; conditions carry their issue tags where the two
 * issues of the regulation disagree (the recurring-venue floor is Arabic-issue only).
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { saveVenueAssessmentAction } from '../../../actions';
import type { Band, Domain, MinimumCondition } from '../../../../lib/rules/load';
import { PART_F } from '../../../../lib/rules/load';
import { deriveLevel } from '../../../../lib/rules/derive';
import { levelWhy } from '../../../../lib/rules/why';
import type { DomainAnswers, MinimumConditionInputs } from '../../../../lib/rules/types';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export function VenueAssessmentForm({
  venueId,
  venueNameEn,
  venueNameAr,
  domains,
  conditions,
  bands,
  maxScore,
  venueFacts,
  initialAnswers,
  initialAttendance,
  feeDue,
  effectivePreview,
  validPreview,
  triggers,
}: {
  venueId: string;
  venueNameEn: string;
  venueNameAr: string;
  domains: Domain[];
  conditions: MinimumCondition[];
  bands: Band[];
  maxScore: number;
  venueFacts: { licensedCapacity: number | null; regularlyHosts: boolean; isNightclub: boolean };
  initialAnswers: (0 | 1 | 2 | null)[] | null;
  initialAttendance: number | null;
  /** The registration fee still owed, or null while none is in force or it is paid. */
  feeDue: { amount: string; currency: string } | null;
  effectivePreview: string;
  validPreview: string;
  triggers: { en: string; ar: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<(0 | 1 | 2 | null)[]>(initialAnswers ?? Array(9).fill(null));
  const [attendance, setAttendance] = useState(initialAttendance === null ? '' : String(initialAttendance));
  const [representative, setRepresentative] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState(false);
  const declarationComplete = representative.trim() !== '' && position.trim() !== '';

  const inputs: MinimumConditionInputs = useMemo(
    () => ({
      expectedMaxSimultaneousAttendance: attendance.trim() === '' ? null : Number(attendance.replace(/[^0-9]/g, '')),
      eventDisciplines: [],
      courseDistanceKm: null,
      venueLicensedCapacity: venueFacts.licensedCapacity,
      venueIsNightclubOrDanceVenue: venueFacts.isNightclub,
    }),
    [attendance, venueFacts],
  );
  const derivation = useMemo(
    () => deriveLevel({ answers: answers as DomainAnswers, inputs }),
    [answers, inputs],
  );
  const why = levelWhy(derivation);
  const unansweredDomains = domains.filter((_, i) => answers[i] === null);

  const submit = () => {
    setError(false);
    startTransition(async () => {
      const result = await saveVenueAssessmentAction(venueId, {
        answers: answers as DomainAnswers,
        attendance: inputs.expectedMaxSimultaneousAttendance,
        representative,
        position,
      });
      if ('level' in result) router.push(`/venues/${venueId}`);
      else setError(true);
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
        <L en={`${venueNameEn} · routine operations`} ar={`${venueNameAr} · التشغيل الاعتيادي`} />
      </div>
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
        <L en="Annual venue assessment" ar="التقييم السنوي للموقع" />
      </h1>
      {/* The cross-reference to the event assessment left this screen (partner
          ruling, second sweep): a venue operator has no event assessment to
          compare with, and the callout below says what to assess. */}

      <div data-region="session-callout" style={{ padding: '26px 30px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 44 }}>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 12 }}>
          <L
            en="Assess one routine operating session — not a specific event, and not the venue's busiest day."
            ar="قيّموا فترة تشغيل اعتيادية واحدة — لا فعالية بعينها ولا أكثر أيام الموقع ازدحاماً."
          />
        </div>
        <div style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
          <div>
            <L en="Domain 4, event duration — the length of one routine operating session." ar="المجال 4، مدة الفعالية — طول فترة تشغيل اعتيادية واحدة." />
          </div>
          <div>
            <L en="Domain 9, previous event history — the venue's history across its routine operations, not one event's previous edition." ar="المجال 9، سجل النسخ السابقة — سجل الموقع عبر تشغيله الاعتيادي، لا النسخة السابقة لفعالية واحدة." />
          </div>
        </div>
      </div>

      <div style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 44 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 380 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="Most people at the same time during a routine operating session" ar="أكبر عدد من الحاضرين في الوقت نفسه خلال فترة تشغيل اعتيادية" />
          </span>
          <input
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBlockEnd: 56 }}>
        {domains.map((domain, di) => (
          <div key={domain.number} style={{ padding: 27, background: 'var(--surface2)', borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBlockEnd: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{domain.number}</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
                <L en={domain.en} ar={domain.ar} />
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {domain.options.map((option) => {
                const on = answers[di] === option.score;
                return (
                  <button
                    key={option.score}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAnswers((prev) => prev.map((a, i) => (i === di ? option.score : a)))}
                    style={{ textAlign: 'start', display: 'flex', gap: 16, padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}
                  >
                    <span style={{ flex: 'none', width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: '50%', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
                      {option.score}
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.55 }}>
                      <L en={option.en} ar={option.ar} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* The result the way the event form gives it (partner ruling, second sweep):
          the classification and one line why. The score bar, the band legend and the
          condition checklist left the operator's screen -- the engine still derives
          every condition, and the full detail stays on the Ministry side. */}
      <div data-region="classification" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="Your venue's classification" ar="تصنيف موقعكم" />
        </div>
        {derivation.finalLevel !== null ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-.025em', color: `var(--l${derivation.finalLevel})` }}>
              <L en={`Level ${derivation.finalLevel}`} ar={`المستوى ${derivation.finalLevel}`} />
            </div>
            {why.reason ? (
              <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, maxWidth: '60ch' }}>
                <L en={why.reason.en} ar={why.reason.ar} />
              </p>
            ) : null}
            {why.comparison ? (
              <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <L en={why.comparison.en} ar={why.comparison.ar} />
              </p>
            ) : null}
          </>
        ) : (
          <div style={{ fontSize: 16, lineHeight: 1.6 }}>
            <L en="Please answer:" ar="يرجى الإجابة على:" />
            <span style={{ display: 'block', marginBlockStart: 4, color: 'var(--accent-ink)' }}>
              {unansweredDomains.map((d, i) => (
                <span key={d.number} style={{ display: 'inline' }}>
                  {i > 0 ? ' · ' : ''}
                  <L en={d.en} ar={d.ar} />
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      <div data-region="validity" style={{ padding: 32, border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBlockEnd: 26 }}>
          <div>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
              <L en="Effective from" ar="ساري اعتباراً من" />
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{effectivePreview}</div>
          </div>
          <div>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
              <L en="Valid through" ar="صالح حتى" />
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{validPreview}</div>
          </div>
        </div>
        <div style={{ fontSize: '14.5px', color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="A new assessment is required before that date if any of these change" ar="يلزم تقييم جديد قبل ذلك التاريخ إذا تغيّر أي مما يلي" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {triggers.map((t) => (
            <div key={t.en} style={{ display: 'flex', gap: 12, fontSize: 16, lineHeight: 1.5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand)', marginBlockStart: 9, flex: 'none' }} />
              <span>
                <L en={t.en} ar={t.ar} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div data-region="declaration" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Operator declaration" ar="إقرار الجهة المشغّلة" />
        </div>
        {/* THE ASSESSMENT TOOL'S PART F's statement, verbatim from each issue -- the same
            instrument certifies a venue's routine-operations assessment. The
            fields below are required to record; the signature line stays with
            open decision #9. */}
        <p data-region="part-f-statement" style={{ margin: '0 0 16px', fontSize: '14.5px', lineHeight: 1.65, maxWidth: '74ch' }}>
          <L en={PART_F.statementEn} ar={PART_F.statementAr} />
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Authorized representative" ar="الممثل المفوّض" />
            </span>
            <input value={representative} onChange={(e) => setRepresentative(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="Position" ar="الصفة" />
            </span>
            <input value={position} onChange={(e) => setPosition(e.target.value)} style={inputStyle} />
          </label>
        </div>
      </div>

      {error ? (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--bad)' }}>
          <L en="Answer every domain and the attendance figure before recording the classification." ar="أجيبوا عن جميع المجالات وأدخلوا رقم الحضور قبل تسجيل التصنيف." />
        </p>
      ) : null}
      {/* THE REGISTRATION FEE, named before the control it holds. Absent while
          no fee is in force -- the shipped state. */}
      {feeDue ? (
        <div data-region="amount-due" style={{ padding: '15px 19px', border: '1px solid var(--accent-ink)', borderRadius: 10, marginBlockEnd: 14, maxWidth: '74ch' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
              <L en="Registration fee" ar="رسم التسجيل" />
            </span>
            <span style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>
              <L en={`Amount due: ${feeDue.amount} ${feeDue.currency}`} ar={`المبلغ المستحق: ${feeDue.amount} ${feeDue.currency}`} />
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65 }}>
            <L
              en="The classification is recorded when the payment is. No payment channel is configured on the platform yet; the Ministry announces how the fee is paid, and the record is updated when payment is received."
              ar="يُسجَّل التصنيف عند تسجيل السداد. لا قناة سداد مهيّأة على المنصة بعد؛ تعلن الوزارة كيفية سداد الرسم، ويُحدَّث السجل عند استلام السداد."
            />
          </p>
        </div>
      ) : null}
      <button
        type="button"
        disabled={!derivation.complete || !declarationComplete || pending || feeDue !== null}
        onClick={submit}
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: derivation.complete && !feeDue ? 'var(--brand)' : 'var(--surface2)', color: derivation.complete && !feeDue ? 'var(--bg)' : 'var(--muted)', fontSize: '14.5px', fontWeight: 500, cursor: derivation.complete && !feeDue ? 'pointer' : 'not-allowed' }}
      >
        <L en="Record the classification" ar="تسجيل التصنيف" />
      </button>
      {feeDue ? (
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
          <L en={`Registration fee — awaiting payment: ${feeDue.amount} ${feeDue.currency}`} ar={`رسم التسجيل — بانتظار السداد: ${feeDue.amount} ${feeDue.currency}`} />
        </p>
      ) : !derivation.complete ? (
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en="Answer every domain and the attendance figure first." ar="أجيبوا عن جميع المجالات وأدخلوا رقم الحضور أولاً." />
        </p>
      ) : !declarationComplete ? (
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
          <L en="Complete the declaration to record: authorized representative and position." ar="أكملوا الإقرار للتسجيل: الممثل المفوض والصفة." />
        </p>
      ) : null}
    </div>
  );
}
