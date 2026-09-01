/**
 * Account administration. Plain TypeScript, like everything in lib/rules/.
 *
 * WHAT THE ADMINISTRATOR MAY DO, and the two things they may never do.
 *
 * The console used to list Ministry-side accounts only -- five roles out of nine --
 * so an administrator asked to manage "the accounts" could not see an organizer, an
 * EMS provider, a Director or a first-response unit at all. They exist, they sign in,
 * and they were invisible here.
 *
 * THE ADMINISTRATOR NEVER SETS OR SEES A PASSWORD (reviewer ruling, 2026-08-28).
 * Creating an account issues an activation link; the recipient sets their own
 * credential against it. An administrator who can set a password can sign in as the
 * person -- and every act that person then performs is recorded against their name.
 * On a platform where a reviewer's determination is the regulatory instrument, that
 * is not a convenience worth having.
 *
 * TWO ROWS ARE UNTOUCHABLE:
 *   - the administrator's own, so the console cannot lock itself out or promote
 *     itself. This is not about trust; it is that a one-person mistake should not be
 *     able to end the Ministry's access to its own register.
 *   - the platform owner's, which is a seat above this console. SPEC 2c: the owner
 *     sees counts and performs no regulatory action, and an administrator who could
 *     re-role that seat could give it powers the Ministry has not ruled on.
 */

import accountsJson from './data/accounts.json';
import { bilingualMap } from './bilingual-map';

export const ACCOUNTS_CONTENT = accountsJson;

/**
 * Every role an account can hold. platform_owner is deliberately absent: it is not
 * assignable from this console in either direction.
 */
export const ASSIGNABLE_ROLES = [
  'organizer',
  'ems',
  'director',
  'response',
  'reviewer',
  
  'ministry_admin',
  'order',
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** Why an administrator cannot act on a row -- named, never a silent disabled control. */
export type AdministrationBar = 'ownRow' | 'platformOwner';

export interface AccountActor {
  readonly id: number;
  readonly isDemo: boolean;
}

export interface AccountTarget {
  readonly id: number;
  readonly role: string;
  readonly isDemo: boolean;
}

/**
 * May this administrator act on this account? Returns the REASON when not, so the
 * screen can say who holds the row rather than rendering a control that does nothing
 * (non-negotiable 10: disabled with a reason, never silently inert).
 */
export function administrationBar(
  actor: AccountActor,
  target: AccountTarget,
): AdministrationBar | null {
  if (actor.id === target.id) return 'ownRow';
  if (target.role === 'platform_owner') return 'platformOwner';
  return null;
}

/**
 * HOW AN ACCOUNT CAME TO EXIST.
 *
 * Shown on every row because it is the first thing anyone administering accounts
 * needs and the hardest thing to reconstruct later: an account with no origin is a
 * row nobody can account for, and "who let this in" is not a question a register
 * should be unable to answer.
 *
 * Derived from facts, never stored -- a stored origin is a field that goes stale the
 * first time somebody forgets to write it.
 */
export type AccountOrigin =
  /** Seeded demonstration row. Exists in production so the Ministry can walk the platform. */
  | 'demonstration'
  /** Created here by an administrator; the holder has not yet set a credential. */
  | 'invitedPending'
  /** Created here by an administrator, and activated. */
  | 'invitedActive'
  /** Self-registered against a nomination token (rule 6). */
  | 'nominated'
  /** Signed up as an organizer through the public route. */
  | 'selfRegistered'
  /** Made out of band by scripts/make-ministry-account.mjs. Ministry roles are not self-registerable. */
  | 'outOfBand';

export interface OriginFacts {
  readonly isDemo: boolean;
  readonly hasPassword: boolean;
  /** An activation link was issued for this account by an administrator. */
  readonly wasInvited: boolean;
  /** The account is linked to a nomination it registered against. */
  readonly fromNomination: boolean;
  readonly role: string;
}

export function accountOrigin(facts: OriginFacts): AccountOrigin {
  // AN INVITATION WINS OVER DEMONSTRATION, and the order matters. A demonstration
  // ADMINISTRATOR creating an account through the console produces a genuinely
  // invited account that happens to live in the demonstration world; reading it as
  // "demonstration account" hid the fact that nobody had activated it and it could
  // not sign in. Seeded rows are never invited, so they still resolve below.
  if (facts.wasInvited) return facts.hasPassword ? 'invitedActive' : 'invitedPending';
  if (facts.isDemo) return 'demonstration';
  if (facts.fromNomination) return 'nominated';
  // A Ministry-side role cannot self-register: nothing in the product creates one,
  // which is why the out-of-band script exists and why this is the only way to hold
  // one without an invitation.
  if (facts.role === 'organizer') return 'selfRegistered';
  return 'outOfBand';
}

/**
 * An account that was INVITED and has not set a credential. It cannot sign in, and the
 * console must say so rather than showing it as active.
 *
 * Keyed on the invitation, not on demonstration-ness. The first version excluded
 * demonstration accounts, because seeded rows have no password and sign in by button,
 * and would otherwise all read as stalled invitations. But that also silenced a real
 * pending account created by a demonstration administrator -- it rendered Active, and
 * an administrator would have waited for a sign-in that could never happen. A seeded
 * row was never invited, so keying on the invitation excludes it for the right reason.
 */
export function isPending(facts: { hasPassword: boolean; wasInvited: boolean }): boolean {
  return facts.wasInvited && !facts.hasPassword;
}

/**
 * WHAT AN ACCOUNT HOLDS, as a list of consequences to state before acting on it.
 *
 * The organizer's remove-a-provider control names the weight of the act before the
 * click, and the reviewer asked for the same here. Suspending an account that owns
 * four filed events is a different act from suspending one that owns nothing, and an
 * administrator should not have to go and find out which.
 */
export interface AccountHoldings {
  events: number;
  organizations: number;
  nominations: number;
  determinations: number;
  inspections: number;
  venues: number;
  facilities: number;
}

export interface Consequence {
  readonly key: string;
  readonly count: number;
  readonly en: string;
  readonly ar: string;
}

/** The non-zero holdings, each written out. An empty list means the account holds nothing. */
export function consequencesOf(holdings: AccountHoldings): Consequence[] {
  const defs = bilingualMap(accountsJson.holdings);
  return (Object.keys(defs) as (keyof AccountHoldings)[])
    .filter((key) => (holdings[key] ?? 0) > 0)
    .map((key) => {
      const def = defs[key as string]!;
      const count = holdings[key];
      return {
        key: key as string,
        count,
        en: def.en.replace('{n}', String(count)),
        ar: def.ar.replace('{n}', String(count)),
      };
    });
}
