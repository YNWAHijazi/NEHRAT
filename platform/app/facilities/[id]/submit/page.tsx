import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail } from '../../../../lib/queries';
import { facilityRecordHref, facilityRegistrationFacts } from '../../../../lib/facility-registration';
import { facilityRecordMode } from '../../../../lib/rules/facility-workflow';

/**
 * Review and register is the last step of the facility record page (owner, 9 October
 * 2026); on a registered facility the confirmation is re-recorded in the response-plan
 * section. Old links land on whichever the record shows.
 */
export default async function SubmitRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  if (!facilityDetail(account.id, id)) notFound();
  const registered = facilityRecordMode(facilityRegistrationFacts(id)) === 'manage';
  redirect(facilityRecordHref(id, registered ? 'plan' : 'review', await searchParams));
}
