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
    organizationStatus: organization?.status ?? 'none',
    documentState,
    providers: invitations
      .filter((i) => i.kind === 'ems')
      .map((i) => ({ name: i.nameEn, status: i.status, declaration: i.declaration })),
    // A declined Director is not the record's Director: the blocker must say "name
    // one", not "has not accepted".
    director: invitations.find((i) => i.kind === 'director' && i.status !== 'declined') ?? null,
    declarationsComplete,
    today: beirutToday(),
    filingDeadline: deadline?.date ?? null,
  });
  return { ...gate, level };
}
