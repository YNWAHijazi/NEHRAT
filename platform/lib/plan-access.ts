import { canPreparePlan } from './rules/plan-responsibility';
import type { Account } from './auth';
import { getDb } from './db';
import { derivedLevelFor,latestOutcomeFor } from './queries';

export type PlanEditor = 'organizer' | 'director' | 'ems';
/** Confirmed medical partners get only the responsibilities assigned to their role. */
export function planAccess(account: Account, eventId: string): { ownerId: number; editor: PlanEditor; canEdit: boolean } | null {
  const event = getDb().prepare('SELECT account_id, is_demo, filed, archived_at, lifecycle FROM events WHERE id = ?').get(eventId) as { account_id: number; is_demo: number;filed:number;archived_at:string|null;lifecycle:string } | undefined;
  if (!event || event.is_demo !== Number(account.isDemo)) return null;
  const editable=!event.archived_at&&event.lifecycle==='active'&&(!event.filed||['revision','incomplete'].includes(latestOutcomeFor(eventId)??''));
  if (event.account_id === account.id) return { ownerId: event.account_id, editor: 'organizer', canEdit: canPreparePlan(derivedLevelFor(eventId), 'organizer') };
  if (!['director', 'ems'].includes(account.role) || !canPreparePlan(derivedLevelFor(eventId), account.role as PlanEditor)) return null;
  const confirmed = getDb().prepare("SELECT token FROM invitations WHERE event_id = ? AND account_id = ? AND kind = ? AND status = 'confirmed'").get(eventId, account.id, account.role);
  return confirmed ? { ownerId: event.account_id, editor: account.role as 'director' | 'ems', canEdit: editable } : null;
}
export function planEditorOwnerId(account: Account, eventId: string): number | null {
  return planAccess(account, eventId)?.ownerId ?? null;
}
export function mayEditEventDocument(account: Account, eventId: string, docKey: string): boolean {
  const access = planAccess(account, eventId);
  if (!access) return false;
  if (docKey === 'deploymentMap' && derivedLevelFor(eventId) === 3) return access.editor === 'director';
  return access.editor === 'organizer';
}
