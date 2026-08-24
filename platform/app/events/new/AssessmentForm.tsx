'use client';

/**
 * Applicability and assessment.
 *
 * The prototype's ten minimum conditions included seven manual checkboxes. Here NONE are
 * manual (non-negotiable #0): every condition derives from captured values -- attendance
 * as a number, disciplines as a structured list, course distance as a required field on
 * running events, venue facts. The conditions render read-only, marked as derived.
 *
 * The level is output, never input. This form owns no level control, and the result
 * panel reports both results and which governed. An unset required input produces an
 * incomplete result naming the field -- never a level.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { createEventAction } from '../../actions';
import type { ArabicOnlyNote, Band, Domain, MinimumCondition } from '../../../lib/rules/load';
import { deriveLevel, bandForScore } from '../../../lib/rules/derive';
import type { DomainAnswers, MinimumConditionInputs } from '../../../lib/rules/types';

const DISCIPLINES: { key: string; en: string; ar: string }[] = [
  { key: 'running', en: 'Organized running event', ar: 'فعالية جري منظمة' },
  { key: 'cycling', en: 'Cycling race', ar: 'سباق دراجات' },
  { key: 'triathlon', en: 'Triathlon', ar: 'ترياتلون' },
  { key: 'open_water_swimming', en: 'Organized open-water swimming event', ar: 'فعالية سباحة منظمة في المياه المفتوحة' },
  { key: 'boxing', en: 'Boxing', ar: 'ملاكمة' },
  { key: 'kickboxing', en: 'Kickboxing', ar: 'كيك بوكسينغ' },
  { key: 'muay_thai', en: 'Muay Thai', ar: 'مواي تاي' },
  { key: 'mixed_martial_arts', en: 'Mixed martial arts', ar: 'فنون قتالية مختلطة' },
  { key: 'motor_racing', en: 'Competitive motor-vehicle racing', ar: 'سباق سيارات تنافسي' },
];

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
  width: '100%',
};

const fieldLabel: React.CSSProperties = { fontSize: '13.5px', color: 'var(--muted)' };

function SectionHeading({ en, ar, noteEn, noteAr }: { en: string; ar: string; noteEn?: string; noteAr?: string }) {
  return (
    <>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en={en} ar={ar} />
      </h2>
      {noteEn && noteAr ? (
        <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en={noteEn} ar={noteAr} />
        </p>
      ) : null}
    </>
  );
}

/** A source-tagged note: wording one issue of the regulation carries and the other lacks. */
function SourceNote({ note }: { note: ArabicOnlyNote }) {
  return (
    <p style={{ margin: '10px 0 0', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
      <span style={{ display: 'inline-block', padding: '1px 7px', marginInlineEnd: 7, border: '1px solid var(--line)', borderRadius: 3, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        <L en="Arabic issue" ar="الإصدار العربي" />
      </span>
      <L en={note.en} ar={note.ar} />
    </p>
  );
}

export function AssessmentForm({
  domains,
  conditions,
  bands,
  maxScore,
  arabicOnlyNotes,
}: {
  domains: Domain[];
  conditions: MinimumCondition[];
  bands: Band[];
  maxScore: number;
  arabicOnlyNotes: ArabicOnlyNote[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partA, setPartA] = useState({
    eventType: '', venueRoute: '', municipalities: '',
    openingTime: '', closingTime: '',
    expectedParticipants: '', expectedSpectators: '', expectedStaff: '',
    previousEdition: false, recurringFixedVenue: false,
  });
  const setA = (k: keyof typeof partA, v: string | boolean) =>
    setPartA((prev) => ({ ...prev, [k]: v }));
  const [answers, setAnswers] = useState<(0 | 1 | 2 | null)[]>(Array(9).fill(null));
  const [attendance, setAttendance] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [courseKm, setCourseKm] = useState('');
  const [capacity, setCapacity] = useState('');
  const [nightclub, setNightclub] = useState(false);
  const [regularVenue, setRegularVenue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs: MinimumConditionInputs = useMemo(
    () => ({
      expectedMaxSimultaneousAttendance: attendance.trim() === '' ? null : Number(attendance),
      eventDisciplines: disciplines,
      courseDistanceKm: courseKm.trim() === '' ? null : Number(courseKm),
      venueLicensedCapacity: capacity.trim() === '' ? null : Number(capacity),
      venueIsNightclubOrDanceVenue: nightclub,
      venueRegularlyHostsOrganizedEvents: regularVenue,
    }),
    [attendance, disciplines, courseKm, capacity, nightclub, regularVenue],
  );

  const derivation = useMemo(
    () => deriveLevel({ answers: answers as DomainAnswers, inputs }),
    [answers, inputs],
  );

  const isRunning = disciplines.includes('running');
  const triggeredKeys = new Set(derivation.triggeredConditions.map((c) => c.key));
  const score = derivation.scoreTotal;
  const markerPct = score === null ? 0 : Math.round((score / maxScore) * 100);

  const missingLabels: { en: string; ar: string }[] = derivation.missingInputs.map((k) => {
    if (k === 'expectedMaxSimultaneousAttendance')
      return { en: 'Expected maximum simultaneous attendance', ar: 'الحد الأقصى المتوقع للحضور المتزامن' };
    if (k === 'courseDistanceKm') return { en: 'Course distance', ar: 'مسافة المسار' };
    if (k.startsWith('domain')) {
      const n = k.slice(6);
      return { en: `Domain ${n}`, ar: `المجال ${n}` };
    }
    return { en: k, ar: k };
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createEventAction({
        nameEn,
        nameAr,
        startDate,
        endDate,
        partA: {
          ...partA,
          expectedParticipants: partA.expectedParticipants === '' ? null : Number(partA.expectedParticipants),
          expectedSpectators: partA.expectedSpectators === '' ? null : Number(partA.expectedSpectators),
          expectedStaff: partA.expectedStaff === '' ? null : Number(partA.expectedStaff),
        },
        answers: answers as DomainAnswers,
        inputs,
      });
      if ('error' in result) setError(result.error);
      else router.push(`/events/${result.eventId}`);
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
        <L en="Applicability and assessment" ar="الانطباق والتقييم" />
      </h1>
      <p style={{ margin: '0 0 48px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '70ch' }}>
        <L
          en="The national risk assessment, in the order the tool sets. Complete it in one pass or return to it. Nothing is filed from this page."
          ar="التقييم الوطني للمخاطر، بترتيبه الأصلي. أكملوه بمرة واحدة أو عودوا إليه. لا يُقدَّم شيء من هذه الصفحة."
        />
      </p>

      <SectionHeading en="Part 1 — The event" ar="الجزء 1 — الفعالية" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 40 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="Event name (English)" ar="اسم الفعالية (بالإنكليزية)" />
          </span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="Event name (Arabic)" ar="اسم الفعالية (بالعربية)" />
          </span>
          <input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="Start date" ar="تاريخ البداية" />
          </span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="End date" ar="تاريخ النهاية" />
          </span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
        </label>
        {(
          [
            ['eventType', 'Event type', 'نوع الفعالية أو نمط التشغيل الاعتيادي'],
            ['venueRoute', 'Venue, route, or location', 'الموقع أو المسار أو مكان الانعقاد'],
            ['municipalities', 'Municipality or municipalities', 'البلدية أو البلديات'],
            ['openingTime', 'Opening time', 'وقت الافتتاح'],
            ['closingTime', 'Closing time', 'وقت الإغلاق'],
            ['expectedParticipants', 'Expected participants', 'العدد المتوقع للمشاركين'],
            ['expectedSpectators', 'Expected spectators or attendees', 'العدد المتوقع للمتفرجين أو الحضور'],
            ['expectedStaff', 'Expected staff, performers, contractors, and volunteers', 'العدد المتوقع للعاملين والفنانين والمتعاقدين والمتطوعين'],
          ] as const
        ).map(([key, en, ar]) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>
              <L en={en} ar={ar} />
            </span>
            <input
              type={key.startsWith('expected') ? 'number' : key.endsWith('Time') ? 'time' : 'text'}
              value={String(partA[key])}
              onChange={(e) => setA(key, e.target.value)}
              style={inputStyle}
            />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 40 }}>
        {(
          [
            ['previousEdition', 'A previous edition of the same event has been held', 'سبق إقامة الفعالية نفسها'],
            ['recurringFixedVenue', 'The venue is fixed and hosts events repeatedly', 'الموقع ثابت ويستضيف فعاليات بصورة متكررة'],
          ] as const
        ).map(([key, en, ar]) => {
          const on = partA[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setA(key, !on)}
              style={{ textAlign: 'start', display: 'flex', gap: 14, padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}
            >
              <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, borderRadius: 3, background: on ? 'var(--brand)' : 'transparent', marginBlockStart: 2 }} />
              <span style={{ fontSize: 15, lineHeight: 1.6 }}>
                <L en={en} ar={ar} />
              </span>
            </button>
          );
        })}
      </div>

      <SectionHeading
        en="Part 2 — Figures the classification depends on"
        ar="الجزء 2 — الأرقام التي يعتمد عليها التصنيف"
        noteEn="These are captured as values, not inferred from an answer. The minimum event level resolves from them."
        noteAr="تُسجَّل هذه كقيم ولا تُستنتج من إجابة. ومنها يتحدد الحد الأدنى لمستوى الفعالية."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 24 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="Expected maximum simultaneous attendance" ar="الحد الأقصى المتوقع للحضور المتزامن" />
          </span>
          <input type="number" min={0} value={attendance} onChange={(e) => setAttendance(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>
            <L en="Venue licensed capacity, where licensed" ar="السعة المرخّصة للموقع، حيث يوجد ترخيص" />
          </span>
          <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 24 }}>
        {[
          {
            on: nightclub,
            toggle: () => setNightclub((v) => !v),
            en: 'The venue is a nightclub or dance venue',
            ar: 'الموقع ملهى ليلي أو مكان للرقص',
          },
          {
            on: regularVenue,
            toggle: () => setRegularVenue((v) => !v),
            en: 'The venue regularly hosts organized events',
            ar: 'يستضيف الموقع فعاليات منظمة بانتظام',
          },
        ].map((c) => (
          <button
            key={c.en}
            type="button"
            onClick={c.toggle}
            aria-pressed={c.on}
            style={{ textAlign: 'start', display: 'flex', gap: 14, padding: '14px 18px', border: `1px solid ${c.on ? 'var(--brand)' : 'var(--line)'}`, background: c.on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}
          >
            <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${c.on ? 'var(--brand)' : 'var(--muted)'}`, borderRadius: 3, background: c.on ? 'var(--brand)' : 'transparent', marginBlockStart: 2 }} />
            <span style={{ fontSize: 15, lineHeight: 1.6 }}>
              <L en={c.en} ar={c.ar} />
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginBlockEnd: 16 }}>
        <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
          <L en="Disciplines the event includes, where it is a sporting event" ar="الرياضات التي تشملها الفعالية، حيث تكون فعالية رياضية" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DISCIPLINES.map((d) => {
            const on = disciplines.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setDisciplines((prev) => (on ? prev.filter((k) => k !== d.key) : [...prev, d.key]))
                }
                style={{ height: 38, paddingInline: 15, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 19, fontSize: 14, cursor: 'pointer' }}
              >
                <L en={d.en} ar={d.ar} />
              </button>
            );
          })}
        </div>
      </div>
      {isRunning ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320, marginBlockEnd: 16 }}>
          <span style={fieldLabel}>
            <L en="Course distance, km — required for a running event" ar="مسافة المسار بالكيلومترات — مطلوبة لفعالية الجري" />
          </span>
          <input type="number" min={0} step="0.1" value={courseKm} onChange={(e) => setCourseKm(e.target.value)} style={inputStyle} />
        </label>
      ) : null}

      <div style={{ marginBlockStart: 24, marginBlockEnd: 56 }} />

      <SectionHeading
        en="Part 3 — The nine domains"
        ar="الجزء 3 — المجالات التسعة"
        noteEn="Select one score for each domain. Where more than one option applies, select the highest."
        noteAr="اختاروا نتيجة واحدة لكل مجال. عند انطباق أكثر من خيار، اختاروا الأعلى."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBlockEnd: 56 }}>
        {domains.map((domain, di) => (
          <div key={domain.number} style={{ padding: 26, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBlockEnd: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{domain.number}</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
                <L en={domain.en} ar={domain.ar} />
              </h3>
            </div>
            {domain.noteEn ? (
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                <L en={domain.noteEn} ar={domain.noteAr} />
              </p>
            ) : null}
            {arabicOnlyNotes
              .filter((n) => n.where.startsWith(`domain ${domain.number},`))
              .map((n) => (
                <SourceNote key={n.where} note={n} />
              ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockStart: 10 }}>
              {domain.options.map((option) => {
                const on = answers[di] === option.score;
                return (
                  <button
                    key={option.score}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setAnswers((prev) => prev.map((a, i) => (i === di ? option.score : a)))
                    }
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

      <SectionHeading en="Part 4 — Classification" ar="الجزء 4 — التصنيف" />
      <div style={{ padding: 32, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, marginBlockEnd: 24 }}>
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
            <span
              key={i}
              style={{ flex: 1, height: 44, borderRadius: 3, background: score !== null && i <= score ? `var(--l${bandForScore(i)})` : 'var(--surface2)' }}
            />
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
            <L
              en="Minimum event level — conditions that cannot be classified lower. Every condition derives from your answers above; none is a checkbox."
              ar="الحد الأدنى لمستوى الفعالية — شروط لا يمكن التصنيف تحتها. كل شرط مستمد من أجوبتكم أعلاه؛ ولا شيء منها خانة اختيار."
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conditions.map((condition) => {
              const on = triggeredKeys.has(condition.key);
              return (
                <div
                  key={condition.key}
                  style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', border: `1px solid ${on ? (condition.level === 3 ? 'var(--l3)' : 'var(--accent)') : 'var(--line)'}`, background: on ? (condition.level === 3 ? 'var(--l3s)' : 'var(--accent-soft)') : 'var(--bg)', borderRadius: 8 }}
                >
                  <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${on ? 'var(--ink)' : 'var(--muted)'}`, borderRadius: 3, background: on ? 'var(--ink)' : 'transparent' }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '14.5px', lineHeight: 1.5 }}>
                      <L en={condition.en} ar={condition.ar} />
                    </span>
                    <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                      <L en="Derived from the figures above" ar="مستمد من الأرقام أعلاه" />
                      {condition.issue !== 'both' ? (
                        <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '0 6px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {condition.issue === 'ar-only' ? (
                            <L en="Arabic issue only" ar="الإصدار العربي فقط" />
                          ) : (
                            <L en="English issue only" ar="الإصدار الإنكليزي فقط" />
                          )}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: `var(--l${condition.level})` }}>
                    <L en={`Level ${condition.level}`} ar={`المستوى ${condition.level}`} />
                  </span>
                </div>
              );
            })}
          </div>
          {arabicOnlyNotes
            .filter((n) => n.where === 'recurring venues')
            .map((n) => (
              <SourceNote key={n.where} note={n} />
            ))}
        </div>

        <div style={{ marginBlockStart: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
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
              <L en="Final event level — the higher of the two" ar="المستوى النهائي — الأعلى من الاثنين" />
            </div>
            {derivation.finalLevel !== null ? (
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: `var(--l${derivation.finalLevel})` }}>
                <L en={`Level ${derivation.finalLevel}`} ar={`المستوى ${derivation.finalLevel}`} />
              </div>
            ) : (
              <div style={{ fontSize: '14.5px', lineHeight: 1.6 }}>
                <L en="Not yet derivable. Still required:" ar="لا يمكن استنتاجه بعد. ما يزال مطلوباً:" />
                <span style={{ display: 'block', marginBlockStart: 4, color: 'var(--accent-ink)' }}>
                  {missingLabels.map((m, i) => (
                    <span key={m.en} style={{ display: 'inline' }}>
                      {i > 0 ? ' · ' : ''}
                      <L en={m.en} ar={m.ar} />
                    </span>
                  ))}
                </span>
              </div>
            )}
            {derivation.governedBy ? (
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 6 }}>
                {derivation.governedBy === 'score' ? (
                  <L en="Governed by the assessment score" ar="يحكمه مجموع نقاط التقييم" />
                ) : derivation.governedBy === 'minimumCondition' ? (
                  <L en="Governed by a minimum condition" ar="يحكمه حد أدنى إلزامي" />
                ) : (
                  <L en="The score and a minimum condition give the same level" ar="يعطي المجموع والحد الأدنى المستوى نفسه" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--bad)' }}>
          {error === 'name-required' ? (
            <L en="The event name is required in both languages." ar="اسم الفعالية مطلوب باللغتين." />
          ) : (
            <L en="The start and end dates are required." ar="تاريخا البداية والنهاية مطلوبان." />
          )}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!derivation.complete || pending}
        onClick={submit}
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: derivation.complete ? 'pointer' : 'not-allowed' }}
      >
        <L en="Save the assessment and open the event record" ar="حفظ التقييم وفتح سجل الفعالية" />
      </button>
      {!derivation.complete ? (
        <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L
            en="The level is derived once every domain is answered and every required figure is captured."
            ar="يُستنتج المستوى بعد الإجابة عن جميع المجالات وإدخال جميع الأرقام المطلوبة."
          />
        </p>
      ) : null}
    </div>
  );
}
