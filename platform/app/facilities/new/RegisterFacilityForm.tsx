'use client';

/**
 * The facility/site's one-page intake (latest revision, 9 October 2026, sections 1 and 2):
 * the covered category first, then the persistent identity collected once -- the name, the
 * operating organization, the address and municipality, the validated map pin, the capacity
 * where relevant, the operating hours, the site's telephone and email, what a responding
 * crew needs, and the one responsible contact -- with one Continue onto the record's steps.
 *
 * The category is a DETERMINATION, not a form field (lib/rules/site.ts):
 *  - an objective category applies by itself;
 *  - an event-hosting venue applies at or above the published capacity threshold; below it,
 *    or while no threshold is published, the category does not reach the site and the
 *    Continue control is absent, not greyed (rule 10);
 *  - a designated category registers, but the applicant cannot designate itself: the screen
 *    says the category applies only once the Ministry records the designation.
 *
 * Continue stays active: pressing it with something unfilled says "Please fill: …", marks
 * every unfilled item and moves to the first. The server re-checks everything.
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
import { intakeEndsForCapacity, siteApplicability } from '../../../lib/rules/site';

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15 };
const refusedInput: React.CSSProperties = { ...input, border: '1px solid var(--bad)' };
const outlined: React.CSSProperties = { outline: '1px solid var(--bad)', outlineOffset: '6px', borderRadius: '12px' };
const h2: React.CSSProperties = { margin: '36px 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' };

const CHIP_BORDER: Record<StateChip, string> = {
  inForceNow: 'var(--brand)',
  partlyInForce: 'var(--accent)',
  awaitingMinistryValue: 'var(--accent)',
  determinedByReview: 'var(--line)',
};

/** What "Please fill" names, by field. */
const LABELS: Record<string, { en: string; ar: string }> = {
  name: { en: 'the facility/site name', ar: 'اسم المنشأة/الموقع' },
  operatingOrganization: { en: 'the operating organization', ar: 'الجهة المشغّلة' },
  address: { en: 'the address', ar: 'العنوان' },
  municipality: { en: 'the municipality', ar: 'البلدية' },
  hours: { en: 'the operating hours', ar: 'ساعات العمل' },
  phone: { en: 'the facility telephone', ar: 'هاتف المرفق' },
  email: { en: 'the facility email', ar: 'البريد الإلكتروني للمرفق' },
  capacity: { en: 'the capacity, as a whole number', ar: 'السعة، رقماً صحيحاً' },
  map: { en: 'the map pin, confirmed', ar: 'العلامة على الخريطة، مؤكَّدة' },
  accessPoint: { en: 'the main entrance or ambulance access point', ar: 'المدخل الرئيسي أو نقطة وصول خدمات الطوارئ الطبية' },
  emsNumber: { en: 'the EMS contact number', ar: 'رقم الاتصال بخدمات الطوارئ الطبية' },
  category: { en: 'the covered category', ar: 'الفئة المشمولة' },
  facilityType: { en: 'the facility type', ar: 'نوع المنشأة' },
  coordinatorName: { en: 'the responsible contact’s name or position', ar: 'اسم جهة الاتصال المسؤولة أو مسماها الوظيفي' },
  coordinatorPhone: { en: 'the responsible contact’s telephone', ar: 'هاتف جهة الاتصال المسؤولة' },
  coordinatorEmail: { en: 'the responsible contact’s email', ar: 'البريد الإلكتروني لجهة الاتصال المسؤولة' },
};

type Published = { value: string; effective: string | null } | null;

