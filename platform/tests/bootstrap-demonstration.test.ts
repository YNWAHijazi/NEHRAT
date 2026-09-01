/**
 * The bootstrap command's contract.
 *
 * These accounts now exist in PRODUCTION, with passwords that are published rather than
 * secret. That is the design (non-negotiable 8), and it only holds while two things stay
 * true: the credentials satisfy the configured policy, and the panel that signs somebody
 * in without a password refuses anything that is not a demonstration account.
 *
 * Both were broken at some point in getting here. The panel's action trusted a hard-coded
 * list of login strings and never read is_demo off the row it signed in -- safe only
 * because the panel was hidden outside a review build, an assumption held in a different
 * file. These tests hold the record-derived versions in place.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPasswordPolicy } from '../lib/password';

const ROOT = join(__dirname, '..');
const BOOTSTRAP = readFileSync(join(ROOT, 'scripts/bootstrap-demonstration.ts'), 'utf8');
const SEEDER = readFileSync(join(ROOT, 'lib/demo-seed.ts'), 'utf8');
const ACTIONS = readFileSync(join(ROOT, 'app/actions.ts'), 'utf8');
const SIGNIN = readFileSync(join(ROOT, 'app/signin/page.tsx'), 'utf8');

/** The logins the script issues credentials for, read from the script itself. */
function credentialedLogins(): { login: string; password: string }[] {
  const out: { login: string; password: string }[] = [];
  const re = /\{ login: '([a-z_]+)', password: '([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(BOOTSTRAP)) !== null) out.push({ login: m[1]!, password: m[2]! });
  return out;
}

describe('the demonstration bootstrap', () => {
  it('issues credentials for the six roles SPEC 3b names', () => {
    const logins = credentialedLogins().map((c) => c.login);
    expect(logins).toEqual([
      'test_organizer',
      'test_organizer_pending',
      'test_ems',
      'test_director',
      'test_moph',
      'test_moph_admin',
    ]);
  });

  it('every issued password satisfies the configured credential policy', () => {
    // The policy is Ministry-configurable data. If it tightens, these fixed passwords
    // stop being valid and every demonstration sign-in fails -- silently, at a login
    // screen nobody is watching. This fails here first.
    for (const { login, password } of credentialedLogins()) {
      const check = checkPasswordPolicy(password);
      expect(check.ok, `${login}: ${check.failed ?? ''}`).toBe(true);
    }
  });

  it('only issues credentials to accounts the seeder actually creates', () => {
    // Two files agreeing by coincidence is the failure this catches: a login renamed in
    // the seeder leaves the script updating zero rows, and an account with no password
    // that nobody can sign into.
    for (const { login } of credentialedLogins()) {
      expect(SEEDER, `${login} is not created by lib/demo-seed.ts`).toContain(`'${login}'`);
    }
  });

  it('refuses to run when demonstration accounts already exist', () => {
    expect(BOOTSTRAP).toMatch(/WHERE is_demo = 1/);
    expect(BOOTSTRAP).toContain('REFUSING');
    expect(BOOTSTRAP).toContain('process.exit(1)');
  });

  it('reuses the one demonstration dataset rather than defining a second', () => {
    expect(BOOTSTRAP).toContain("from '../lib/demo-seed'");
    // A second CREATE/INSERT set here would drift from the seeder.
    expect(BOOTSTRAP).not.toMatch(/INSERT INTO events/);
    expect(BOOTSTRAP).not.toMatch(/INSERT INTO accounts/);
  });

  it('addresses cannot be mistaken for mailboxes that receive', () => {
    // RFC 2606 reserves .invalid. No notification, reset or nomination can arrive here.
    expect(BOOTSTRAP).toContain('demonstration.invalid');
  });
});

describe('the passwordless demonstration panel', () => {
  it('signs in only accounts the RECORD says are demonstration accounts', () => {
    // This action starts a session with no credential. Trusting the login allow-list
    // alone made it an authentication bypass for any real account created with one of
    // those logins -- which mattered the moment the panel could render in production.
    const action = ACTIONS.slice(ACTIONS.indexOf('export async function demoSignInAction'));
    const body = action.slice(0, action.indexOf('\n}'));
    expect(body).toMatch(/if \(!account\.isDemo\)/);
    // And the check must precede the session, not follow it.
    expect(body.indexOf('account.isDemo')).toBeLessThan(body.indexOf('startSession'));
  });

  it('is shown because the accounts exist, not because of the environment', () => {
    expect(SIGNIN).toContain('demonstrationAccountsExist()');
    // NODE_ENV gated the panel on the guard that forces the SEEDER off. Different
    // questions: the accounts belong in production, the seeder does not.
    expect(SIGNIN).not.toContain("process.env.NODE_ENV !== 'production'");
  });
});
