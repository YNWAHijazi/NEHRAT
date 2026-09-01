import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { AssessmentForm } from '../../../events/new/AssessmentForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { assessmentsFor, eventFor, unreadCountFor } from '../../../../lib/queries';
import {
  BANDS, DOMAINS, DOMAIN_COUNT, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS,
} from '../../../../lib/rules';

/**
 * Re-run the assessment on an existing event. Prefilled from the latest version,
 * saved as a NEW version -- every earlier one stays readable on the record. The
 * action existed for a whole slice with no screen reaching it.
 */
export default async function ReassessPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  if (event.lifecycle === 'cancelled') redirect(`/events/${id}`);
  const versions = assessmentsFor(account.id, id);
  const latest = versions[0] ?? null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 4 }}>
          <L en={`${event.nameEn} · ${event.id}`} ar={`${event.nameAr} · ${event.id}`} />
        </div>
        <AssessmentForm
          domains={[...DOMAINS]}
          conditions={[...MINIMUM_CONDITIONS]}
          bands={[...BANDS]}
          maxScore={DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN}
          reassess={{
            eventId: id,
            answers: latest ? [...latest.answers] : Array<0 | 1 | 2 | null>(DOMAIN_COUNT).fill(null),
            inputs: latest?.inputs ?? {
              expectedMaxSimultaneousAttendance: null,
              eventDisciplines: [],
              courseDistanceKm: null,
              venueLicensedCapacity: null,
              venueIsNightclubOrDanceVenue: null,
            },
          }}
        />
      </main>
    </>
  );
}
