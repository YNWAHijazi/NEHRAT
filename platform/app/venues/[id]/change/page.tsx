import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { VenueChangeForm } from './VenueChangeForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { unreadCountFor, venueById, venueChangesFor } from '../../../../lib/queries';
import { VENUE_CHANGE_ASPECTS } from '../../../../lib/rules';

/**
 * Report a venue change. The five reassessment circumstances are data; reporting the
 * change never satisfies the reassessment -- the panel says so and routes to it.
 */
export default async function VenueChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const venue = venueById(account.id, id);
  if (!venue) notFound();
  const { notice } = await searchParams;

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const changes = venueChangesFor(account.id, venue.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/venues/${id}`, en: 'Venue record', ar: 'سجل الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            {venue.validUntil ? (
              <L en={`${venue.nameEn} · valid through ${venue.validUntil}`} ar={`${venue.nameAr} · صالح حتى ⁦${venue.validUntil}⁩`} />
            ) : (
              <L en={venue.nameEn} ar={venue.nameAr} />
            )}
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Report a venue change" ar="الإبلاغ عن تغيير في الموقع" />
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
            <L
              en="A change to any of these requires a new assessment before it takes effect."
              ar="أي تغيير في أحد هذه الجوانب يستوجب تقييماً جديداً قبل أن يسري."
            />
          </p>

          {notice === 'reported' ? (
            <div style={{ padding: '20px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 20, fontSize: 15, lineHeight: 1.6 }}>
              <L
                en="The change has been reported to the Ministry. The reassessment is now open, and the current classification stands until the new assessment is recorded."
                ar="أُبلغت الوزارة بالتغيير. أصبحت إعادة التقييم مفتوحة الآن، ويبقى التصنيف الحالي سارياً إلى أن يُسجَّل التقييم الجديد."
              />
            </div>
          ) : null}

          <VenueChangeForm venueId={venue.id} aspects={[...VENUE_CHANGE_ASPECTS]} />

          {changes.length > 0 ? (
            <>
              <h2 style={{ margin: '36px 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                <L en="Reported changes" ar="التغييرات المبلَّغ عنها" />
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                {changes.map((c) => (
                  <div key={c.id} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14.5px' }}>{c.description}</span>
                    <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{c.reportedAt.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

      </main>
    </>
  );
}
