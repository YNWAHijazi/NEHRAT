'use client';

import { MunicipalityField } from '../../../components/MunicipalityField';
import { municipalityList, splitMunicipalities } from '../../../lib/rules/municipalities';

import { OptionText, useDocumentLang } from '../../../components/OptionText';
import { EVENT_TYPES, EXTRA_DISCIPLINES, activityAnswerForType, isArabicName } from '../../../lib/rules/event-labels';
import { InfoNote } from '../../../components/InfoNote';
import { SiteLocationField, siteNameIn } from '../../../components/SiteLocationField';
import type { SiteOption } from '../../../lib/event-site';

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

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { createEventAction, updateDraftEventAction, reassessAction, type AssessmentSubmission } from '../../actions';
import type { Band, Domain, MinimumCondition } from '../../../lib/rules/load';
import { PART_F, attendanceBandScore } from '../../../lib/rules/load';
import { deriveLevel } from '../../../lib/rules/derive';
import { levelWhy } from '../../../lib/rules/why';
import type { DomainAnswers, MinimumConditionInputs } from '../../../lib/rules/types';

/** Lebanon's municipalities, once the official list is loaded (owner, 9 October 2026); empty until then. */
const MUNICIPALITIES = municipalityList();
const MUNICIPALITY_LABEL: React.CSSProperties = { fontSize: '13.5px', color: 'var(--muted)' };

