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
import { bandForScore, deriveLevel } from '../../../../lib/rules/derive';
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

  const inputs: MinimumConditionInputs = useMemo(
    () => ({
      expectedMaxSimultaneousAttendance: attendance.trim() === '' ? null : Number(attendance.replace(/[^0-9]/g, '')),
      eventDisciplines: [],
      courseDistanceKm: null,
      venueLicensedCapacity: venueFacts.licensedCapacity,
      venueIsNightclubOrDanceVenue: venueFacts.isNightclub,
      venueRegularlyHostsOrganizedEvents: venueFacts.regularlyHosts,
    }),
    [attendance, venueFacts],
  );
  const derivation = useMemo(
    () => deriveLevel({ answers: answers as DomainAnswers, inputs }),
    [answers, inputs],
  );
  const triggeredKeys = new Set(derivation.triggeredConditions.map((c) => c.key));
  const score = derivation.scoreTotal;
  const markerPct = score === null ? 0 : Math.round((score / maxScore) * 100);

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
      <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
        <L en="Annual venue assessment" ar="التقييم السنوي للموقع" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
        <L en="The same nine domains as the event assessment, assessed once each year." ar="المجالات التسعة نفسها المستخدمة في تقييم الفعاليات، تُقيَّم مرة كل سنة." />
      </p>

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
            <L en="Expected maximum simultaneous attendance during a routine operating session" ar="الحد الأقصى المتوقع للحضور المتزامن خلال فترة تشغيل اعتيادية" />
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

      <div data-region="classification" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="Total score from your answers" ar="المجموع من أجوبتكم" />
        </div>
        <div style={{ position: 'relative', height: 44 }}>
          {score !== null ? (
            <div style={{ position: 'absolute', insetInlineStart: `${markerPct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {score}{' '}
                <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>
                  <L en={`of ${maxScore}`} ar={`من ${maxScore}`} />
                </span>
              </span>
              <span style={{ display: 'block', width: 1, height: 12, background: 'var(--ink)', opacity: 0.5 }} />
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: maxScore + 1 }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 44, borderRadius: 3, background: score !== null && i <= score ? `var(--l${bandForScore(i)})` : 'var(--surface2)' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: bands.map((b) => `${b.maxScore - b.minScore + 1}fr`).join(' '), gap: 3, marginBlockStart: 10, fontSize: '12.5px', color: 'var(--muted)' }}>
          {bands.map((b) => (
            <div key={b.level}>
              <L en={`Level ${b.level}`} ar={`المستوى ${b.level}`} /> · {b.minScore}–{b.maxScore}
            </div>
          ))}
        </div>

        <div style={{ marginBlockStart: 32, paddingBlockStart: 28, borderBlockStart: '1px solid var(--line)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L en="Minimum event level — conditions that cannot be classified lower. Every condition derives from the registration and the figures above." ar="الحد الأدنى لمستوى الفعالية — شروط لا يمكن التصنيف تحتها. كل شرط مستمد من التسجيل والأرقام أعلاه." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conditions.map((condition) => {
              const on = triggeredKeys.has(condition.key);
              return (
                <div key={condition.key} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', border: `1px solid ${on ? (condition.level === 3 ? 'var(--l3)' : 'var(--accent)') : 'var(--line)'}`, background: on ? (condition.level === 3 ? 'var(--l3s)' : 'var(--accent-soft)') : 'var(--bg)', borderRadius: 8 }}>
                  <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${on ? 'var(--ink)' : 'var(--muted)'}`, borderRadius: 3, background: on ? 'var(--ink)' : 'transparent' }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '14.5px', lineHeight: 1.5 }}>
                      <L en={condition.en} ar={condition.ar} />
                    </span>
                    {condition.issue !== 'both' ? (
                      <span style={{ display: 'inline-block', marginBlockStart: 3, padding: '0 6px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        {condition.issue === 'ar-only' ? (
                          <L en="Arabic issue only" ar="الإصدار العربي فقط" />
                        ) : (
                          <L en="English issue only" ar="الإصدار الإنكليزي فقط" />
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: `var(--l${condition.level})` }}>
                    <L en={`Level ${condition.level}`} ar={`المستوى ${condition.level}`} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div data-region="results" style={{ marginBlockStart: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: 'var(--surface)', padding: '20px 22px' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Score-based level" ar="المستوى بحسب النتيجة" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
              {derivation.scoreBandLevel !== null ? (
                <L en={`Level ${derivation.scoreBandLevel}`} ar={`المستوى ${derivation.scoreBandLevel}`} />
              ) : (
                <span style={{ color: 'var(--muted)' }}>—</span>
              )}
            </div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '20px 22px' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Minimum event level" ar="الحد الأدنى لمستوى الفعالية" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
              {derivation.minimumConditionLevel !== null ? (
                <L en={`Level ${derivation.minimumConditionLevel}`} ar={`المستوى ${derivation.minimumConditionLevel}`} />
              ) : (
                <L en="None" ar="لا يوجد" />
              )}
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', padding: '20px 22px' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Final level — the higher of the two" ar="المستوى النهائي — الأعلى من الاثنين" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: derivation.finalLevel ? `var(--l${derivation.finalLevel})` : 'var(--muted)' }}>
              {derivation.finalLevel !== null ? (
                <L en={`Level ${derivation.finalLevel}`} ar={`المستوى ${derivation.finalLevel}`} />
              ) : (
                <L en="Not yet derivable" ar="لا يمكن استنتاجه بعد" />
              )}
            </div>
          </div>
        </div>
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
          <L en="The classification cannot be recorded until every domain is answered and the attendance figure is captured." ar="لا يمكن تسجيل التصنيف قبل الإجابة عن جميع المجالات وإدخال رقم الحضور." />
        </p>
      ) : null}
      <button
        type="button"
        disabled={!derivation.complete || pending}
        onClick={submit}
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: derivation.complete ? 'var(--brand)' : 'var(--surface2)', color: derivation.complete ? 'var(--bg)' : 'var(--muted)', fontSize: '14.5px', fontWeight: 500, cursor: derivation.complete ? 'pointer' : 'not-allowed' }}
      >
        <L en="Record the classification" ar="تسجيل التصنيف" />
      </button>
      {!derivation.complete ? (
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en="The classification is derived once every domain is answered and the attendance figure is captured." ar="يُستنتج التصنيف بعد الإجابة عن جميع المجالات وإدخال رقم الحضور." />
        </p>
      ) : null}
    </div>
  );
}
