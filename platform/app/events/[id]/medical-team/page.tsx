import { redirect } from 'next/navigation';

/** The Medical Director and EMS tabs became the invitation rows on the single record page (redesign, 2026-10-07). */
export default async function MedicalTeamRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  redirect(`/events/${id}#${tab === 'director' ? 'req-B3' : 'req-B7'}`);
}
