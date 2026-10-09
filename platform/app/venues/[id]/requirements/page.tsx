import { GovernmentBand, Header } from '../../../../components/Header';
import { RequirementList } from '../../../../components/record/RequirementList';
import { L } from '../../../../components/L';
import { organizationFor } from '../../../../lib/auth';
import { unreadCountFor } from '../../../../lib/queries';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { VenueRetiredNotice } from '../../../../components/venue/VenueRetiredNotice';

/** The venue's requirement list on one printable page: the "download" its record page offers (owner direction, 2026-10-07). */
export default async function VenueRequirementList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-no-print=""><VenueRetiredNotice venueId={id} accountId={account.id} /></div>
        {w.record && w.level !== null ? (
          <RequirementList record={w.record} nameEn={w.venue.nameEn} nameAr={w.venue.nameAr} backHref={`/venues/${id}`} />
        ) : (
          <p role="status" style={{ fontSize: 15 }}><L en="Complete the assessment first: the level sets the requirements." ar="أكملوا التقييم أولاً: يحدّد المستوى المتطلبات." /></p>
        )}
      </main>
    </>
  );
}
