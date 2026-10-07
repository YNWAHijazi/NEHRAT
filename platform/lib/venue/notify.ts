import { getDb } from '../db';
import { venuePackageFor } from './workspace';

/** A notification about one venue: the subject says what happened, the body names the venue -- never the same line twice. */
export function notifyVenue(accountId: number, isDemo: boolean, route: string, en: string, ar: string, kind: 'needs_action' | 'for_information' = 'needs_action'): void {
  const venueId = /\/venues\/(VN-\d+)/.exec(route)?.[1];
  const venue = venueId ? getDb().prepare('SELECT name_en, name_ar FROM venues WHERE id = ?').get(venueId) as { name_en: string; name_ar: string } | undefined : undefined;
  const bodyEn = venue ? `${venue.name_en} · ${venueId}` : en;
  const bodyAr = venue ? `${venue.name_ar} · ${venueId}` : ar;
  getDb().prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,?,?,?,?,?,?,now_stamp(),?)").run(accountId, kind, en, ar, bodyEn, bodyAr, route, +isDemo);
}

const MEDICAL_PROGRESS = ['Medical requirements:%', 'Your medical team has completed its requirements'] as const;

/**
 * The medical team's progress on one venue, as ONE notice that updates in place while unread --
 * not one "needs action" per completed row. It is for information until the team's required rows
 * are all complete; then the operator has something to do, and it says so.
 */
export function notifyVenueMedicalProgress(ownerId: number, isDemo: boolean, id: string): void {
  const w = venuePackageFor(ownerId, id);
  if (!w?.record) return;
  const medical = w.record.instances.filter((r) => r.section === 'requirement' && r.group === 'required' && r.authors.length > 0 && !r.authors.includes('organizer'));
  const done = medical.filter((r) => r.state === 'complete').length;
  const finished = medical.length > 0 && done === medical.length;
  const en = finished ? MEDICAL_PROGRESS[1] : `Medical requirements: ${done} of ${medical.length} complete`;
  const ar = finished ? 'أكمل فريقكم الطبي متطلباته' : `المتطلبات الطبية: اكتمل ${done} من ${medical.length}`;
  const route = `/venues/${id}`;
  const db = getDb();
  const open = db.prepare('SELECT id FROM notifications WHERE account_id=? AND record_route=? AND read=0 AND (subject_en LIKE ? OR subject_en=?) ORDER BY id DESC LIMIT 1').get(ownerId, route, MEDICAL_PROGRESS[0], MEDICAL_PROGRESS[1]) as { id: number } | undefined;
  if (!open) { notifyVenue(ownerId, isDemo, route, en, ar, finished ? 'needs_action' : 'for_information'); return; }
  db.prepare('UPDATE notifications SET subject_en=?,subject_ar=?,kind=?,sent_at=now_stamp() WHERE id=?').run(en, ar, finished ? 'needs_action' : 'for_information', open.id);
}
