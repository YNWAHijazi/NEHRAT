import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent } from '../../../../lib/queries';

/**
 * DISSOLVED INTO THE ONE PAGE (partner ruling, counterparty pass 2026-09-02): the
 * shared-document list and its request-answering forms render as a section of the
 * provider's task page — supplying a requested document is part of what the page
 * asks for, not a separate hop. The route survives as a redirect so old links,
 * notifications and bookmarks keep working.
 */
export default async function SharedDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'ems');
  if (!invitation) notFound();
  redirect(
    invitation.eventLevel === 3 ? `/events/${id}/declaration#documents` : `/events/${id}/participation#documents`,
  );
}
