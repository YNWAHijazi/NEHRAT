'use client';

/**
 * Applicability and assessment — one form, rebuilt for simplicity (partner review,
 * 2026-09-01).
 *
 * What changed and why:
 * - Parts 1 and 2 merged. The old form asked for the event, then a second section of
 *   "figures the classification depends on" that re-asked what Part 1 already knew.
 * - EVENT TYPE IS A DROPDOWN, and picking it IS the floor input. Choosing "Running
 *   event" feeds the running condition; choosing "Event at a nightclub or dance venue"
 *   answers the venue question. Nothing asks again later.
 * - ATTENDANCE IS ASKED ONCE. The three expected counts (participants, spectators,
 *   staff) are the assessment tool's own Part A fields, and the derivation's "most people present
 *   at the same time" is their sum — the instrument defines it as everyone at once, including
 *   participants, attendees, staff, performers, contractors and volunteers. Summing is
 *   the conservative reading: it can only raise the level, never lower it.
 * - The ten-condition checklist display is GONE from the organizer's screen. The result
 *   is the level and one line why (lib/rules/why.ts); the full derivation detail stays
 *   on the Ministry reviewer's screen. Both results and which governed are still
 *   reported, compactly (non-negotiable 1).
 * - "The venue regularly hosts organized events" is no longer asked here — it is a
 *   venue question, on the venue record. The recur condition it fed was the Arabic
 *   issue's; English governs (partner ruling).
 *
 * What did not change: the level is derived, never chosen. This form owns no level
 * control. An unset required input produces "Please fill in: …" naming the field —
 * never a level.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { createEventAction, reassessAction } from '../../actions';
import type { Band, Domain, MinimumCondition } from '../../../lib/rules/load';
import { deriveLevel } from '../../../lib/rules/derive';
import { levelWhy } from '../../../lib/rules/why';
import type { DomainAnswers, MinimumConditionInputs } from '../../../lib/rules/types';

/**
 * The event-type list: every discipline that carries a level floor, the venue type that
 * carries one, and plain kinds for everything else. The mapping is the point — the
 * chosen type resolves the derivation inputs, so the floor questions are never asked
 * as questions.
 */
const EVENT_TYPES: {
  key: string;
  en: string;
  ar: string;
  disciplines: readonly string[];
  nightclub: boolean;
}[] = [
  { key: 'running', en: 'Running event', ar: 'فعالية جري', disciplines: ['running'], nightclub: false },
  { key: 'cycling', en: 'Cycling race', ar: 'سباق دراجات', disciplines: ['cycling'], nightclub: false },
  { key: 'triathlon', en: 'Triathlon', ar: 'سباق ثلاثي (ترياتلون)', disciplines: ['triathlon'], nightclub: false },
  { key: 'open_water', en: 'Open-water swimming', ar: 'سباحة في المياه المفتوحة', disciplines: ['open_water_swimming'], nightclub: false },
  { key: 'boxing', en: 'Boxing', ar: 'ملاكمة', disciplines: ['boxing'], nightclub: false },
  { key: 'kickboxing', en: 'Kickboxing', ar: 'كيك بوكسينغ', disciplines: ['kickboxing'], nightclub: false },
  { key: 'muay_thai', en: 'Muay Thai', ar: 'مواي تاي', disciplines: ['muay_thai'], nightclub: false },
  { key: 'mma', en: 'Mixed martial arts', ar: 'فنون قتالية مختلطة', disciplines: ['mixed_martial_arts'], nightclub: false },
  { key: 'motor', en: 'Motor racing', ar: 'سباق سيارات', disciplines: ['motor_racing'], nightclub: false },
  { key: 'other_sport', en: 'Another sporting event', ar: 'فعالية رياضية أخرى', disciplines: [], nightclub: false },
  { key: 'nightclub', en: 'Event at a nightclub or dance venue', ar: 'فعالية في ملهى ليلي أو صالة رقص', disciplines: [], nightclub: true },
  { key: 'concert', en: 'Concert, festival or performance', ar: 'حفلة أو مهرجان أو عرض', disciplines: [], nightclub: false },
  { key: 'gathering', en: 'Conference, exhibition or ceremony', ar: 'مؤتمر أو معرض أو مراسم', disciplines: [], nightclub: false },
  { key: 'other', en: 'Something else', ar: 'شيء آخر', disciplines: [], nightclub: false },
];

