import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { RequirementList } from '../../../../components/record/RequirementList';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { eventFor, unreadCountFor } from '../../../../lib/queries';
import { eventRecordRequirements } from '../../../../lib/record-facts';

/**
 * The event's requirement list on one printable page: the "download" the record page
 * offers (owner direction, 2026-10-07). The Requirements tab this route once carried
 * became the record page itself.
 */
export default async function EventRequirementList({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  const record = event ? eventRecordRequirements(account.id, id) : null;
  if (!event || !record) notFound();
  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <RequirementList record={record} nameEn={event.nameEn} nameAr={event.nameAr} backHref={`/events/${id}`} />
      </main>
    </>
  );
}
