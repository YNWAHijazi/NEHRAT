import {reopenVenueSectionAction} from '../../actions';
import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { venuePackageFor } from '../../../../lib/venue/workspace';
import { L } from '../../../../components/L';
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
  const w=venuePackageFor(account.id,id)!;

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
    <VenueWorkspace account={account} w={w} active="assessment">
    {!w.editable || (w.assessmentDone&&!w.assessmentEditing) ? <section>{w.editable?<form action={reopenVenueSectionAction.bind(null,id,'assessment')}><button><L en="Edit assessment" ar="تعديل التقييم"/></button></form>:null}<h2><L en="Assessment" ar="التقييم"/></h2><p><L en={`Recorded level: ${w.level ?? '—'}`} ar={`المستوى المسجّل: ${w.level ?? '—'}`}/></p>{last?.answers.map((answer,i)=><p key={i}><L en={DOMAINS[i]?.en??''} ar={DOMAINS[i]?.ar??''}/> · <L en={DOMAINS[i]?.options.find(o=>o.score===answer)?.en??'—'} ar={DOMAINS[i]?.options.find(o=>o.score===answer)?.ar??'—'}/></p>)}</section> :
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
          feeDue={null}
          effectivePreview={effectivePreview}
          validPreview={validPreview}
          triggers={[...VENUE_REASSESSMENT_TRIGGERS]}
        />
      }
    </VenueWorkspace>
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
