import {reopenVenueSectionAction} from '../../actions';
import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { venuePackageFor } from '../../../../lib/venue/workspace';
import { L } from '../../../../components/L';
import { pageTitle, secondaryButton } from '../../../../components/workspace-styles';
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
    {!w.editable || (w.assessmentDone && !w.assessmentEditing) ? (
      <section data-region="assessment-summary">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', justifyContent: 'space-between', marginBlockEnd: 24 }}>
          <h2 data-sec-h1="" style={{ ...pageTitle, marginBlock: 0 }}><L en="Assessment" ar="التقييم" /></h2>
          {w.editable ? (
            <form action={reopenVenueSectionAction.bind(null, id, 'assessment')}>
              <button type="submit" style={secondaryButton}><L en="Edit assessment" ar="تعديل التقييم" /></button>
            </form>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 32 }}>
          {last?.answers.map((answer, i) => (
            <div key={i} style={{ background: 'var(--bg)', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '14.5px', flex: '1 1 260px' }}>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 10 }}>{i + 1}</span>
                <L en={DOMAINS[i]?.en ?? ''} ar={DOMAINS[i]?.ar ?? ''} />
              </span>
              <span style={{ fontSize: 14, color: 'var(--muted)', flex: '1 1 220px' }}>
                <L en={DOMAINS[i]?.options.find((o) => o.score === answer)?.en ?? '—'} ar={DOMAINS[i]?.options.find((o) => o.score === answer)?.ar ?? '—'} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{answer ?? '—'}</span>
            </div>
          ))}
        </div>
      </section>
    ) :
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
