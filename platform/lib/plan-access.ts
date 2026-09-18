import type { Account } from './auth';
import { getDb } from './db';
import { derivedLevelFor } from './queries';

/** Plan-only access. A nomination does not grant access to organizer administration. */
export function planEditorOwnerId(account: Account, eventId: string): number | null {
  const event = getDb().prepare('SELECT account_id, is_demo FROM events WHERE id = ?').get(eventId) as { account_id: number; is_demo: number } | undefined;
  if (!event || event.is_demo !== Number(account.isDemo)) return null;
  if (event.account_id === account.id) return event.account_id;
  if (account.role !== 'director' || derivedLevelFor(eventId) !== 3) return null;
  const confirmed = getDb().prepare("SELECT token FROM invitations WHERE event_id = ? AND account_id = ? AND kind = 'director' AND status = 'confirmed'").get(eventId, account.id);
  return confirmed ? event.account_id : null;
}
