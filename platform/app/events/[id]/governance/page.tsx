import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent } from '../../../../lib/queries';

/**
 * DISSOLVED INTO THE DIRECTOR'S ONE PAGE (partner ruling, counterparty pass
 * 2026-09-02): the three governance sections are written on /events/[id] itself,
 * beside the event's facts. The route survives as a redirect so old links and
 * notifications keep working.
 */
export default async function GovernancePage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'director');
  if (!invitation) notFound();
  redirect(`/events/${id}`);
}
