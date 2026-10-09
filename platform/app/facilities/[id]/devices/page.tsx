import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail } from '../../../../lib/queries';
import { facilityRecordHref } from '../../../../lib/facility-registration';

/**
 * The AED registry is the AED step, and once registered the AED section, of the facility
 * record page (owner, 9 October 2026). Old links and notifications land there. A facility
 * that is not the viewer's refuses here exactly as a missing one does.
 */
export default async function DevicesRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  if (!facilityDetail(account.id, id)) notFound();
  redirect(facilityRecordHref(id, 'aeds', await searchParams));
}
