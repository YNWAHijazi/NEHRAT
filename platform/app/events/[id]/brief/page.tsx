import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent } from '../../../../lib/queries';

/**
 * DISSOLVED (partner ruling, counterparty pass 2026-09-02): the standing summary was
 * "a summary page nobody asked for" — its facts now sit at the top of the one page a
 * counterparty works on, compact with View more. The route survives as a redirect so
 * dashboard bookmarks and old notifications keep working. The nomination is still
 * the entitlement: no live nomination, nothing here (rule 6).
 */
export default async function EventBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const kind = account.role === 'director' ? 'director' : 'ems';
  const invitation = invitationForEvent(account.id, id, kind);
  if (!invitation || (invitation.status !== 'confirmed' && invitation.status !== 'nominated')) notFound();
  redirect(kind === 'director' ? `/events/${id}` : `/events/${id}/participation`);
}
