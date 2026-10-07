import { redirect } from 'next/navigation';

/** The Requirements tab became part of the single record page (redesign, 2026-10-07). Old links land on it. */
export default async function RequirementsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}#req-summary`);
}