/** The floor-carrying disciplines, for the "also includes" row. */
const EXTRA_DISCIPLINES: { key: string; en: string; ar: string }[] = [
  { key: 'running', en: 'Running', ar: 'جري' },
  { key: 'cycling', en: 'Cycling', ar: 'دراجات' },
  { key: 'triathlon', en: 'Triathlon', ar: 'ترياتلون' },
  { key: 'open_water_swimming', en: 'Open-water swimming', ar: 'سباحة في المياه المفتوحة' },
  { key: 'boxing', en: 'Boxing', ar: 'ملاكمة' },
  { key: 'kickboxing', en: 'Kickboxing', ar: 'كيك بوكسينغ' },
  { key: 'muay_thai', en: 'Muay Thai', ar: 'مواي تاي' },
  { key: 'mixed_martial_arts', en: 'Mixed martial arts', ar: 'فنون قتالية مختلطة' },
  { key: 'motor_racing', en: 'Motor racing', ar: 'سباق سيارات' },
];

/** Reassess mode has stored inputs but no stored type key: recover the closest type. */
function typeFromInputs(inputs: MinimumConditionInputs): string {
  if (inputs.venueIsNightclubOrDanceVenue === true) return 'nightclub';
  for (const t of EVENT_TYPES) {
    if (t.disciplines.length > 0 && t.disciplines.every((d) => inputs.eventDisciplines.includes(d))) return t.key;
  }
  return inputs.eventDisciplines.length > 0 ? 'other_sport' : 'other';
}

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

function Field({ labelEn, labelAr, children }: { labelEn: string; labelAr: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>
        <L en={labelEn} ar={labelAr} />
      </span>
      {children}
    </label>
  );
}

