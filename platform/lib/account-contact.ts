import { getDb } from './db';

/**
 * The signed-in person's own name, telephone and email, for the forms that ask who to
 * contact (owner, 9 October 2026: "since they are registering/registered, autofill the
 * name and number; if it is different they change it, or have an autofill button").
 * Used only to prefill an empty field or by "Use my details" -- never stored on a record
 * the person did not save.
 */
export interface AccountContact { name: string; phone: string; email: string }

export function accountContact(accountId: number): AccountContact {
  const r = getDb().prepare('SELECT display_name, phone, email FROM accounts WHERE id = ?').get(accountId) as { display_name: string; phone: string; email: string | null } | undefined;
  return { name: r?.display_name ?? '', phone: r?.phone ?? '', email: r?.email ?? '' };
}

/**
 * Who last signed for this organizer, for prefilling the declaration's signer (live review,
 * 10 October 2026: "no unnecessary retyping of unchanged contact details"). The event's own
 * assessment signer first, then the account's most recent filing, then the account itself.
 * Prefill only: the organizer sees and may change every value before submitting.
 */
export function lastSignerFor(accountId: number, eventId: string): { name: string; phone: string; position: string } {
  const db = getDb();
  const own = accountContact(accountId);
  const assessed = db.prepare(`SELECT representative, position FROM assessments WHERE event_id = ? AND position <> '' ORDER BY version DESC LIMIT 1`).get(eventId) as
    { representative: string; position: string } | undefined;
  const filed = db.prepare(
    `SELECT s.representative, s.position, s.telephone FROM submissions s JOIN events e ON e.id = s.event_id
     WHERE e.account_id = ? AND s.position <> '' AND s.filed_at IS NOT NULL ORDER BY s.filed_at DESC LIMIT 1`,
  ).get(accountId) as { representative: string; position: string; telephone: string } | undefined;
  return {
    name: assessed?.representative || filed?.representative || own.name,
    phone: filed?.telephone || own.phone,
    position: assessed?.position || filed?.position || '',
  };
}
