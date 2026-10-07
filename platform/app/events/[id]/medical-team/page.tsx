import { redirect } from 'next/navigation';
import { derivedLevelFor } from '../../../../lib/queries';
import { requirementApplies } from '../../../../lib/rules';

/**
 * The Medical Director and EMS tabs became the invitation rows on the single record page
 * (redesign, 2026-10-07). The Director row exists at Level 3 only (decision D1); below it
 * the old director tab lands on the EMS row.
 */
export default async function MedicalTeamRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const level = derivedLevelFor(id);
  redirect(`/events/${id}#${tab === 'director' && level !== null && requirementApplies('B3', level, 'event') ? 'req-B3' : 'req-B7'}`);
}
