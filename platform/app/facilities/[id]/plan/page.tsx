import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { PlanConfirmation, PersonsForm, PrintButton } from './PlanConfirmation';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  facilityDetail,
  facilityDevices,
  facilityPersons,
  facilityPlanConfirmation,
  unreadCountFor,
} from '../../../../lib/queries';
import { FACILITY_CONTENT, facilityCategory } from '../../../../lib/rules';

/**
 * The cardiac emergency response plan (step 5). Held on the platform as a
 * structured record: the facility information and responsible persons are the
 * facility's own records; the device section DERIVES from the registry and is not
 * editable here (ROADMAP 2d); the readiness confirmation is the plan's own form,
 * signed by the coordinator.
 */
export default async function FacilityPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const devices = facilityDevices(facility.id);
  const persons = facilityPersons(facility.id);
  const confirmation = facilityPlanConfirmation(facility.id);
  const content = FACILITY_CONTENT;
  const category = facilityCategory(facility.categoryKey);
  const coordinator = persons.find((p) => p.role === 'coordinator') ?? null;

  const accessible = devices.filter((d) => d.accessibleHours).length;
  const checks = [...devices.map((d) => d.latestCheck).filter((c): c is string => c !== null)];
  const latestCheck = checks.length ? checks.reduce((a, b) => (a > b ? a : b)) : null;
  const pediatricCount = devices.filter((d) => d.pediatric === 'yes').length;

  const derived: { en: string; ar: string; vEn: string; vAr: string }[] = [
    { en: 'A defibrillator is available', ar: 'يتوفر جهاز إزالة رجفان', vEn: devices.length ? 'Yes' : 'No', vAr: devices.length ? 'نعم' : 'لا' },
    { en: 'Number registered', ar: 'العدد المسجَّل', vEn: String(devices.length), vAr: String(devices.length) },
    { en: 'Exact locations', ar: 'المواقع الدقيقة', vEn: devices.map((d) => d.locationEn).join(' · ') || '—', vAr: devices.map((d) => d.locationAr).join(' · ') || '—' },
    {
      en: 'Accessible during operating hours', ar: 'متاحة خلال ساعات العمل',
      vEn: devices.length === 0 ? '—' : accessible === devices.length ? 'Yes' : `${accessible} of ${devices.length}`,
      vAr: devices.length === 0 ? '—' : accessible === devices.length ? 'نعم' : `${accessible} من ${devices.length}`,
    },
    { en: 'Latest readiness check', ar: 'آخر فحص للجاهزية', vEn: latestCheck ?? '—', vAr: latestCheck ? `⁦${latestCheck}⁩` : '—' },
    {
      en: 'Pediatric capability', ar: 'خاصية الاستخدام للأطفال',
      vEn: devices.length === 0 ? '—' : pediatricCount === 0 ? 'None registered' : `On ${pediatricCount} of ${devices.length}`,
      vAr: devices.length === 0 ? '—' : pediatricCount === 0 ? 'غير مسجّلة' : `على ${pediatricCount} من ${devices.length}`,
    },
  ];

  const profileRows: { en: string; ar: string; vEn: string; vAr: string }[] = [
    { en: 'Facility name', ar: 'اسم المرفق', vEn: facility.nameEn, vAr: facility.nameAr },
    { en: 'Facility category', ar: 'فئة المرفق', vEn: category?.en ?? '', vAr: category?.ar ?? '' },
    { en: 'Address and municipality', ar: 'العنوان والبلدية', vEn: `${facility.address}, ${facility.municipalityEn}`, vAr: `${facility.address}، ${facility.municipalityAr}` },
    { en: 'Operating hours', ar: 'ساعات العمل', vEn: facility.operatingHours, vAr: facility.operatingHours },
    { en: 'Main EMS entrance', ar: 'المدخل الرئيسي أو نقطة وصول خدمات الطوارئ الطبية', vEn: facility.accessPoint, vAr: facility.accessPoint },
    { en: 'EMS contact number used', ar: 'رقم خدمات الطوارئ الطبية المعتمد', vEn: facility.emsNumber, vAr: facility.emsNumber },
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/facilities/${id}`, en: 'Facility record', ar: 'سجل المنشأة' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en={`${facility.nameEn} · ${facility.id}`} ar={`${facility.nameAr} · ${facility.id}`} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Cardiac emergency response plan" ar={content.planTitle.ar} />
        </h1>
        <p style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', maxWidth: '80ch' }}>
          <L
            en="Update it whenever responsible persons, AED locations or emergency arrangements change."
            ar="حدّثوها عند تغيّر الأشخاص المسؤولين أو مواقع الأجهزة أو الترتيبات الطارئة."
          />
        </p>

        <div data-region="procedure" data-wallcard="" style={{ padding: 36, border: '2px solid var(--brand)', borderRadius: 16, background: 'var(--surface)', marginBlockEnd: 44 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 26 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Immediate response procedure" ar="إجراءات الاستجابة الفورية" />
            </h2>
            <PrintButton />
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {content.procedure.map((p) => (
              <li key={p.n} style={{ background: 'var(--bg)', padding: '18px 22px', display: 'flex', gap: 20, alignItems: 'baseline' }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--brand)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>{p.n}</span>
                <span style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.4 }}>
                  <L en={p.en} ar={p.ar} />
                </span>
              </li>
            ))}
          </ol>
          <div style={{ marginBlockStart: 22, display: 'flex', flexWrap: 'wrap', gap: 32 }}>
            {content.emergencyNumbers.map((n) => (
              <div key={n.number}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 4 }}>
                  <L en={n.en} ar={n.ar} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--accent-ink)' }}>{n.number}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en="Facility EMS number" ar="رقم خدمات الطوارئ الطبية المعتمد" />
              </div>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{facility.emsNumber}</div>
            </div>
          </div>
        </div>

        <div data-region="derived" style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Defibrillator information" ar="معلومات جهاز إزالة الرجفان الخارجي الآلي" />
            </h2>
            <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12 }}>
              <L en="Derived from the registry" ar="مستمدة من السجل" />
            </span>
          </div>
          {/* The cannot-drift-apart paragraph left this section (partner ruling,
              second sweep): the chip says the values derive, and the link below
              says where to change them. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockStart: 12, marginBlockEnd: 18 }}>
            {derived.map((d) => (
              <div key={d.en} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', fontSize: '14.5px' }}>
                <span style={{ color: 'var(--muted)' }}>
                  <L en={d.en} ar={d.ar} />
                </span>
                <span style={{ textAlign: 'end', lineHeight: 1.5 }}>
                  <L en={d.vEn} ar={d.vAr} />
                </span>
              </div>
            ))}
          </div>
          <Link
            href={`/facilities/${facility.id}/devices`}
            style={{ height: 40, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 20, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}
          >
            <L en="Open the device registry to change any of this" ar="فتح سجل الأجهزة لتغيير أي من ذلك" />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24, marginBlockEnd: 44 }}>
          <div data-region="plan-profile" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600 }}>
              <L en="Facility information" ar="معلومات المرفق" />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {profileRows.map((r) => (
                <div key={r.en} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '14.5px', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--muted)' }}>
                    <L en={r.en} ar={r.ar} />
                  </span>
                  <span style={{ textAlign: 'end' }}>
                    <L en={r.vEn} ar={r.vAr} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div data-region="plan-persons" id="persons" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
              <L en="Responsible persons" ar="الأشخاص المسؤولون" />
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
              <L en={content.coordinatorOneRecord.en} ar={content.coordinatorOneRecord.ar} />
            </p>
            <PersonsForm facilityId={facility.id} persons={persons} />
          </div>
        </div>

        <PlanConfirmation
          facilityId={facility.id}
          coordinatorName={coordinator?.nameOrPosition ?? ''}
          existing={confirmation}
        />

      </main>
    </>
  );
}
