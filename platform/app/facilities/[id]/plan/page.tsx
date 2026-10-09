import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail } from '../../../../lib/queries';
import { facilityRecordHref } from '../../../../lib/facility-registration';

/**
 * The cardiac emergency response plan is a step, and once registered a section, of the
 * facility record page (owner, 9 October 2026). The Ministry's readiness-confirmation
 * notifications point here, so the route stays and lands on the plan.
 */
export default async function PlanRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  if (!facilityDetail(account.id, id)) notFound();
  redirect(facilityRecordHref(id, 'plan', await searchParams));
}
