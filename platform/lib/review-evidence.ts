import type { Account } from './auth';
import { getDb } from './db';
import { can, documentsForLevel } from './rules';
import { siteForEvent, siteSnapshotFor } from './event-site';
import { addedMeasuresFor, complianceForReview, documentStateFor, governanceFor, invitationByToken, invitationsFor, planLastEditorFor, submissionForReview } from './queries';

/** Review-only evidence. No invitation tokens or unsigned declaration answers leave this query. */
export function reviewEvidenceFor(account: Pick<Account, 'role' | 'isDemo'>, eventId: string) {
  if (!can(account.role, 'viewSubmission')) return null;
  const review = submissionForReview(account.isDemo, eventId);
  if (!review) return null;
  const event = getDb().prepare(`SELECT e.account_id, e.start_date, e.end_date, e.opening_time, e.closing_time,
    e.venue_route, e.municipalities, e.expected_participants, e.expected_spectators, e.expected_staff,
    s.filed_at, p.updated_at AS plan_updated_at
    FROM events e JOIN submissions s ON s.event_id=e.id LEFT JOIN plans p ON p.event_id=e.id WHERE e.id=?`).get(eventId) as {
      account_id: number; start_date: string | null; end_date: string | null;
      opening_time: string; closing_time: string; venue_route: string; municipalities: string;
      expected_participants: number | null; expected_spectators: number | null; expected_staff: number | null;
      filed_at: string; plan_updated_at: string | null;
    };
  const requested = addedMeasuresFor(eventId).some(m => m.catalogKey === 'plan' && !m.clearedAt);
  const state = review.level ? documentStateFor(event.account_id, eventId, review.level) : {};
  return {
    event,
    // The Site information the event relied on when filed (latest revision, section 1); the
    // current link alone where the record was filed before snapshots were taken.
    site: siteForEvent(eventId),
    siteSnapshot: siteSnapshotFor(eventId),
    compliance: review.level ? complianceForReview(eventId, review.level) : null,
    documents: review.level ? documentsForLevel(review.level, requested).map(d => ({ ...d, complete: state[d.key] === true })) : [],
    planEditor: planLastEditorFor(event.account_id, eventId),
    planChangedSinceFiling: Boolean(event.plan_updated_at && Date.parse(event.plan_updated_at.replace(' ', 'T') + (event.plan_updated_at.endsWith('Z') ? '' : 'Z')) > Date.parse(event.filed_at.replace(' ', 'T') + (event.filed_at.endsWith('Z') ? '' : 'Z'))),
    governance: governanceFor(eventId),
    parties: invitationsFor(event.account_id, eventId).map(i => invitationByToken(i.token)).filter(i => i !== null).map(p => ({
      nameEn: p.nameEn, nameAr: p.nameAr, kind: p.kind, status: p.status, email: p.email,
      responseNote: p.responseNote, opsDetail: p.opsDetail, declaration: p.declaration,
      declarationItems: p.declaration === 'signed' ? p.declarationItems : [],
      certification: p.declaration === 'signed' ? p.certification : {},
      signedAt: p.declaration === 'signed' ? p.signedAt : null,
    })),
  };
}
