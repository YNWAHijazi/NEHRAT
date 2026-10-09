import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail } from '../../../../lib/queries';
import { facilityRecordHref } from '../../../../lib/facility-registration';

/**
 * The incident reports are a section of the facility record page (owner, 9 October 2026).
 * Reporting a new incident keeps its own screen (incidents/new). Old links land on the section.
 */
export default async function IncidentsRoute({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  if (!facilityDetail(account.id, id)) notFound();
  redirect(facilityRecordHref(id, 'incidents'));
}