export function AssessmentForm({
  domains,
  conditions,
  bands,
  maxScore,
  reassess,
}: {
  domains: Domain[];
  conditions: MinimumCondition[];
  bands: Band[];
  maxScore: number;
  reassess?: { eventId: string; answers: (0 | 1 | 2 | null)[]; inputs: MinimumConditionInputs };
}) {
  void conditions;
  void bands;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partA, setPartA] = useState({
    venueRoute: '', municipalities: '',
    openingTime: '', closingTime: '',
    expectedParticipants: '', expectedSpectators: '', expectedStaff: '',
    previousEdition: false, recurringFixedVenue: false,
  });
  const setA = (k: keyof typeof partA, v: string | boolean) =>
    setPartA((prev) => ({ ...prev, [k]: v }));

  const [typeKey, setTypeKey] = useState<string>(reassess ? typeFromInputs(reassess.inputs) : '');
  const [extraDisciplines, setExtraDisciplines] = useState<string[]>(
    reassess
      ? reassess.inputs.eventDisciplines.filter(
          (d) => !(EVENT_TYPES.find((t) => t.key === typeFromInputs(reassess.inputs))?.disciplines ?? []).includes(d),
        )
      : [],
  );
  const [answers, setAnswers] = useState<(0 | 1 | 2 | null)[]>(
    reassess ? reassess.answers : Array(9).fill(null),
  );
  // Reassess edits the stored attendance figure directly; creation derives it from the
  // three expected counts below, so the number is never asked twice.
  const [attendanceDirect, setAttendanceDirect] = useState(
    reassess?.inputs.expectedMaxSimultaneousAttendance != null ? String(reassess.inputs.expectedMaxSimultaneousAttendance) : '',
  );
  const [courseKm, setCourseKm] = useState(
    reassess?.inputs.courseDistanceKm != null ? String(reassess.inputs.courseDistanceKm) : '',
  );
  const [capacity, setCapacity] = useState(
    reassess?.inputs.venueLicensedCapacity != null ? String(reassess.inputs.venueLicensedCapacity) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const chosenType = EVENT_TYPES.find((t) => t.key === typeKey) ?? null;
  const disciplines = useMemo(() => {
    const base = chosenType?.disciplines ?? [];
    return [...base, ...extraDisciplines.filter((d) => !base.includes(d))];
  }, [chosenType, extraDisciplines]);

  const attendance: number | null = useMemo(() => {
    if (reassess) return attendanceDirect.trim() === '' ? null : Number(attendanceDirect);
    const parts = [partA.expectedParticipants, partA.expectedSpectators, partA.expectedStaff]
      .filter((v) => v.trim() !== '')
      .map(Number);
    if (parts.length === 0) return null;
    return parts.reduce((a, b) => a + b, 0);
  }, [reassess, attendanceDirect, partA.expectedParticipants, partA.expectedSpectators, partA.expectedStaff]);

  const inputs: MinimumConditionInputs = useMemo(
    () => ({
      expectedMaxSimultaneousAttendance: attendance,
      eventDisciplines: disciplines,
      courseDistanceKm: courseKm.trim() === '' ? null : Number(courseKm),
      venueLicensedCapacity: capacity.trim() === '' ? null : Number(capacity),
      // The dropdown answers the venue question; unanswered only while no type is chosen.
      venueIsNightclubOrDanceVenue: chosenType === null ? null : chosenType.nightclub,
    }),
    [attendance, disciplines, courseKm, capacity, chosenType],
  );

  const derivation = useMemo(
    () => deriveLevel({ answers: answers as DomainAnswers, inputs }),
    [answers, inputs],
  );
  const why = levelWhy(derivation, disciplines);

  const isRunning = disciplines.includes('running');
  const isNightclub = chosenType?.nightclub === true;

  const missingLabels: { en: string; ar: string }[] = derivation.missingInputs.map((k) => {
    if (k === 'expectedMaxSimultaneousAttendance')
      return reassess
        ? { en: 'Most people at the same time', ar: 'أكبر عدد من الحاضرين في الوقت نفسه' }
        : { en: 'Expected numbers', ar: 'الأعداد المتوقعة' };
    if (k === 'courseDistanceKm') return { en: 'Course distance', ar: 'مسافة المسار' };
    if (k === 'venueIsNightclubOrDanceVenue') return { en: 'Event type', ar: 'نوع الفعالية' };
    if (k === 'venueLicensedCapacity')
      return { en: 'Licensed capacity of the venue', ar: 'السعة المرخّصة للموقع' };
    if (k.startsWith('domain')) {
      const n = k.slice(6);
      return { en: `Question ${n}`, ar: `السؤال ${n}` };
    }
    return { en: k, ar: k };
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      if (reassess) {
        const result = await reassessAction(reassess.eventId, {
          answers: answers as DomainAnswers,
          inputs,
        });
        if ('error' in result) setError(result.error);
        else router.push(`/events/${reassess.eventId}?notice=reassessed`);
        return;
      }
      const result = await createEventAction({
        nameEn,
        nameAr,
        startDate,
        endDate,
        partA: {
          // The chosen type's English label is the stored Part A event-type value, as
          // the earlier typed field was before it; the structured floor inputs travel in
          // `inputs` alongside it.
          eventType: chosenType?.en ?? '',
          venueRoute: partA.venueRoute,
          municipalities: partA.municipalities,
          openingTime: partA.openingTime,
          closingTime: partA.closingTime,
          expectedParticipants: partA.expectedParticipants === '' ? null : Number(partA.expectedParticipants),
          expectedSpectators: partA.expectedSpectators === '' ? null : Number(partA.expectedSpectators),
          expectedStaff: partA.expectedStaff === '' ? null : Number(partA.expectedStaff),
          previousEdition: partA.previousEdition,
          recurringFixedVenue: partA.recurringFixedVenue,
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
        {reassess ? (
          <L
            en="Saving stores a new version. Earlier versions stay on the record."
            ar="الحفظ يخزّن نسخة جديدة، وتبقى النسخ السابقة على السجل."
          />
        ) : (
          <L
            en="Answer these once. The answers set your event's level, and the level sets what you need to do."
            ar="أجيبوا عن هذه الأسئلة مرة واحدة. الأجوبة تحدد مستوى فعاليتكم، والمستوى يحدد ما عليكم فعله."
          />
        )}
      </p>

      {reassess ? null : (
        <>
          <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="The event" ar="الفعالية" />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
            <Field labelEn="Event name (English)" labelAr="اسم الفعالية (بالإنكليزية)">
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Event name (Arabic)" labelAr="اسم الفعالية (بالعربية)">
              <input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Start date" labelAr="تاريخ البداية">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="End date" labelAr="تاريخ النهاية">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Opening time" labelAr="وقت الافتتاح">
              <input type="time" value={partA.openingTime} onChange={(e) => setA('openingTime', e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Closing time" labelAr="وقت الإغلاق">
              <input type="time" value={partA.closingTime} onChange={(e) => setA('closingTime', e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Venue, route, or location" labelAr="الموقع أو المسار أو مكان الانعقاد">
              <input value={partA.venueRoute} onChange={(e) => setA('venueRoute', e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Municipality or municipalities" labelAr="البلدية أو البلديات">
              <input value={partA.municipalities} onChange={(e) => setA('municipalities', e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
        <Field labelEn="Event type" labelAr="نوع الفعالية">
          <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
            <option value="" disabled />
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.en} · {t.ar}
              </option>
            ))}
          </select>
        </Field>
        {isNightclub ? (
          <Field labelEn="Licensed capacity of the venue" labelAr="السعة المرخّصة للموقع">
            <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
          </Field>
        ) : null}
        {isRunning ? (
          <Field labelEn="Course distance, km" labelAr="مسافة المسار بالكيلومترات">
            <input type="number" min={0} step="0.1" value={courseKm} onChange={(e) => setCourseKm(e.target.value)} style={inputStyle} />
          </Field>
        ) : null}
      </div>

      {chosenType ? (
        <div style={{ marginBlockEnd: 24 }}>
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en="Does it also include any of these?" ar="هل تتضمن أيضاً أياً من هذه؟" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXTRA_DISCIPLINES.filter((d) => !(chosenType.disciplines as readonly string[]).includes(d.key)).map((d) => {
              const on = extraDisciplines.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setExtraDisciplines((prev) => (on ? prev.filter((k) => k !== d.key) : [...prev, d.key]))
                  }
                  style={{ height: 38, paddingInline: 15, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 19, fontSize: 14, cursor: 'pointer' }}
                >
                  <L en={d.en} ar={d.ar} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {reassess ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 40 }}>
          <Field labelEn="Most people at the same time" labelAr="أكبر عدد من الحاضرين في الوقت نفسه">
            <input type="number" min={0} value={attendanceDirect} onChange={(e) => setAttendanceDirect(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 8 }}>
            <Field labelEn="Expected participants" labelAr="العدد المتوقع للمشاركين">
              <input type="number" min={0} value={partA.expectedParticipants} onChange={(e) => setA('expectedParticipants', e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Expected spectators" labelAr="العدد المتوقع للمتفرجين">
              <input type="number" min={0} value={partA.expectedSpectators} onChange={(e) => setA('expectedSpectators', e.target.value)} style={inputStyle} />
            </Field>
            <Field labelEn="Expected staff and volunteers" labelAr="العدد المتوقع للعاملين والمتطوعين">
              <input type="number" min={0} value={partA.expectedStaff} onChange={(e) => setA('expectedStaff', e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <p style={{ margin: '0 0 32px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '70ch' }}>
            <L
              en="Together these count everyone who may be there at the same time."
              ar="تحسب هذه الأعداد معاً كل من قد يكون حاضراً في الوقت نفسه."
            />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 48 }}>
            {(
              [
                ['previousEdition', 'This event has been held before', 'أقيمت هذه الفعالية من قبل'],
                ['recurringFixedVenue', 'It is at a fixed venue that hosts events repeatedly', 'تقام في موقع ثابت يستضيف فعاليات بصورة متكررة'],
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
        </>
      )}

      <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Part two" ar="الجزء الثاني" />
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBlockEnd: 56 }}>
        {domains.map((domain, di) => (
          <div key={domain.number} style={{ padding: 27, background: 'var(--surface2)', borderRadius: 16 }}>
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

      {/* The result: the level and one line why. The organizer never sees the condition
          checklist; the reviewer's screen keeps the full derivation (partner review). */}
      <div data-region="result" style={{ padding: 33, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="Your event's level" ar="مستوى فعاليتكم" />
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
            <L en="Please fill in:" ar="يرجى استكمال:" />
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
        {reassess ? (
          <L en="Save as a new assessment version" ar="حفظ كنسخة تقييم جديدة" />
        ) : (
          <L en="Save the assessment and open the event record" ar="حفظ التقييم وفتح سجل الفعالية" />
        )}
      </button>
    </div>
  );
}
