import { InfoNote } from '../../../../../components/InfoNote';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../../components/Header';
import { L } from '../../../../../components/L';
import { IncidentForm } from './IncidentForm';
import { currentAccount, organizationFor } from '../../../../../lib/auth';
import { facilityDetail, facilityDevices, ministryConfig, unreadCountFor } from '../../../../../lib/queries';
import { siteEventChoices } from '../../../../../lib/site-registration';

/**
 * The facility cardiac-arrest incident report. Tri-state answers are the
 * source's own (Yes/No/Unknown, and Not applicable where it says so); the narrative
 * blocks submission while a personal name is detected -- in the screen and again on
 * the server (non-negotiable 7).
 */
export default async function IncidentReportPage({
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

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/facilities/${id}?tab=incidents`, en: 'Facility/site record', ar: 'سجل المنشأة/الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en={`${facility.nameEn} · ${facility.siteId ?? facility.id}`} ar={`${facility.nameAr} · ${facility.siteId ?? facility.id}`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Facility cardiac-arrest incident report" ar="تقرير حادثة توقف القلب في المرفق" />
           <InfoNote><L en="Filed after any suspected cardiac arrest, CPR attempt or AED use." ar="يُقدَّم بعد أي اشتباه بتوقف القلب أو محاولة إنعاش أو استخدام جهاز." /></InfoNote>
          </h1>

          {/* POWER 5's PUBLISHED REPORTING PROCEDURES, finally consumed (register
              closure, 2026-09-03): the value the cardiac console publishes under
              "reporting procedures" renders where reporting happens. Absent
              while unset -- nothing is in force, and the cardiac console is the
              surface that says so. */}
          {(() => {
            const procedures = ministryConfig().get('reportingProcedures') ?? null;
            if (!procedures) return null;
            return (
              <div data-region="reporting-procedures" style={{ padding: '15px 19px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 24, maxWidth: '84ch' }}>
                <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                  <L en="Reporting steps" ar="خطوات الإبلاغ" />
                </div>
                <div style={{ fontSize: '13.5px', lineHeight: 1.65 }}>{procedures.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBlockStart: 6, fontVariantNumeric: 'tabular-nums' }}>
                  <L
                    en={`${procedures.effective ? `Effective ${procedures.effective} · ` : ''}published ${procedures.publishedAt} by ${procedures.publishedBy}`}
                    ar={`${procedures.effective ? `يسري من ⁦${procedures.effective}⁩ · ` : ''}نُشر في ⁦${procedures.publishedAt}⁩ بواسطة ${procedures.publishedBy}`}
                  />
                </div>
              </div>
            );
          })()}
          <IncidentForm
            facilityId={facility.id}
            siteId={facility.siteId}
            devices={facilityDevices(facility.id).map((d) => ({ label: d.label, locationEn: d.locationEn, locationAr: d.locationAr || d.locationEn }))}
            events={facility.siteId ? siteEventChoices(facility.siteId, facility.isDemo) : []}
          />
        </div>
      </main>
    </>
  );
}
