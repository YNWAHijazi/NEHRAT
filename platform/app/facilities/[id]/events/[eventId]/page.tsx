import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../../components/Header';
import { L } from '../../../../../components/L';
import { MinistryMasthead } from '../../../../../components/MinistryMasthead';
import { currentAccount, organizationFor } from '../../../../../lib/auth';
import { facilityDetail, unreadCountFor } from '../../../../../lib/queries';
import { siteEventReceipt } from '../../../../../lib/site-registration';
import { PrintBar } from '../../../../events/[id]/acknowledgment/PrintBar';

const upLabel: React.CSSProperties = { fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' };

/**
 * THE SITE OWNER'S RECEIPT FOR AN EVENT SCHEDULED AT THE SITE (owner, 10 October 2026: "after it
 * is accepted they would see the receipt that this event has been accepted and is scheduled").
 * Printable. The event's name, dates, record id and Ministry reference, and the date the Ministry
 * completed its review -- never the organizer's contacts, documents or answers, and never the
 * event outcomes in their own words (the facility side carries none).
 *
 * Owner of the facility only, and only once the event is scheduled: anything else is a 404.
 */
export default async function SiteEventReceiptPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id, eventId } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const receipt = siteEventReceipt(id, eventId);
  if (!receipt) notFound();
  const dates = receipt.startDate && receipt.endDate && receipt.endDate !== receipt.startDate ? `${receipt.startDate} – ${receipt.endDate}` : receipt.startDate ?? '—';

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack={true} back={{ href: `/facilities/${id}?tab=events`, en: 'Events at this site', ar: 'الفعاليات في هذا الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Event scheduled at your site" ar="فعالية مُجدولة في موقعكم" />
        </h1>
        <div data-wallcard="" data-region="site-event-receipt" style={{ maxWidth: 820, marginBlock: 34, padding: '48px 52px', background: 'var(--surface2)', borderRadius: 4 }}>
          <MinistryMasthead />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '24px 32px', paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
            {[
              { key: 'event', en: 'Event', ar: 'الفعالية', vEn: receipt.nameEn, vAr: receipt.nameAr },
              { key: 'dates', en: 'Dates', ar: 'التواريخ', vEn: dates, vAr: `⁦${dates}⁩` },
              { key: 'site', en: 'Facility/site', ar: 'المنشأة/الموقع', vEn: `${facility.nameEn} · ${facility.siteId ?? id}`, vAr: `${facility.nameAr || facility.nameEn} · ⁦${facility.siteId ?? id}⁩` },
              { key: 'record', en: 'Event record ID', ar: 'معرّف سجل الفعالية', vEn: receipt.id, vAr: receipt.id },
              { key: 'reference', en: 'Ministry reference', ar: 'مرجع الوزارة', vEn: receipt.reference ?? '—', vAr: receipt.reference ?? '—' },
              { key: 'reviewed', en: 'Ministry review completed', ar: 'اكتملت مراجعة الوزارة', vEn: receipt.reviewedOn, vAr: `⁦${receipt.reviewedOn}⁩` },
            ].map((f) => (
              <div key={f.key} data-fact={f.key}>
                <div style={{ ...upLabel, letterSpacing: '.06em', marginBlockEnd: 6 }}><L en={f.en} ar={f.ar} /></div>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}><L en={f.vEn} ar={f.vAr} /></div>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, paddingBlockStart: 26, fontSize: 15.5, lineHeight: 1.7, maxWidth: '70ch' }}>
            <L en={`The Ministry has completed its review of this event's health and medical preparedness. The event is scheduled at this site on ${dates}.`}
              ar={`أكملت الوزارة مراجعة تأهب هذه الفعالية الصحي والطبي. والفعالية مُجدولة في هذا الموقع بتاريخ ⁦${dates}⁩.`} />
          </p>
        </div>
        <PrintBar />
      </main>
    </>
  );
}
