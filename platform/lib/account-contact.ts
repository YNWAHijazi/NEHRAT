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
