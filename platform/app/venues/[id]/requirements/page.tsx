import { redirect } from 'next/navigation';

/** The venue's Requirements tab became part of its single record page (redesign, 2026-10-07). */
export default async function VenueRequirementsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/venues/${id}#req-summary`);
}
