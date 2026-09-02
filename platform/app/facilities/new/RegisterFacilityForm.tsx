'use client';

/**
 * Steps 1-3 from the reference: profile, category determination, coordinator.
 *
 * The category step asks lib/rules which of the four state chips applies and whether
 * the journey ends (categoryEndsJourney). Where it ends, the ONLY actions are Record
 * an interest and Back to the dashboard -- no Continue renders at all. A school must
 * leave understanding it has done everything available to it.
 */

import { useState } from 'react';
import { L } from '../../../components/L';
import { recordFacilityInterestAction, registerFacilityAction } from '../../actions';
import {
  FACILITY_CATEGORIES,
  FACILITY_CONTENT,
  categoryEndsJourney,
  categoryWithPublished,
  type FacilityCategory,
} from '../../../lib/rules';
import type { StateChip } from '../../../lib/rules';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

const CHIP: Record<StateChip, { bg: string; color: string; border: string; en: string; ar: string }> = {
  inForceNow: { bg: 'var(--brand-soft)', color: 'var(--brand)', border: 'var(--brand)', en: 'In force now', ar: 'سارٍ الآن' },
  partlyInForce: { bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)', en: 'Partly in force', ar: 'سارٍ جزئياً' },
  awaitingMinistryValue: { bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)', en: 'Awaiting a Ministry value', ar: 'بانتظار قيمة من الوزارة' },
  determinedByReview: { bg: 'var(--surface2)', color: 'var(--muted)', border: 'var(--line)', en: 'Determined by Ministry review', ar: 'تحدده مراجعة الوزارة' },
};

const STEPS = [
  { en: 'Facility profile', ar: 'ملف المنشأة' },
  { en: 'Category', ar: 'الفئة' },
  { en: 'Coordinator', ar: 'المنسّق' },
  { en: 'Device records', ar: 'سجلات الأجهزة' },
  { en: 'Response plan', ar: 'خطة الاستجابة' },
  { en: 'Registered', ar: 'مُسجَّلة' },
].map((s, i) => ({ ...s, n: i + 1 }));

