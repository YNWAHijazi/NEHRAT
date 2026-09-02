/**
 * Account administration: who may act on whom, and where an account came from.
 *
 * The two assertions that matter most are the untouchable rows. An administrator who
 * can edit their own row can promote themselves or lock the Ministry out of its own
 * register with one mistake; an administrator who can re-role the platform owner can
 * give that seat powers the Ministry has not ruled on (SPEC 2c).
 */
import { describe, expect, it } from 'vitest';
import {
  ACCOUNTS_CONTENT,
  ASSIGNABLE_ROLES,
  accountOrigin,
  administrationBar,
  consequencesOf,
  isAssignableRole,
  isPending,
} from '../lib/rules/accounts';

const actor = { id: 1, isDemo: false };

describe('the two untouchable rows', () => {
  it('nobody administers their own account', () => {
    expect(administrationBar(actor, { id: 1, role: 'ministry_admin', isDemo: false })).toBe('ownRow');
  });

  it('the platform owner is above this console, whoever asks', () => {
    expect(administrationBar(actor, { id: 2, role: 'platform_owner', isDemo: false })).toBe('platformOwner');
  });

  it('and every other row is administrable', () => {
    for (const role of ASSIGNABLE_ROLES) {
      expect(administrationBar(actor, { id: 9, role, isDemo: false }), role).toBeNull();
    }
  });

  it('the bar is a REASON, and both reasons are written in both languages', () => {
    const bars = ACCOUNTS_CONTENT.bars as Record<string, { en: string; ar: string }>;
    for (const key of ['ownRow', 'platformOwner']) {
      expect(bars[key]?.en.length, `${key} en`).toBeGreaterThan(40);
      expect(bars[key]?.ar.length, `${key} ar`).toBeGreaterThan(20);
    }
  });
});

describe('the assignable roles', () => {
  it('cover every role a person can hold, and never the platform owner', () => {
    // The console listed four of nine. An organizer, a provider, a Director and a
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(
      ['director', 'ems', 'ministry_admin', 'order', 'organizer', 'reviewer'].sort(),
    );
    expect(isAssignableRole('platform_owner')).toBe(false);
    expect(isAssignableRole('nonsense')).toBe(false);
  });
});

describe('where an account came from', () => {
  const base = { isDemo: false, hasPassword: true, wasInvited: false, fromNomination: false, role: 'organizer' };

  it('a demonstration row says so before anything else', () => {
    expect(accountOrigin({ ...base, isDemo: true })).toBe('demonstration');
  });

  it('an invited account reads as pending until it has a credential', () => {
    expect(accountOrigin({ ...base, wasInvited: true, hasPassword: false })).toBe('invitedPending');
    expect(accountOrigin({ ...base, wasInvited: true, hasPassword: true })).toBe('invitedActive');
  });

  it('a counterparty that registered against a nomination is named as such', () => {
    expect(accountOrigin({ ...base, role: 'ems', fromNomination: true })).toBe('nominated');
  });

  it('an organizer that arrived through the public route is self-registered', () => {
    expect(accountOrigin(base)).toBe('selfRegistered');
  });

  it('a Ministry role with no invitation could only have been issued out of band', () => {
    // Nothing in the product creates a reviewer: nomination is the only account path,
    // and it makes counterparties. So this origin is the honest answer, not a default.
    expect(accountOrigin({ ...base, role: 'reviewer' })).toBe('outOfBand');
  });
});

describe('pending', () => {
  it('is an invited account that has not set a credential', () => {
    expect(isPending({ hasPassword: false, wasInvited: true })).toBe(true);
    expect(isPending({ hasPassword: true, wasInvited: true })).toBe(false);
  });

  it('is never a seeded row -- those sign in by button and were never invited', () => {
    // Otherwise every demonstration account would read as a stalled invitation.
    expect(isPending({ hasPassword: false, wasInvited: false })).toBe(false);
  });

  it('IS a pending account made by a demonstration administrator', () => {
    // The first version keyed on demonstration-ness and silenced exactly this: an
    // account that could not sign in rendered Active, and an administrator would have
    // waited for a sign-in that could never happen.
    expect(accountOrigin({ isDemo: true, hasPassword: false, wasInvited: true, fromNomination: false, role: 'reviewer' })).toBe('invitedPending');
    expect(isPending({ hasPassword: false, wasInvited: true })).toBe(true);
  });
});

describe('what an account holds, before anything is done to it', () => {
  const none = { events: 0, organizations: 0, nominations: 0, determinations: 0, inspections: 0, venues: 0, facilities: 0 };

  it('says nothing when there is nothing', () => {
    expect(consequencesOf(none)).toEqual([]);
  });

  it('writes the count into each consequence, in both languages', () => {
    const out = consequencesOf({ ...none, events: 4, determinations: 2 });
    expect(out.map((c) => c.key)).toEqual(['events', 'determinations']);
    for (const c of out) {
      expect(c.en).toContain(String(c.count));
      expect(c.en).not.toContain('{n}');
      expect(c.ar).not.toContain('{n}');
      expect(c.ar.length).toBeGreaterThan(0);
    }
  });

  it('omits what is zero rather than listing it as none', () => {
    // A list of seven zeroes is not a statement of consequence; it is noise that
    // hides the one line that matters.
    expect(consequencesOf({ ...none, venues: 1 }).map((c) => c.key)).toEqual(['venues']);
  });
});
