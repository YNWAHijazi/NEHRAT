import { redirect } from 'next/navigation';

/** The Submit tab became the foot of the single record page (redesign, 2026-10-07). Old links land on it. */
export default async function SubmitRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/events/${id}#final-review`);
}
