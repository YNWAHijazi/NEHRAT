/**
 * Assembles the Submit gate for one event from the database.
 *
 * Since the single record page (2026-10-07) the requirement blockers come from ONE
 * resolver (lib/rules/record-requirements.ts) over the catalogue -- the same instances
 * the page's cards, summaries and plan read -- so the gate cannot disagree with the
 * screen it sends the organizer to. What stays here is what is not a requirement row:
 * a cancelled lifecycle, the organization's status, and the application fee.
 *
 * The filing action recomputes this server-side rather than trusting the screen.
 */

import { organizationFor } from './auth';
import { clockNow } from './clock';
import { paymentFor } from './payments';
import { beirutToday, capabilityConfigFor, eventFor, ministryConfig, submissionFor } from './queries';
import { eventRecordRequirements, type RecordRequirements } from './record-facts';
import {
  applicationFee, CANCELLED_BLOCKER, certificationBlockerText, effectiveFlag, eventFilingDeadline, REQUIREMENT_COPY, withFeeBlocker,
  type BlockerKind, type EventGateContext, type Level, type RequirementInstance, type SubmissionBlocker, type SubmissionGate,
} from './rules';

function feeFactsFor(eventId: string, level: Level | null): { amount: string; currency: string; paid: boolean; paidAt: string | null } | null {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const fee = applicationFee('certifyEvent', level, effectiveFlag('applicationFees', config), capabilityConfigFor('applicationFees'));
  if (fee === null) return null;
  const payment = paymentFor(eventId, 'certifyEvent');
  return { amount: fee.amount, currency: fee.currency, paid: payment !== null, paidAt: payment?.paidAt ?? null };
}

/** The gate's vocabulary for a resolver instance that is not complete. */
function blockerFor(inst: RequirementInstance, certification: Record<string, string>): SubmissionBlocker {
  const kind: BlockerKind =
    inst.key === 'B3' ? (inst.state === 'waiting' ? 'directorUnanswered' : 'directorMissing')
      : inst.key === 'B20' ? 'declarationUnsigned'
        : inst.key === 'P-C' ? 'certificationIncomplete'
          : inst.state === 'waiting' ? 'providerUnanswered'
            : 'requirementIncomplete';
  // The declaration's blocker names the certification fields still owed, when that is what is missing.
  const certificationText = inst.key === 'P-C' ? certificationBlockerText('organizer', certification) : null;
  if (certificationText) return { kind, docKey: inst.key, itemEn: certificationText.en, itemAr: certificationText.ar };
  const detailEn = inst.detailEn ? ` — ${inst.detailEn}` : '';
  const detailAr = inst.detailAr ? ` — ${inst.detailAr}` : '';
  return { kind, docKey: inst.key, itemEn: `${inst.labelEn}${detailEn}`, itemAr: `${inst.labelAr}${detailAr}` };
}

export type EventSubmissionGate = SubmissionGate & {
  level: Level | null;
  fee: { amount: string; currency: string; paid: boolean; paidAt: string | null } | null;
  record: RecordRequirements | null;
};

export function submissionGateFor(accountId: number, eventId: string): EventSubmissionGate {
  const event = eventFor(accountId, eventId);
  const record = event ? eventRecordRequirements(accountId, eventId) : null;
  const level = record?.level ?? null;

  if (!event || !record || level === null) {
    return {
      canFile: false,
      blockers: [{ kind: 'declarationsIncomplete', itemEn: REQUIREMENT_COPY.assessmentIncompleteEn, itemAr: REQUIREMENT_COPY.assessmentIncompleteAr }],
      expedited: false, awaitingPayment: false, level, fee: null, record,
    };
  }

  const organization = organizationFor(accountId);
  const fee = feeFactsFor(eventId, level);
  const gateCtx: EventGateContext = {
    finalLevel: level, eventEndDate: event.endDate, eventStartDate: event.startDate, filed: event.filed,
    organizationStatus: organization?.status ?? 'none', now: clockNow(),
  };
  const deadline = eventFilingDeadline(gateCtx);

  const blockers: SubmissionBlocker[] = [];
  if (event.lifecycle === 'cancelled') {
    blockers.push({ kind: 'eventCancelled', itemEn: CANCELLED_BLOCKER.en, itemAr: CANCELLED_BLOCKER.ar });
  }
  const submission = submissionFor(accountId, eventId);
  const certification = { representative: submission?.representative ?? '', telephone: submission?.telephone ?? '', position: submission?.position ?? '' };
  for (const inst of record.blockers) blockers.push(blockerFor(inst, certification));
  const gated = withFeeBlocker(blockers, fee ? { amount: fee.amount, currency: fee.currency, paid: fee.paid } : null);
  const today = beirutToday();
  return {
    canFile: gated.blockers.length === 0,
    blockers: gated.blockers,
    expedited: deadline !== null && today > deadline.date,
    awaitingPayment: gated.awaitingPayment,
    level, fee, record,
  };
}