/**
 * The event-type list: every discipline that carries a level floor, the venue type that
 * carries one, and plain kinds for everything else. The mapping is the point — the
 * chosen type resolves the derivation inputs, so the floor questions are never asked
 * as questions.
 */
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
  draft,
  organizerName,
  sites = [],
  initialSiteId = '',
  representativeDefault = '',
}: {
  draft?: AssessmentSubmission & { eventId: string };
  domains: Domain[];
  conditions: MinimumCondition[];
  bands: Band[];
  maxScore: number;
  reassess?: { eventId: string; answers: (0 | 1 | 2 | null)[]; inputs: MinimumConditionInputs };
  /** The organization's name for Part F's Organizer line, when one is recorded. */
  organizerName?: { en: string; ar: string } | null;
  /** The signed-in organizer's name: the declaration's representative until changed (owner, 9 October 2026). */
  representativeDefault?: string;
  /** The registered Facility/Sites this account may link the event to (lib/event-site). */
  sites?: SiteOption[];
  /** A new event started from a site ("Create event at this site", /events/new?site=): pre-linked. */
  initialSiteId?: string;
}) {
  const stored = reassess ?? draft;
  void conditions;
  void bands;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [representative, setRepresentative] = useState(representativeDefault);
  const [position, setPosition] = useState('');
  const certificationComplete = representative.trim() !== '' && position.trim() !== '';
  const [nameEn, setNameEn] = useState(draft?.nameEn ?? '');
  const [nameAr, setNameAr] = useState(draft?.nameAr ?? '');
  const [startDate, setStartDate] = useState(draft?.startDate ?? '');
  const [endDate, setEndDate] = useState(draft?.endDate || draft?.startDate || '');
  const endDateEdited = useRef(Boolean(draft?.endDate));
  const closingTimeEdited = useRef(Boolean(draft?.partA.closingTime));
  const lang = useDocumentLang();
  // A new event opened from a site starts linked to it, with the site's name and municipality filled in.
  const startSite = draft ? null : sites.find((o) => o.id === initialSiteId) ?? null;
  const [partA, setPartA] = useState({
    venueRoute: draft?.partA.venueRoute ?? (startSite ? siteNameIn(startSite, lang) : ''),
    municipalities: draft?.partA.municipalities ?? (startSite ? (lang === 'ar' ? startSite.municipalityAr : startSite.municipalityEn) : ''),
    // A new event opens at 07:00 (owner, 2026-10-07: that is when a marathon starts); a draft keeps its own times.
    openingTime: draft?.partA.openingTime ?? (draft ? '' : '07:00'), closingTime: draft?.partA.closingTime || draft?.partA.openingTime || (draft ? '' : '07:00'),
  });
  // THE ONE LINK to a registered Facility/Site, by Site ID: set from the suggestions under the
  // location field or from "Show all registered sites". A stored link that is no longer
  // listable (the facility registration was archived) opens unset.
  const [siteId, setSiteId] = useState(
    draft ? (sites.some((o) => o.id === draft.partA.siteId) ? (draft.partA.siteId ?? '') : '') : (startSite?.id ?? ''),
  );
  const setA = (k: keyof typeof partA, v: string | boolean) =>
    setPartA((prev) => ({ ...prev, [k]: v }));

  const initialType = EVENT_TYPES.find((type) => [type.key, type.en, type.ar].includes(draft?.partA.eventType ?? ''))?.key
    ?? (stored ? typeFromInputs(stored.inputs) : '');
  const [typeKey, setTypeKey] = useState<string>(initialType);
  const [extraDisciplines, setExtraDisciplines] = useState<string[]>(
    stored
      ? stored.inputs.eventDisciplines.filter(
          (d) => !(EVENT_TYPES.find((t) => t.key === initialType)?.disciplines ?? []).includes(d),
        )
      : [],
  );
  const [answers, setAnswers] = useState<(0 | 1 | 2 | null)[]>(
    stored ? [...stored.answers] : Array(9).fill(null),
  );
  // ONE attendance figure, asked inside question 1 (owner, 10 October 2026: the three separate
  // counts are dropped). Question 1's answer follows from it; a draft from before keeps the sum of
  // its old counts as the figure.
  const draftCounts = [draft?.partA.expectedParticipants, draft?.partA.expectedSpectators, draft?.partA.expectedStaff].filter((v): v is number => typeof v === 'number');
  const [attendanceDirect, setAttendanceDirect] = useState(
    stored?.inputs.expectedMaxSimultaneousAttendance != null ? String(stored.inputs.expectedMaxSimultaneousAttendance)
      : draftCounts.length > 0 ? String(draftCounts.reduce((a, b) => a + b, 0)) : '',
  );
  // Question 2 is filled in from the event type until the organizer changes it themselves.
  const activityChosen = useRef(Boolean(stored));
  const [courseKm, setCourseKm] = useState(
    stored?.inputs.courseDistanceKm != null ? String(stored.inputs.courseDistanceKm) : '',
  );
  const [capacity, setCapacity] = useState(
    stored?.inputs.venueLicensedCapacity != null ? String(stored.inputs.venueLicensedCapacity) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const chosenType = EVENT_TYPES.find((t) => t.key === typeKey) ?? null;
  const disciplines = useMemo(() => {
    const base = chosenType?.disciplines ?? [];
    return [...base, ...extraDisciplines.filter((d) => !base.includes(d))];
  }, [chosenType, extraDisciplines]);

  const attendance: number | null = attendanceDirect.trim() === '' ? null : Number(attendanceDirect);
  // Question 1 follows the figure; question 2 follows the event type until the organizer answers it.
  const bandScore = attendanceBandScore(attendance);
  const activityFromType = activityAnswerForType(typeKey, disciplines);
  useEffect(() => {
    setAnswers((prev) => (prev[0] === bandScore ? prev : prev.map((a, i) => (i === 0 ? bandScore : a))));
  }, [bandScore]);
  useEffect(() => {
    if (activityChosen.current || activityFromType === null) return;
    setAnswers((prev) => (prev[1] === activityFromType ? prev : prev.map((a, i) => (i === 1 ? activityFromType : a))));
  }, [activityFromType]);
  const arabicNameRefused = !reassess && nameAr.trim() !== '' && !isArabicName(nameAr);

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

  // The capacity field appears only once a nightclub type is chosen; until a type is chosen,
  // "Event type" is the thing to fill in, not a field that is not on the screen yet.
  const missingLabels: { en: string; ar: string }[] = derivation.missingInputs.filter((k) => !(k === 'venueLicensedCapacity' && !isNightclub)).map((k) => {
    if (k === 'expectedMaxSimultaneousAttendance')
      return { en: 'Most people at the same time (question 1)', ar: 'أكبر عدد من الحاضرين في الوقت نفسه (السؤال 1)' };
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
    if (arabicNameRefused) {
      setError('arabic-name');
      return;
    }
    startTransition(async () => {
      if (reassess) {
        const result = await reassessAction(reassess.eventId, {
          answers: answers as DomainAnswers,
          inputs,
          representative,
          position,
        });
        if ('error' in result) setError(result.error);
        else router.push(`/events/${reassess.eventId}?notice=reassessed`);
        return;
      }
      const payload: AssessmentSubmission = {
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
          // The three counts and the two boxes are no longer asked (owner, 10 October 2026): the
          // attendance figure travels in `inputs`, the previous edition is question 9, and a fixed
          // venue is the link to its registered site.
          expectedParticipants: null,
          expectedSpectators: null,
          expectedStaff: null,
          previousEdition: false,
          recurringFixedVenue: false,
          siteId: siteId !== '' ? siteId : null,
        },
        answers: answers as DomainAnswers,
        inputs,
        representative,
        position,
      };
      const result = draft ? await updateDraftEventAction(draft.eventId, payload) : await createEventAction(payload);
      if ('error' in result) setError(result.error);
      else router.push(`/events/${result.eventId}`);
    });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
        <L en={reassess ? "Update assessment" : draft ? "Update event" : "Create event"} ar={reassess ? "تحديث التقييم" : draft ? "تحديث الفعالية" : "إنشاء فعالية"} />
       <InfoNote>{reassess ? (
          <L
            en="Saving stores a new version. Earlier versions stay on the record."
            ar="الحفظ يخزّن نسخة جديدة، وتبقى النسخ السابقة على السجل."
          />
        ) : (
          <L
            en="Answer these once. The answers set your event's level, and the level sets what you need to do."
            ar="أجيبوا عن هذه الأسئلة مرة واحدة. الأجوبة تحدد مستوى فعاليتكم، والمستوى يحدد ما عليكم فعله."
          />
        )}</InfoNote>
</h1>

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
              <input dir="rtl" lang="ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} aria-invalid={arabicNameRefused || undefined}
                style={arabicNameRefused ? { ...inputStyle, borderColor: 'var(--bad)' } : inputStyle} />
              {arabicNameRefused ? (
                <span role="alert" data-region="arabic-name-refused" style={{ display: 'block', marginBlockStart: 6, fontSize: 13, color: 'var(--bad)' }}>
                  <L en="Arabic letters only." ar="أحرف عربية فقط." />
                </span>
              ) : null}
            </Field>
            <Field labelEn="Start date" labelAr="تاريخ البداية">
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDateEdited.current) setEndDate(e.target.value); }} style={inputStyle} />
            </Field>
            <Field labelEn="End date" labelAr="تاريخ النهاية">
              <input type="date" value={endDate} onChange={(e) => { endDateEdited.current = Boolean(e.target.value); setEndDate(e.target.value || startDate); }} min={startDate || undefined} style={inputStyle} />
            </Field>
            <Field labelEn="Opening time" labelAr="وقت الافتتاح">
              <input type="time" step={300} value={partA.openingTime} onChange={(e) => { const value = e.target.value; setPartA(prev => ({ ...prev, openingTime: value, ...(!closingTimeEdited.current ? { closingTime: value } : {}) })); }} style={inputStyle} />
            </Field>
            <Field labelEn="Closing time" labelAr="وقت الإغلاق">
              <input type="time" step={300} value={partA.closingTime} onChange={(e) => { closingTimeEdited.current = Boolean(e.target.value); setA('closingTime', e.target.value || partA.openingTime); }} style={inputStyle} />
            </Field>
            <SiteLocationField
              options={sites}
              text={partA.venueRoute}
              onTextChange={(text) => setA('venueRoute', text)}
              linkedId={siteId}
              onLinkedChange={setSiteId}
              labelEn="Venue, route, or location"
              labelAr="الموقع أو المسار أو مكان الانعقاد"
              labelStyle={fieldLabel}
              inputStyle={inputStyle}
            />
            {MUNICIPALITIES.length > 0 ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <MunicipalityField options={MUNICIPALITIES} multiple value={splitMunicipalities(partA.municipalities)}
                  onChange={(chosen) => setA('municipalities', chosen.map((m) => m.en).join(', '))}
                  labelEn="Municipality or municipalities" labelAr="البلدية أو البلديات" labelStyle={MUNICIPALITY_LABEL} inputStyle={inputStyle} />
              </div>
            ) : (
              <Field labelEn="Municipality or municipalities" labelAr="البلدية أو البلديات">
                <input value={partA.municipalities} onChange={(e) => setA('municipalities', e.target.value)} style={inputStyle} />
              </Field>
            )}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
        <Field labelEn="Event type" labelAr="نوع الفعالية">
          <select value={typeKey} onChange={(e) => { setTypeKey(e.target.value); setExtraDisciplines([]); }} style={{ ...inputStyle, appearance: 'auto' }}>
            <option value="" disabled />
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                <OptionText en={t.en} ar={t.ar} />
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
        <details data-region="additional-activities" open={reassess && extraDisciplines.length > 0 ? true : undefined} style={{ marginBlockEnd: 24 }}>
          <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en="Add another activity (optional)" ar="إضافة نشاط آخر (اختياري)" />
          </summary>
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
        </details>
      ) : null}

      <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Risk assessment" ar="تقييم المخاطر" />
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBlockEnd: 56 }}>
        {domains.map((domain, di) => (
          <div key={domain.number} style={{ padding: 27, background: 'var(--surface2)', borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBlockEnd: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{domain.number}</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
                <L en={domain.en} ar={domain.ar} />
                {domain.noteEn ? <InfoNote labelEn={`About ${domain.en}`} labelAr={`حول ${domain.ar}`}><L en={domain.noteEn} ar={domain.noteAr} /></InfoNote> : null}
              </h3>
            </div>
            {/* What the question asks, in everyday words (owner, 10 October 2026). */}
            <p data-region="domain-lead" style={{ margin: '0 0 4px', fontSize: '14.5px', lineHeight: 1.55, color: 'var(--muted)' }}>
              <L en={domain.leadEn} ar={domain.leadAr} />
            </p>
            {di === 0 ? (
              <label data-region="attendance" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlock: '10px 4px', maxWidth: 320 }}>
                <span style={fieldLabel}><L en="Most people at the same time" ar="أكبر عدد من الحاضرين في الوقت نفسه" /></span>
                <input type="number" min={0} inputMode="numeric" name="attendance" value={attendanceDirect} onChange={(e) => setAttendanceDirect(e.target.value)} style={inputStyle} />
              </label>
            ) : null}
            {di === 1 && !activityChosen.current && activityFromType !== null && answers[1] === activityFromType ? (
              <p data-region="activity-from-type" style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--brand)' }}>
                <L en="Filled in from the event type. Change it if it does not fit." ar="عُبّئ من نوع الفعالية. غيّروه إن لم يكن مناسباً." />
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
                    // Question 1 is answered by the figure above it, never by a click.
                    disabled={di === 0}
                    onClick={() => {
                      if (di === 1) activityChosen.current = true;
                      setAnswers((prev) => prev.map((a, i) => (i === di ? option.score : a)));
                    }}
                    style={{ textAlign: 'start', display: 'flex', gap: 16, padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: di === 0 ? 'default' : 'pointer', color: 'var(--ink)', opacity: di === 0 && !on ? 0.6 : 1 }}
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
              <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى">
                {why.reason ? <L en={why.reason.en} ar={why.reason.ar} /> : null}{' '}
                {why.comparison ? <L en={why.comparison.en} ar={why.comparison.ar} /> : null}
              </InfoNote>
            </div>

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

      {/* THE ASSESSMENT TOOL'S PART F -- the organizer declaration, verbatim from each issue
          (the Arabic issue's statement carries qualifiers the English does not;
          the divergence is recorded in the data and awaits a Ministry decision).
          Every version is certified fresh: reassessing declares again. The
          signature line stays with open decision #9 -- captured fields, no
          invented signature control, same as the compliance certification. */}
      <div data-region="part-f" style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en={PART_F.titleEn} ar={PART_F.titleAr} />
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '14.5px', lineHeight: 1.65, maxWidth: '74ch' }}>
          <L en={PART_F.statementEn} ar={PART_F.statementAr} />
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBlockEnd: 4 }}>
              <L en={PART_F.labels.organizer.en} ar={PART_F.labels.organizer.ar} />
            </div>
            <div style={{ fontSize: '14px', paddingBlock: 7 }}>
              {organizerName ? <L en={organizerName.en} ar={organizerName.ar} /> : <L en="—" ar="—" />}
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <L en={PART_F.labels.representative.en} ar={PART_F.labels.representative.ar} />
            </span>
            <input value={representative} onChange={(e) => setRepresentative(e.target.value)} style={{ height: 36, paddingInline: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, fontSize: 14 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <L en={PART_F.labels.position.en} ar={PART_F.labels.position.ar} />
            </span>
            <input value={position} onChange={(e) => setPosition(e.target.value)} style={{ height: 36, paddingInline: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, fontSize: 14 }} />
          </label>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBlockEnd: 4 }}>
              <L en={PART_F.labels.date.en} ar={PART_F.labels.date.ar} />
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', paddingBlock: 8, lineHeight: 1.5 }}>
              <L en={PART_F.dateNoteEn} ar={PART_F.dateNoteAr} />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--bad)' }}>
          {error === 'name-required' ? (
            <L en="The event name is required in both languages." ar="اسم الفعالية مطلوب باللغتين." />
          ) : error === 'arabic-name' ? (
            <L en="Write the Arabic event name in Arabic letters only." ar="اكتبوا اسم الفعالية بالعربية بأحرف عربية فقط." />
          ) : error === 'site' ? (
            <L en="The chosen site is not a registered facility/site. Choose a site from the list." ar="الموقع المختار ليس منشأة/موقعاً مسجّلاً. اختاروا موقعاً من القائمة." />
          ) : error === 'certification-required' ? (
            <L en="The declaration's representative and position are required." ar="ممثل الإقرار وصفته مطلوبان." />
          ) : (
            <L en="The start and end dates are required." ar="تاريخا البداية والنهاية مطلوبان." />
          )}
        </p>
      ) : null}
      {derivation.complete && !certificationComplete ? (
        <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
          <L en="Complete the organizer declaration to save: authorized representative and position." ar="أكملوا إقرار المنظم للحفظ: الممثل المفوض والصفة." />
        </p>
      ) : null}
      <button
        type="button"
        disabled={!derivation.complete || !certificationComplete || pending}
        onClick={submit}
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: derivation.complete && certificationComplete ? 'var(--brand)' : 'var(--surface2)', color: derivation.complete && certificationComplete ? 'var(--bg)' : 'var(--muted)', fontSize: '14.5px', fontWeight: 500, cursor: derivation.complete && certificationComplete ? 'pointer' : 'not-allowed' }}
      >
        {reassess ? (
          <L en="Save as a new assessment version" ar="حفظ كنسخة تقييم جديدة" />
        ) : (
          <L en="Continue to requirements" ar="المتابعة إلى المتطلبات" />
        )}
      </button>
    </div>
  );
}