export function RegisterFacilityForm({
  published,
  eventVenueThreshold,
  today,
  fromVenue = null,
  me = null,
  organization = null,
}: {
  /** The person registering: the responsible contact starts as them. */
  me?: { name: string; phone: string; email: string } | null;
  /** The account's organization record: the operating organization starts as it. */
  organization?: { en: string; ar: string } | null;
  /** Started from a hosting venue: the site is the venue's, and its name and address start filled. */
  fromVenue?: { id: string; nameEn: string; nameAr: string; addressEn: string; addressAr: string } | null;
  /** What the Ministry has published (powers one and two, and the event-hosting threshold). */
  published: { phasedSchedule: Published; capacityThreshold: Published; eventVenueCapacity: Published };
  /** The event-hosting capacity threshold in force; null while none is. */
  eventVenueThreshold: number | null;
  /** Today, Asia/Beirut. */
  today: string;
}) {
  const content = FACILITY_CONTENT;
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [catKey, setCatKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    ...(fromVenue ? { name: fromVenue.nameEn, nameAr: fromVenue.nameAr, municipality: fromVenue.addressEn, municipalityAr: fromVenue.addressAr } : {}),
    ...(organization?.en ? { operatingOrganization: organization.en } : {}),
    ...(me?.phone ? { phone: me.phone } : {}),
    ...(me?.email ? { email: me.email } : {}),
    // The responsible contact starts as the person registering (owner, 9 October 2026).
    coordinatorName: me?.name ?? '', coordinatorPhone: me?.phone ?? '', coordinatorEmail: me?.email ?? '',
  });
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const governed = (key: string): FacilityCategory | null => categoryWithPublished(key, published, today);
  const picked: FacilityCategory | null = catKey === null ? null : governed(catKey);
  const capacity = (values['capacity'] ?? '').trim();
  const capacityNeeded = picked?.applicability === 'capacity';
  const reach = picked ? siteApplicability({ categoryKey: picked.key, capacity: /^\d+$/.test(capacity) ? Number(capacity) : null, threshold: eventVenueThreshold, designatedOn: null }) : null;
  const endedByCapacity = capacityNeeded && reach !== null && intakeEndsForCapacity(reach);
  const ended = picked !== null && categoryEndsJourney(picked);

  const filled = (k: string) => Boolean((values[k] ?? '').trim());
  const missing = [
    ...(catKey ? [] : ['category']),
    ...(catKey === 'transport' && !filled('facilityType') ? ['facilityType'] : []),
    ...['name', 'operatingOrganization', 'address', 'municipality', 'hours', 'phone', 'email'].filter((k) => !filled(k)),
    ...((capacity && !/^\d+$/.test(capacity)) || (capacityNeeded && !capacity) ? ['capacity'] : []),
    ...(point ? [] : ['map']),
    ...['accessPoint', 'emsNumber'].filter((k) => !filled(k)),
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
    // The capacity is required where the category is decided by it (an event-hosting venue).
    const capacityLabel = f.key === 'capacity' && capacityNeeded
      ? { en: 'Approved or licensed capacity (persons) — required for this category', ar: 'السعة المعتمدة أو المرخّصة (أشخاص) — مطلوبة لهذه الفئة' }
      : { en: f.en, ar: f.ar };
    const base = text(f.key, capacityLabel.en, capacityLabel.ar, { type: f.key === 'email' ? 'email' : f.key === 'capacity' ? 'number' : 'text', dir: f.key === 'email' ? 'ltr' : undefined, required: f.key !== 'capacity' || capacityNeeded });
    if (!('bilingual' in f) || !f.bilingual) return [base];
    return [base, text(`${f.key}Ar`, `${f.en} (Arabic)`, `${f.ar} (بالعربية)`, { dir: 'rtl', required: false })];
  };

  const goesOn = !ended && !endedByCapacity;

  return (
    <>
      <form action={registerFacilityAction} onSubmit={submit} noValidate data-region="facility-registration">
        {fromVenue ? <input type="hidden" name="fromVenue" value={fromVenue.id} /> : null}

        <h2 style={{ ...h2, marginBlockStart: 0 }}><L en="Select the covered category" ar="اختاروا الفئة المشمولة" /></h2>
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
                data-category={c.key}
                onClick={() => setCatKey(c.key)}
                style={{ textAlign: 'start', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', minHeight: 44, padding: '16px 22px', background: on ? 'var(--surface)' : 'transparent', border: `1px solid ${on ? CHIP_BORDER[c.state] : 'var(--line)'}`, borderRadius: 14, cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '15.5px', lineHeight: 1.5, fontWeight: 500 }}><L en={c.en} ar={c.ar} /></span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}><L en={c.detailEn} ar={c.detailAr} /></span>
                  </span>
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
              {TRANSPORT_FACILITY_TYPES.filter((t) => !t.legacy).map((t) => <option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}
            </select>
          </label>
        ) : null}

        {picked ? (
          <div data-region="determination" data-applicability={picked.applicability} style={{ padding: '26px 30px', background: 'var(--surface)', border: `1px solid ${picked.applicability === 'objective' ? CHIP_BORDER[picked.state] : 'var(--accent)'}`, borderRadius: 16, marginBlockEnd: 16 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 12 }}>
              <L en="The applicable rule" ar="القاعدة المنطبقة" />
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.5, maxWidth: '64ch' }}>
              <L en={picked.ruleEn} ar={picked.ruleAr} /> <InfoNote labelEn="Why this applies" labelAr="سبب الانطباق"><L en={picked.basisEn} ar={picked.basisAr} /></InfoNote>
            </div>
            {capacityNeeded && reach && reach.key !== 'covered' ? (
              <p data-region="capacity-determination" data-applicability={reach.key} style={{ margin: '12px 0 0', fontSize: '14.5px', lineHeight: 1.6 }}>
                <L en={reach.en} ar={reach.ar} />
              </p>
            ) : null}
          </div>
        ) : null}

        <h2 style={h2}><L en="Site profile" ar="ملف الموقع" /></h2>
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

        {goesOn ? (
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
            <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, marginBlockStart: 24, cursor: 'pointer' }}>
              <L en="Continue to requirements" ar="المتابعة إلى المتطلبات" />
            </button>
          </>
        ) : null}
      </form>

      {endedByCapacity && reach ? (
        <div data-region="capacity-ends" style={{ padding: '28px 32px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockStart: 24 }}>
          <p style={{ margin: '0 0 18px', fontSize: '15.5px', lineHeight: 1.7, maxWidth: '70ch' }}><L en={reach.en} ar={reach.ar} /></p>
          <a href="/dashboard" style={{ minHeight: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center' }}>
            <L en="Back to the dashboard" ar="العودة إلى اللوحة" />
          </a>
        </div>
      ) : null}

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
