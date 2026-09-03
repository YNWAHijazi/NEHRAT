import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { VenueAssessmentForm } from './VenueAssessmentForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { capabilityConfigFor, ministryConfig, unreadCountFor, venueAssessmentsFor, venueById, venueChangeSinceAssessment } from '../../../../lib/queries';
import { paymentFor } from '../../../../lib/payments';
import { beirutToday } from '../../../../lib/clock';
import { venueReassessmentGate } from '../../../../lib/rules/gates';
import { BANDS, DOMAINS, DOMAIN_COUNT, MAX_SCORE_PER_DOMAIN, MINIMUM_CONDITIONS, REASSESSMENT_WINDOW } from '../../../../lib/rules/load';
import { formatIsoDate } from '../../../../lib/rules/deadlines';
import { VENUE_REASSESSMENT_TRIGGERS, applicationFee, effectiveFlag } from '../../../../lib/rules';

/**
 * The annual assessment route. The reassessment gate decides whether this screen is
 * reachable: outside the window (no change reported, classification current) the record
 * screen shows the disabled row with its date, and this route bounces back to it --
 * the screen never decides for itself.
 */
export default async function VenueAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const venue = venueById(account.id, id);
  if (!venue) notFound();

  const today = beirutToday();
  const gate = venueReassessmentGate({
    validUntil: venue.validUntil,
    today,
    changeReportedSinceAssessment: venueChangeSinceAssessment(account.id, venue.id),
  });
  if (gate.behaviour !== 'enabled') redirect(`/venues/${venue.id}`);

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const history = venueAssessmentsFor(account.id, venue.id);
  const last = history[0] ?? null;

  const effectivePreview = today;
  const validPreview = formatIsoDate(
    addMonths(today, REASSESSMENT_WINDOW.venueClassificationMonths),
  );

  // THE REGISTRATION FEE (register closure, 2026-09-03): the venue's filing
  // moment is the classification issuing here, so with a venue fee in force and
  // unpaid the amount is named on this screen and the recording control waits.
  // Null while no fee is in force -- the shipped state.
  const feeConfig = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const venueFee = applicationFee('registerVenue', null, effectiveFlag('applicationFees', feeConfig), capabilityConfigFor('applicationFees'));
  const feeDue = venueFee !== null && paymentFor(venue.id, 'registerVenue') === null
    ? { amount: venueFee.amount, currency: venueFee.currency }
    : null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/venues/${id}`, en: 'Venue record', ar: 'سجل الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <VenueAssessmentForm
          venueId={venue.id}
          venueNameEn={venue.nameEn}
          venueNameAr={venue.nameAr}
          domains={[...DOMAINS]}
          conditions={[...MINIMUM_CONDITIONS]}
          bands={[...BANDS]}
          maxScore={DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN}
          venueFacts={{
            licensedCapacity: venue.licensedCapacity,
            regularlyHosts: venue.regularlyHosts,
            isNightclub: venue.isNightclub,
          }}
          initialAnswers={last ? [...last.answers] : null}
          initialAttendance={last ? last.inputs.expectedMaxSimultaneousAttendance : null}
          feeDue={feeDue}
          effectivePreview={effectivePreview}
          validPreview={validPreview}
          triggers={[...VENUE_REASSESSMENT_TRIGGERS]}
        />
      </main>
    </>
  );
}

/** Calendar-month addition on an ISO date, clamping to the month's last day. */
function addMonths(iso: string, months: number): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (y ?? 1970) * 12 + ((m ?? 1) - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(d ?? 1, lastDay) };
}
