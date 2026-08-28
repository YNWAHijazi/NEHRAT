/**
 * Assembles SubmissionFacts from the database for one event, and runs the gate.
 * The single call site both screens and the filing action use -- the action recomputes
 * server-side rather than trusting the screen.
 */

import { organizationFor } from './auth';
import { clockNow } from './clock';
import { beirutToday, documentStateFor, eventFor, invitationsFor, submissionFor, assessmentsFor } from './queries';
import { declarationsAreComplete, eventFilingDeadline, submissionGate, type EventGateContext, type Level, type SubmissionGate } from './rules';

export function submissionGateFor(accountId: number, eventId: string): SubmissionGate & { level: Level | null } {
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
      level,
    };
  }

  const invitations = invitationsFor(accountId, eventId);
  const submission = submissionFor(accountId, eventId);
  const documentState = documentStateFor(accountId, eventId, level);

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
  });
  return { ...gate, level };
}
