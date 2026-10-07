import { redirect } from 'next/navigation';

/** The venue's Submit tab became the foot of its single record page (redesign, 2026-10-07). */
export default async function VenueSubmitRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/venues/${id}#final-review`);
}
