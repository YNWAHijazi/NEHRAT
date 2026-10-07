import { redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { derivedLevelFor } from '../../../../lib/queries';

/**
 * The standalone plan page dissolved into the medical plan row of the single record
 * page (redesign, 2026-10-07): the organizer reads it there, the EMS agency and the
 * Medical Director prepare it there. Old links land on that row, on the page each
 * role reads the event from.
 */
export default async function PlanRedirect({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const anchor = '#req-B2';
  if (account.role === 'ems') redirect(`/events/${id}/${derivedLevelFor(id) === 3 ? 'declaration' : 'participation'}${anchor}`);
  redirect(`/events/${id}${anchor}`);
}
