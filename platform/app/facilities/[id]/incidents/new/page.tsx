import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../../components/Header';
import { L } from '../../../../../components/L';
import { IncidentForm } from './IncidentForm';
import { currentAccount, organizationFor } from '../../../../../lib/auth';
import { facilityDetail, facilityPersons, unreadCountFor } from '../../../../../lib/queries';

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
  const coordinator = facilityPersons(facility.id).find((p) => p.role === 'coordinator') ?? null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/facilities/${id}`, en: 'Facility record', ar: 'سجل المنشأة' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en={`${facility.nameEn} · ${facility.id}`} ar={`${facility.nameAr} · ${facility.id}`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Facility cardiac-arrest incident report" ar="تقرير حادثة توقف القلب في المرفق" />
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 16, color: 'var(--muted)' }}>
            <L en="Filed after any suspected cardiac arrest, CPR attempt or AED use." ar="يُقدَّم بعد أي اشتباه بتوقف القلب أو محاولة إنعاش أو استخدام جهاز." />
          </p>
          <IncidentForm
            facilityId={facility.id}
            coordinatorName={coordinator?.nameOrPosition ?? ''}
            coordinatorPhone={coordinator?.phone ?? ''}
            coordinatorEmail={coordinator?.email ?? ''}
          />
        </div>
      </main>
    </>
  );
}
