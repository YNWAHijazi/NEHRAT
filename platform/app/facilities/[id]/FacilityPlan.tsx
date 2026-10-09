import Link from 'next/link';
import { InfoNote } from '../../../components/InfoNote';
import { L } from '../../../components/L';
import { PrintButton } from './PlanConfirmation';
import { FACILITY_CONTENT, facilityCategory } from '../../../lib/rules';
import type { FacilityDetail, FacilityDevice, FacilityPerson } from '../../../lib/queries';
import type { MapPoint } from '../../../lib/rules/geolocation';

/**
 * The cardiac emergency response plan, held on the platform as a structured record: the
 * immediate response procedure (the wall card, printable for the AED cabinet), the AED
 * section DERIVED from the registry and not editable here (ROADMAP 2d), the facility
 * information and the one responsible contact, read-only. The readiness confirmation is
 * the plan's own form and sits beside this (PlanConfirmation.tsx).
 *
 * Type sizes match the other record pages (partner audit): the wall card's steps read at
 * body size on screen and are enlarged only on paper (globals.css).
 */
export function FacilityPlan({ facility, devices, contact, point, aedsHref, contactHref }: {
  facility: FacilityDetail;
  devices: FacilityDevice[];
  contact: FacilityPerson | null;
  point: MapPoint | null;
  /** Where the AEDs are changed: the AED step or section on the record page. */
  aedsHref: string;
  /** Where the contact is edited. */
  contactHref: string;
}) {
  const content = FACILITY_CONTENT;
  const category = facilityCategory(facility.categoryKey);
  const accessible = devices.filter((d) => d.accessibleHours).length;
  const pediatricCount = devices.filter((d) => d.pediatric === 'yes').length;

  const derived: { en: string; ar: string; vEn: string; vAr: string }[] = [
    { en: 'An AED is available', ar: 'يتوفر جهاز إزالة رجفان خارجي آلي', vEn: devices.length ? 'Yes' : 'No', vAr: devices.length ? 'نعم' : 'لا' },
    { en: 'Number of AEDs', ar: 'عدد الأجهزة', vEn: String(devices.length), vAr: String(devices.length) },
    { en: 'Exact locations', ar: 'المواقع الدقيقة', vEn: devices.map((d) => d.locationEn).join(' · ') || '—', vAr: devices.map((d) => d.locationAr).join(' · ') || '—' },
    {
      en: 'Accessible during operating hours', ar: 'متاحة خلال ساعات العمل',
      vEn: devices.length === 0 ? '—' : accessible === devices.length ? 'Yes' : `${accessible} of ${devices.length}`,
      vAr: devices.length === 0 ? '—' : accessible === devices.length ? 'نعم' : `${accessible} من ${devices.length}`,
    },
    {
      en: 'Pediatric capability, where applicable', ar: 'خاصية الاستخدام للأطفال، عند الاقتضاء',
      vEn: devices.length === 0 ? '—' : pediatricCount === 0 ? 'None registered' : `On ${pediatricCount} of ${devices.length}`,
      vAr: devices.length === 0 ? '—' : pediatricCount === 0 ? 'غير مسجّلة' : `على ${pediatricCount} من ${devices.length}`,
    },
  ];

  const profileRows: { en: string; ar: string; vEn: string; vAr: string }[] = [
    { en: 'Facility name', ar: 'اسم المرفق', vEn: facility.nameEn, vAr: facility.nameAr },
    { en: 'Facility category', ar: 'فئة المرفق', vEn: category?.en ?? '', vAr: category?.ar ?? '' },
    { en: 'Address and municipality', ar: 'العنوان والبلدية', vEn: `${facility.address}, ${facility.municipalityEn}`, vAr: `${facility.address}، ${facility.municipalityAr}` },
    { en: 'Facility telephone', ar: 'هاتف المنشأة', vEn: facility.phone, vAr: facility.phone },
    { en: 'Facility email', ar: 'البريد الإلكتروني للمنشأة', vEn: facility.email, vAr: facility.email },
    { en: 'Operating hours', ar: 'ساعات العمل', vEn: facility.operatingHours, vAr: facility.operatingHours },
    { en: 'Main EMS entrance', ar: 'المدخل الرئيسي أو نقطة وصول خدمات الطوارئ الطبية', vEn: facility.accessPoint, vAr: facility.accessPoint },
    { en: 'EMS contact number used by the facility', ar: 'رقم الاتصال بخدمات الطوارئ الطبية المعتمد لدى المنشأة', vEn: facility.emsNumber, vAr: facility.emsNumber },
  ];

  const contactRows: { en: string; ar: string; v: string }[] = [
    { en: 'Name or position', ar: 'الاسم أو المسمى الوظيفي', v: contact?.nameOrPosition ?? '' },
    { en: 'Telephone', ar: 'رقم الهاتف', v: contact?.phone ?? '' },
    { en: 'Email', ar: 'البريد الإلكتروني', v: contact?.email ?? '' },
  ];

  const rowStyle: React.CSSProperties = { background: 'var(--bg)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '14.5px', lineHeight: 1.5 };
  const tableStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' };

  return (
    <div data-region="facility-plan">
      <div data-region="procedure" data-wallcard="" style={{ padding: 32, border: '2px solid var(--brand)', borderRadius: 16, background: 'var(--surface)', marginBlockEnd: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
            <L en="Immediate response procedure" ar="إجراءات الاستجابة الفورية" />
          </h3>
          <PrintButton />
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {content.procedure.map((p) => (
            <li key={p.n} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'baseline' }}>
              <span data-step-number="" style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand)', minWidth: 24, fontVariantNumeric: 'tabular-nums' }}>{p.n}</span>
              <span data-step-text="" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>
                <L en={p.en} ar={p.ar} />
              </span>
            </li>
          ))}
        </ol>
        <div style={{ marginBlockStart: 20, display: 'flex', flexWrap: 'wrap', gap: 28 }}>
          {content.emergencyNumbers.map((n) => (
            <div key={n.number}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en={n.en} ar={n.ar} />
              </div>
              <div data-emergency-number="" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' }}>{n.number}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 4 }}>
              <L en="EMS contact number used by the facility" ar="رقم الاتصال بخدمات الطوارئ الطبية المعتمد لدى المنشأة" />
            </div>
            <div data-emergency-number="" style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{facility.emsNumber}</div>
          </div>
        </div>
      </div>

      <div data-region="derived" style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="AED information" ar="معلومات جهاز إزالة الرجفان الخارجي الآلي" />
          </h3>
          <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12 }}>
            <L en="Derived from the registry" ar="مستمدة من السجل" />
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockStart: 12, marginBlockEnd: 18 }}>
          {derived.map((d) => (
            <div key={d.en} data-kv="" style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', fontSize: '14.5px' }}>
              <span style={{ color: 'var(--muted)' }}>
                <L en={d.en} ar={d.ar} />
              </span>
              <span style={{ textAlign: 'end', lineHeight: 1.5 }}>
                <L en={d.vEn} ar={d.vAr} />
              </span>
            </div>
          ))}
        </div>
        <a href={aedsHref} style={{ minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en="Open the AED registry to change any of this" ar="فتح سجل الأجهزة لتغيير أي من ذلك" />
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 24, marginBlockEnd: 24 }}>
        <div data-region="plan-profile" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
            <L en="Facility information" ar="معلومات المرفق" />
          </h3>
          <div style={tableStyle}>
            {profileRows.map((r) => (
              <div key={r.en} data-kv="" style={rowStyle}>
                <span style={{ color: 'var(--muted)' }}>
                  <L en={r.en} ar={r.ar} />
                </span>
                <span style={{ textAlign: 'end' }}>
                  <L en={r.vEn} ar={r.vAr} />
                </span>
              </div>
            ))}
          </div>
          {point ? (
            <p style={{ margin: '12px 0 0', fontSize: '13.5px' }}>
              <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}`} target="_blank" rel="noreferrer"><L en="View facility map" ar="عرض خريطة المنشأة" /></a>
            </p>
          ) : null}
        </div>

        {/* ONE responsible facility contact, read-only (partner audit, 2026-10-08). */}
        <div data-region="plan-contact" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 18 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              <L en="Responsible facility contact" ar="جهة الاتصال المسؤولة في المنشأة" />
              <InfoNote><L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar} /></InfoNote>
            </h3>
            <Link href={contactHref} style={{ minHeight: 44, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>
              <L en="Edit contact" ar="تعديل جهة الاتصال" />
            </Link>
          </div>
          <div style={tableStyle}>
            {contactRows.map((r) => (
              <div key={r.en} data-kv="" style={rowStyle}>
                <span style={{ color: 'var(--muted)' }}>
                  <L en={r.en} ar={r.ar} />
                </span>
                <span style={{ textAlign: 'end' }} dir="ltr">{r.v || '—'}</span>
              </div>
            ))}
          </div>
          {!contact?.nameOrPosition || !contact.phone || !contact.email ? (
            <p style={{ margin: '12px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="The responsible contact is incomplete. Add a name or position, telephone and email." ar="جهة الاتصال المسؤولة غير مكتملة. أضيفوا الاسم أو المسمى الوظيفي ورقم الهاتف والبريد الإلكتروني." />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