export function RegisterFacilityForm({
  published,
}: {
  /** What the Ministry has published (powers one and two); governs the category states. */
  published: { phasedSchedule: { value: string; effective: string | null } | null; capacityThreshold: { value: string; effective: string | null } | null };
}) {
  const [step, setStep] = useState(1);
  const [catKey, setCatKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const content = FACILITY_CONTENT;
  const governed = (key: string): FacilityCategory | null => categoryWithPublished(key, published);
  const picked: FacilityCategory | null = catKey === null ? null : governed(catKey);
  const ended = picked !== null && categoryEndsJourney(picked);

  const field = (key: string, en: string, ar: string, dir?: 'rtl', hintEn?: string, hintAr?: string) => (
    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.45 }}>
        <L en={en} ar={ar} />
      </span>
      <input
        {...(dir ? { dir } : {})}
        value={profile[key] ?? ''}
        onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
        style={inputStyle}
      />
      {hintEn && hintAr ? (
        <span style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--muted)' }}>
          <L en={hintEn} ar={hintAr} />
        </span>
      ) : null}
    </label>
  );

  return (
    <div>
      <div data-region="step-rail" data-stack="" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBlockEnd: 40 }}>
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            aria-pressed={step === s.n}
            onClick={() => (s.n <= 3 ? setStep(s.n) : undefined)}
            style={{ textAlign: 'start', paddingBlockStart: 12, border: 0, borderBlockStart: `2px solid ${s.n < step ? 'var(--brand)' : s.n === step ? 'var(--accent)' : 'var(--line)'}`, background: 'none', cursor: s.n <= 3 ? 'pointer' : 'default' }}
          >
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: 4 }}>{s.n}</span>
            <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4, color: s.n <= step ? 'var(--ink)' : 'var(--muted)' }}>
              <L en={s.en} ar={s.ar} />
            </span>
          </button>
        ))}
      </div>

      {step === 1 ? (
        <div style={{ maxWidth: 900 }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Facility profile" ar="ملف المنشأة" />
          </h2>
          <div data-region="profile-form" style={{ padding: '31px 33px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 18 }}>
            {content.profileFields.flatMap((f) => {
              const base = field(f.key, f.en, f.ar);
              if (!('bilingual' in f) || !f.bilingual) return [base];
              return [base, field(`${f.key}Ar`, `${f.en} (Arabic)`, `${f.ar} (بالعربية)`, 'rtl')];
            })}
          </div>
          <div data-region="crew-callout" style={{ padding: '30px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 24 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
              <L en={content.crewCallout.labelEn} ar={content.crewCallout.labelAr} />
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.7, maxWidth: '74ch' }}>
              <L en={content.crewCallout.en} ar={content.crewCallout.ar} />
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
              {content.accessFields.map((f) =>
                field(f.key, f.en, f.ar, undefined, ('hintEn' in f ? f.hintEn : undefined) as string | undefined, ('hintAr' in f ? f.hintAr : undefined) as string | undefined),
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            <L en="Continue to the category" ar="المتابعة إلى الفئة" />
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ maxWidth: 920 }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Category, and what it requires" ar="الفئة وما تقتضيه" />
          </h2>
          {/* The determination-not-a-form explainer left this step (partner ruling,
              second sweep): picking a category shows the applicable rule itself. */}
          <div data-region="category-options" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockEnd: 28 }}>
            {FACILITY_CATEGORIES.map((raw, i) => {
              const c = governed(raw.key) ?? raw;
              const chip = CHIP[c.state];
              const on = catKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCatKey(c.key)}
                  style={{ textAlign: 'start', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: on ? 'var(--surface)' : 'transparent', border: `1px solid ${on ? chip.border : 'var(--line)'}`, borderRadius: 16, cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                    <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{i + 1}</span>
                    <span style={{ fontSize: '15.5px', lineHeight: 1.55 }}>
                      <L en={c.en} ar={c.ar} />
                    </span>
                  </span>
                  <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: chip.bg, color: chip.color, fontSize: '12.5px' }}>
                    <L en={chip.en} ar={chip.ar} />
                  </span>
                </button>
              );
            })}
          </div>

          {picked ? (
            <div>
              <div data-region="determination" style={{ padding: '32px 36px', background: 'var(--surface)', border: `1px solid ${CHIP[picked.state].border}`, borderRadius: 16, marginBlockEnd: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockEnd: 16 }}>
                  <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <L en="The applicable rule" ar="القاعدة المنطبقة" />
                  </span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: CHIP[picked.state].bg, color: CHIP[picked.state].color, fontSize: '12.5px' }}>
                    <L en={CHIP[picked.state].en} ar={CHIP[picked.state].ar} />
                  </span>
                </div>
                <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.5, marginBlockEnd: 20, maxWidth: '64ch' }}>
                  <L en={picked.ruleEn} ar={picked.ruleAr} />
                </div>
                <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
                  <L en="On what basis" ar="على أي أساس" />
                </div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, maxWidth: '70ch' }}>
                  <L en={picked.basisEn} ar={picked.basisAr} />
                </p>
              </div>

              {ended ? (
                <div data-region="journey-ends" style={{ padding: '32px 36px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 16 }}>
                  <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 12 }}>
                    <L en="Waiting on the Ministry" ar="بانتظار الوزارة" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 16 }}>
                    <L en={picked.missingEn ?? ''} ar={picked.missingAr ?? ''} />
                  </div>
                  <p style={{ margin: '0 0 20px', fontSize: '15.5px', lineHeight: 1.75, maxWidth: '70ch' }}>
                    <L en={content.categoryUnset.en} ar={content.categoryUnset.ar} />
                  </p>
                  <form action={recordFacilityInterestAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <input type="hidden" name="category" value={picked.key} />
                    <input type="hidden" name="name" value={profile['name'] ?? ''} />
                    <button
                      type="submit"
                      style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}
                    >
                      <L en={content.categoryUnset.interestEn} ar={content.categoryUnset.interestAr} />
                    </button>
                    <a href="/dashboard" style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center' }}>
                      <L en="Back to the dashboard" ar="العودة إلى اللوحة" />
                    </a>
                  </form>
                </div>
              ) : null}

              {picked.alsoRecurringVenue ? (
                <div data-region="venue-cross" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 16 }}>
                  <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 12 }}>
                    <L en="This building may also be a recurring venue" ar="قد يكون هذا المبنى أيضاً موقع فعاليات دورياً" />
                  </div>
                  <p style={{ margin: '0 0 18px', fontSize: '15.5px', lineHeight: 1.7, maxWidth: '70ch' }}>
                    <L en={content.venueCross.en} ar={content.venueCross.ar} />
                  </p>
                  <a href="/venues/new" style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 21, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                    <L en="Register a recurring venue as well" ar="تسجيل موقع فعاليات متكرر أيضاً" />
                  </a>
                </div>
              ) : null}

              {!ended ? (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
                >
                  <L en="Continue to the coordinator" ar="المتابعة إلى المنسّق" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <form action={registerFacilityAction} style={{ maxWidth: 900 }}>
          {Object.entries(profile).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="category" value={catKey ?? ''} />
          <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Coordinator and responsible persons" ar="المنسّق والأشخاص المسؤولون" />
          </h2>
          {/* The name-or-position explainer left this step (partner ruling, second
              sweep): the field labels already say "Name or position". */}
          <div style={{ padding: '21px 25px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 24, maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
            <L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar} />
          </div>
          <div data-region="persons" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBlockEnd: 24 }}>
            {content.persons.map((p, i) => (
              <div key={p.key} style={{ paddingBlock: '27px', paddingInlineStart: '28px', paddingInlineEnd: '29px', background: 'var(--surface2)', borderInlineStart: `3px solid ${i === 0 ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 4 }}>
                  <L en={p.en} ar={p.ar} />
                </div>
                <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', marginBlockEnd: 18 }}>
                  <L en={p.noteEn} ar={p.noteAr} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
                  {content.personFields.map((f) => (
                    <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                        <L en={f.en} ar={f.ar} />
                      </span>
                      <input
                        name={`${p.key}${f.key === 'nameOrPosition' ? 'Name' : f.key === 'phone' ? 'Phone' : 'Email'}`}
                        required={p.key === 'coordinator' && f.key === 'nameOrPosition'}
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* The why-devices-come-first note left this step (partner ruling, second
              sweep): the order narrated internal plumbing. */}
          <button
            type="submit"
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            <L en="Continue to the device records" ar="المتابعة إلى سجلات الأجهزة" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
