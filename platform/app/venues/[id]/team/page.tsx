import { redirect } from 'next/navigation';

/**
 * The medical team lives on the record page now (owner, 8 October 2026): the EMS agency is
 * invited on the EMS and ambulance row, the Level 3 Director on the Director row. An old
 * link to this screen lands on the EMS row.
 */
export default async function VenueTeam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/venues/${id}?step=B7#req-B7`);
}
