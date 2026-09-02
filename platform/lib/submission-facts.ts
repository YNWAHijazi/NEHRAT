/**
 * Assembles SubmissionFacts from the database for one event, and runs the gate.
 * The single call site both screens and the filing action use -- the action recomputes
 * server-side rather than trusting the screen.
 */

import { organizationFor } from './auth';
import { clockNow } from './clock';
import { paymentFor } from './payments';
import { beirutToday, capabilityConfigFor, documentStateFor, eventFor, invitationsFor, latestOutcomeFor, ministryConfig, submissionFor, assessmentsFor } from './queries';
import { applicationFee, declarationsAreComplete, effectiveFlag, eventFilingDeadline, submissionGate, type EventGateContext, type Level, type SubmissionGate } from './rules';

/**
 * The application fee facts for one event: the fee in force for its level and
 * whether a recorded payment discharges it. Null while no fee is in force --
 * the shipped state, since the capability ships off.
 */
function feeFactsFor(
  eventId: string,
  level: Level | null,
): { amount: string; currency: string; paid: boolean; paidAt: string | null } | null {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const fee = applicationFee(
    'certifyEvent',
    level,
    effectiveFlag('applicationFees', config),
    capabilityConfigFor('applicationFees'),
  );
  if (fee === null) return null;
  const payment = paymentFor(eventId, 'certifyEvent');
  return { amount: fee.amount, currency: fee.currency, paid: payment !== null, paidAt: payment?.paidAt ?? null };
}

export function submissionGateFor(
  accountId: number,
  eventId: string,
): SubmissionGate & { level: Level | null; fee: { amount: string; currency: string; paid: boolean; paidAt: string | null } | null } {
  const event = eventFor(accountId, eventId);
  const organization = organizationFor(accountId);
  const versions = assessmentsFor(accountId, eventId);
  const level = versions[0]?.derivation.finalLevel ?? event?.level ?? null;

  if (!event || level === null) {
    return {
      canFile: false,
      blockers: [
        {
          kind: 'declarationsIncomplete',
          itemEn: 'The assessment is not complete; no level is derived',
          itemAr: 'التقييم غير مكتمل؛ لم يُستنتج مستوى',
        },
      ],
      expedited: false,
      awaitingPayment: false,
      level,
      fee: null,
    };
  }

  const invitations = invitationsFor(accountId, eventId);
  const submission = submissionFor(accountId, eventId);
  const documentState = documentStateFor(accountId, eventId, level);

  const fee = feeFactsFor(eventId, level);
  const gateCtx: EventGateContext = {
    finalLevel: level,
    eventEndDate: event.endDate,
    eventStartDate: event.startDate,
    filed: event.filed,
    organizationStatus: organization?.status ?? 'none',
    now: clockNow(),
  };
  const deadline = eventFilingDeadline(gateCtx);

  const declarationsComplete = declarationsAreComplete(submission?.declarations ?? null, level);

  const gate = submissionGate({
    level,
    lifecycle: event.lifecycle,
    organizationStatus: organization?.status ?? 'none',
    documentState,
    // The organizer certification's own fields, from the stored submission. Empty
    // when nothing has been saved, which is correct: an unstarted certification is an
    // incomplete one.
    grandfather: {
      today: beirutToday(),
      filedAt: submission?.filedAt?.slice(0, 10) ?? null,
      determined: latestOutcomeFor(eventId) !== null,
    },
    certification: {
      representative: submission?.representative ?? '',
      telephone: submission?.telephone ?? '',
      position: submission?.position ?? '',
    },
    // Withdrawn and removed parties are HISTORY, not parties: they neither block
    // filing nor count toward a level's requirements. This is the way out of the
    // trap where one confirmed provider and one unanswered nomination blocked filing
    // with nothing the organizer could do -- withdrawing the unanswered one leaves
    // the confirmed one, and the gate derives from who remains.
    providers: invitations
      .filter((i) => i.kind === 'ems' && i.status !== 'withdrawn' && i.status !== 'removed')
      .map((i) => ({ name: i.nameEn, status: i.status, declaration: i.declaration })),
    // A declined, withdrawn or removed Director is not the record's Director: the
    // blocker must say "name one", not "has not accepted".
    director:
      invitations.find(
        (i) => i.kind === 'director' && (i.status === 'nominated' || i.status === 'confirmed'),
      ) ?? null,
    declarationsComplete,
    today: beirutToday(),
    filingDeadline: deadline?.date ?? null,
    fee: fee === null ? null : { amount: fee.amount, currency: fee.currency, paid: fee.paid },
  });
  return { ...gate, level, fee };
}
