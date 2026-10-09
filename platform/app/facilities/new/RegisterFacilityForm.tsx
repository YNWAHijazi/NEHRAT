'use client';

/**
 * The facility's one-page intake, laid out like the hosting venue's (owner, 9 October
 * 2026): the facility profile and its map pin, what a responding crew needs, the category
 * determination and the one responsible contact (partner audit, 2026-10-08), with one
 * Continue. Continue creates the facility and lands on its record, where the AEDs, the
 * response plan and the confirmation that completes the registration are the steps.
 *
 * The category is a DETERMINATION, not a form field: lib/rules says which of the four
 * state chips applies and whether the journey ends (categoryEndsJourney). Where it ends,
 * the ONLY actions are Record an interest and Back to the dashboard -- the contact and
 * Continue are absent, not greyed (rule 10). A school must leave understanding it has done
 * everything available to it.
 *
 * Continue stays active: pressing it with something unfilled says "Please fill: …", marks
 * every unfilled item and moves to the first, as on the venue's form. The server re-checks
 * everything (registerFacilityAction).
 */

import { useState } from 'react';
import { PhoneInput } from '../../../components/PhoneInput';
import { OptionText } from '../../../components/OptionText';
import { InfoNote } from '../../../components/InfoNote';
import { UseMyDetails } from '../../../components/UseMyDetails';
import { LocationPicker } from '../../../components/maps/LocationPicker';
import { TRANSPORT_FACILITY_TYPES } from '../../../lib/rules/facility-intake';
import type { MapPoint } from '../../../lib/rules/geolocation';
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

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15 };
const refusedInput: React.CSSProperties = { ...input, border: '1px solid var(--bad)' };
const outlined: React.CSSProperties = { outline: '1px solid var(--bad)', outlineOffset: '6px', borderRadius: '12px' };
const h2: React.CSSProperties = { margin: '36px 0 16px', fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' };

const CHIP_BORDER: Record<StateChip, string> = {
  inForceNow: 'var(--brand)',
  partlyInForce: 'var(--accent)',
  awaitingMinistryValue: 'var(--accent)',
  determinedByReview: 'var(--line)',
};

/** What "Please fill" names, by field. */
const LABELS: Record<string, { en: string; ar: string }> = {
  name: { en: 'the facility name', ar: 'اسم المرفق' },
  address: { en: 'the address', ar: 'العنوان' },
  municipality: { en: 'the municipality', ar: 'البلدية' },
  hours: { en: 'the operating hours', ar: 'ساعات العمل' },
  phone: { en: 'the facility telephone', ar: 'هاتف المرفق' },
  email: { en: 'the facility email', ar: 'البريد الإلكتروني للمرفق' },
  capacity: { en: 'the capacity, as a whole number', ar: 'السعة، رقماً صحيحاً' },
  map: { en: 'the map pin, confirmed', ar: 'العلامة على الخريطة، مؤكَّدة' },
  accessPoint: { en: 'the main entrance or ambulance access point', ar: 'المدخل الرئيسي أو نقطة وصول خدمات الطوارئ الطبية' },
  emsNumber: { en: 'the EMS contact number', ar: 'رقم الاتصال بخدمات الطوارئ الطبية' },
  category: { en: 'the type of facility', ar: 'نوع المرفق' },
  facilityType: { en: 'the facility type', ar: 'نوع المنشأة' },
  coordinatorName: { en: 'the responsible contact’s name or position', ar: 'اسم جهة الاتصال المسؤولة أو مسماها الوظيفي' },
  coordinatorPhone: { en: 'the responsible contact’s telephone', ar: 'هاتف جهة الاتصال المسؤولة' },
  coordinatorEmail: { en: 'the responsible contact’s email', ar: 'البريد الإلكتروني لجهة الاتصال المسؤولة' },
};

export function RegisterFacilityForm({
  published,
  fromVenue = null,
  me = null,
}: {
  /** The person registering: the responsible contact starts as them. */
  me?: { name: string; phone: string; email: string } | null;
  /** Started from a hosting venue's PAD and AED step: the facility stands on the venue's site, and its name and address start filled. */
  fromVenue?: { id: string; nameEn: string; nameAr: string; addressEn: string; addressAr: string } | null;
  /** What the Ministry has published (powers one and two); governs the category states. */
  published: { phasedSchedule: { value: string; effective: string | null } | null; capacityThreshold: { value: string; effective: string | null } | null };
}) {
  const content = FACILITY_CONTENT;
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [catKey, setCatKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    ...(fromVenue ? { name: fromVenue.nameEn, nameAr: fromVenue.nameAr, municipality: fromVenue.addressEn, municipalityAr: fromVenue.addressAr } : {}),
    ...(me?.phone ? { phone: me.phone } : {}),
    ...(me?.email ? { email: me.email } : {}),
    // The responsible contact starts as the person registering (owner, 9 October 2026).
    coordinatorName: me?.name ?? '', coordinatorPhone: me?.phone ?? '', coordinatorEmail: me?.email ?? '',
  });
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const governed = (key: string): FacilityCategory | null => categoryWithPublished(key, published);
  const picked: FacilityCategory | null = catKey === null ? null : governed(catKey);
  const ended = picked !== null && categoryEndsJourney(picked);

  const filled = (k: string) => Boolean((values[k] ?? '').trim());
  const capacity = (values['capacity'] ?? '').trim();
  const missing = [
    ...['name', 'address', 'municipality', 'hours', 'phone', 'email'].filter((k) => !filled(k)),
    ...(capacity && !/^\d+$/.test(capacity) ? ['capacity'] : []),
    ...(point ? [] : ['map']),
    ...['accessPoint', 'emsNumber'].filter((k) => !filled(k)),
    ...(catKey ? [] : ['category']),
    ...(catKey === 'transport' && !filled('facilityType') ? ['facilityType'] : []),
    ...['coordinatorName', 'coordinatorPhone', 'coordinatorEmail'].filter((k) => !filled(k)),
  ].map((k) => ({ key: k, ...LABELS[k]! }));
  const flagged = (k: string) => checked && missing.some((m) => m.key === k);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    if (missing.length === 0) return;
    e.preventDefault();
    setChecked(true);
    requestAnimationFrame(() => {
      const k = missing[0]!.key;
      const el = document.querySelector<HTMLElement>(`[data-region="facility-registration"] [name="${k}Number"], [data-region="facility-registration"] [name="${k}"]:not([type="hidden"]), [data-missing-anchor="${k}"]`);
      el?.focus({ preventScroll: true });
      document.querySelector('[data-region="please-fill"]')?.scrollIntoView({ block: 'center' });
    });
  };

  const label = (en: string, ar: string) => <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.45 }}><L en={en} ar={ar} /></span>;
  const text = (key: string, en: string, ar: string, opts: { dir?: 'rtl' | 'ltr' | undefined; type?: string; required?: boolean } = {}) => (
    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label(en, ar)}
      <input name={key} type={opts.type ?? 'text'} value={values[key] ?? ''} onChange={(e) => set(key, e.target.value)} required={opts.required ?? true}
        dir={opts.dir} aria-invalid={flagged(key) || undefined} style={flagged(key) ? refusedInput : input} />
    </label>
  );

  // A field is a text input unless the data gives it choices (partner ruling, 2026-09-05:
  // operating hours is chosen, not typed) -- then a select, storing the option's English.
  const profileField = (f: (typeof content.profileFields)[number]) => {
    const options = ('options' in f ? f.options : undefined) as { en: string; ar: string }[] | undefined;
    if (f.key === 'phone') {
      return (
        <label key={f.key} data-missing-anchor="phone" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {label(f.en, f.ar)}
          <PhoneInput name="phone" value={values['phone'] ?? ''} onChange={(v) => set('phone', v)} required invalid={flagged('phone')} />
        </label>
      );
    }
    if (options) {
      return (
        <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {label(f.en, f.ar)}
          <select name={f.key} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} required aria-invalid={flagged(f.key) || undefined} style={{ ...(flagged(f.key) ? refusedInput : input), paddingInlineEnd: 34 }}>
            <option value=""></option>
            {options.map((o) => <option key={o.en} value={o.en}><OptionText en={o.en} ar={o.ar} /></option>)}
          </select>
        </label>
      );
    }
    const base = text(f.key, f.en, f.ar, { type: f.key === 'email' ? 'email' : f.key === 'capacity' ? 'number' : 'text', dir: f.key === 'email' ? 'ltr' : undefined, required: f.key !== 'capacity' });
    if (!('bilingual' in f) || !f.bilingual) return [base];
    return [base, text(`${f.key}Ar`, `${f.en} (Arabic)`, `${f.ar} (بالعربية)`, { dir: 'rtl', required: false })];
  };

  return (
    <>
      <form action={registerFacilityAction} onSubmit={submit} noValidate data-region="facility-registration">
        {fromVenue ? <input type="hidden" name="fromVenue" value={fromVenue.id} /> : null}

        <h2 style={{ ...h2, marginBlockStart: 0 }}><L en="Facility profile" ar="ملف المنشأة" /></h2>
        <div data-region="profile-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 18 }}>
          {content.profileFields.flatMap(profileField)}
        </div>
        <div data-missing-anchor="map" tabIndex={-1} aria-invalid={flagged('map') || undefined} style={flagged('map') ? outlined : undefined}>
          <LocationPicker initial={point} onChange={setPoint} />
        </div>

        <div data-region="crew-callout" style={{ padding: '24px 26px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockStart: 12 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
            <L en={content.crewCallout.labelEn} ar={content.crewCallout.labelAr} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 18 }}>
            {content.accessFields.map((f) => text(f.key, f.en, f.ar))}
          </div>
        </div>

        <h2 style={h2}><L en="Select the type of facility" ar="اختاروا نوع المرفق" /></h2>
        <input type="hidden" name="category" value={catKey ?? ''} />
        <div data-region="category-options" data-missing-anchor="category" tabIndex={-1} aria-invalid={flagged('category') || undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockEnd: 20, ...(flagged('category') ? outlined : {}) }}>
          {FACILITY_CATEGORIES.map((raw, i) => {
            const c = governed(raw.key) ?? raw;
            const on = catKey === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setCatKey(c.key)}
                style={{ textAlign: 'start', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', minHeight: 44, padding: '16px 22px', background: on ? 'var(--surface)' : 'transparent', border: `1px solid ${on ? CHIP_BORDER[c.state] : 'var(--line)'}`, borderRadius: 14, cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: '15.5px', lineHeight: 1.55 }}><L en={c.en} ar={c.ar} /></span>
                </span>
              </button>
            );
          })}
        </div>

        {catKey === 'transport' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 20, maxWidth: 420 }}>
            {label('Facility type', 'نوع المنشأة')}
            <select name="facilityType" value={values['facilityType'] ?? ''} onChange={(e) => set('facilityType', e.target.value)} required aria-invalid={flagged('facilityType') || undefined} style={flagged('facilityType') ? refusedInput : input}>
              <option value=""></option>
              {TRANSPORT_FACILITY_TYPES.map((t) => <option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}
            </select>
          </label>
        ) : null}

        {picked ? (
          <div data-region="determination" style={{ padding: '26px 30px', background: 'var(--surface)', border: `1px solid ${CHIP_BORDER[picked.state]}`, borderRadius: 16, marginBlockEnd: 16 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
              <L en="The applicable rule" ar="القاعدة المنطبقة" />
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.5, maxWidth: '64ch' }}>
              <L en={picked.ruleEn} ar={picked.ruleAr} /> <InfoNote labelEn="Why this applies" labelAr="سبب الانطباق"><L en={picked.basisEn} ar={picked.basisAr} /></InfoNote>
            </div>
          </div>
        ) : null}

        {!ended ? (
          <>
            <h2 style={h2}>
              <L en="Responsible contact" ar="جهة الاتصال المسؤولة" /> <InfoNote><L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar} /></InfoNote>
            </h2>
            <div data-region="persons" style={{ paddingBlock: '24px', paddingInlineStart: '26px', paddingInlineEnd: '26px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBlockEnd: 12 }}>
                <L en={content.persons[0]!.en} ar={content.persons[0]!.ar} /> <InfoNote><L en={content.persons[0]!.noteEn} ar={content.persons[0]!.noteAr} /></InfoNote>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 16 }}>
                {content.personFields.map((f) => f.key === 'phone' ? (
                  <label key={f.key} data-missing-anchor="coordinatorPhone" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {label(f.en, f.ar)}
                    <PhoneInput name="coordinatorPhone" value={values['coordinatorPhone'] ?? ''} onChange={(v) => set('coordinatorPhone', v)} required invalid={flagged('coordinatorPhone')} />
                  </label>
                ) : text(f.key === 'nameOrPosition' ? 'coordinatorName' : 'coordinatorEmail', f.en, f.ar, f.key === 'email' ? { type: 'email', dir: 'ltr' } : {}))}
              </div>
              {me && (me.name || me.phone || me.email) && (values['coordinatorName'] !== me.name || values['coordinatorPhone'] !== me.phone || values['coordinatorEmail'] !== me.email) ? (
                <div style={{ marginBlockStart: 8 }}>
                  <UseMyDetails onUse={() => setValues((v) => ({ ...v, coordinatorName: me.name || v['coordinatorName'] || '', coordinatorPhone: me.phone || v['coordinatorPhone'] || '', coordinatorEmail: me.email || v['coordinatorEmail'] || '' }))} />
                </div>
              ) : null}
            </div>

            {checked && missing.length ? (
              <p data-region="please-fill" role="alert" style={{ margin: '24px 0 0', padding: '12px 16px', border: '1px solid var(--bad)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.55 }}>
                <L en={`Please fill: ${missing.map((m) => m.en).join(', ')}.`} ar={`يرجى تعبئة: ${missing.map((m) => m.ar).join('، ')}.`} />
              </p>
            ) : null}
            <button type="submit" style={{ minHeight: 48, padding: '12px 26px', border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, marginBlockStart: 24, cursor: 'pointer' }}>
              <L en="Continue to the AEDs" ar="المتابعة إلى الأجهزة" />
            </button>
          </>
        ) : null}
      </form>

      {ended && picked ? (
        <div data-region="journey-ends" style={{ padding: '32px 36px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockStart: 8 }}>
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
            <input type="hidden" name="name" value={values['name'] ?? ''} />
            <button type="submit" style={{ minHeight: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
              <L en={content.categoryUnset.interestEn} ar={content.categoryUnset.interestAr} />
            </button>
            <a href="/dashboard" style={{ minHeight: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center' }}>
              <L en="Back to the dashboard" ar="العودة إلى اللوحة" />
            </a>
          </form>
        </div>
      ) : null}
    </>
  );
}
