/**
 * Creates a CREDENTIALED account for testing -- any role.
 *
 * Why this is a script and not a screen: Ministry roles are not self-registerable.
 * The only account-creation path in the product is nomination (non-negotiable 6) --
 * an EMS provider or Event Medical Director registering against an invitation token.
 * Nothing in the console creates a reviewer, an inspector or an administrator, and
 * that is deliberate. So a real Ministry account is made out of band, here.
 *
 * This is NOT the demonstration login. `test_moph_admin` already exists, signs in
 * with one click from the demonstration panel, and carries is_demo = 1 -- which means
 * it sees ONLY demonstration rows, in both directions. An account made here carries
 * is_demo = 0 and therefore sees the real register and nothing demonstrative. Use the
 * demo button to walk the showcase; use this to test the console against real data.
 *
 * Refuses to run in a deployed environment, on the same guard as the seeder, and for
 * the same reason: nothing that manufactures access should be reachable in production.
 *
 * Usage:
 *   node scripts/make-ministry-account.mjs [--role ministry_admin] [--email ...] [--name "..."]
 *   DATABASE_PATH=var/dev.db node scripts/make-ministry-account.mjs
 *
 * The password is generated, printed ONCE, and never written to a file or the repo.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, scryptSync } from 'node:crypto';
import { join } from 'node:path';

if (process.env.NODE_ENV === 'production') {
  process.stderr.write(
    'Refusing to run: this script manufactures access and is disabled in production.\n',
  );
  process.exit(1);
}

/**
 * The app's scrypt parameters and storage format, from lib/password.ts.
 *
 * Duplicated here because that module now reads its policy through lib/rules, whose
 * extensionless imports a plain .mjs script cannot resolve. Duplication of a security
 * primitive is exactly the kind of thing that drifts silently, so it does not go
 * unguarded: tests/make-ministry-account.test.ts hashes with THIS function and verifies
 * with the app's verifyPassword. If the app ever changes its key length or format, that
 * test fails rather than this script quietly minting accounts nobody can sign in to.
 */
const KEY_LENGTH = 64;
export function hashPasswordLikeTheApp(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, KEY_LENGTH).toString('hex')}`;
}

/** A password worth typing once: mixed classes, generated, never chosen by hand. */
export function generatePassword() {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digit = '23456789';
  const symbol = '!@#$%&*?';
  const all = lower + upper + digit + symbol;
  const pick = (set) => set[randomInt(set.length)];
  // One of each class up front, so the result satisfies a stricter policy than the
  // review build's placeholder if the Ministry ever tightens auth-policy.json.
  const chars = [pick(lower), pick(upper), pick(digit), pick(symbol)];
  while (chars.length < 20) chars.push(pick(all));
  // Fisher-Yates, so the guaranteed classes are not always in the first four places.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Ministry-side roles, which have no other route in: nothing in the console
 * creates a reviewer, an inspector or an administrator.
 */
const MINISTRY_ROLES = ['reviewer', 'inspector', 'ministry_admin', 'platform_owner'];

/**
 * Counterparty roles, which normally arrive by NOMINATION (non-negotiable 6):
 * the organizer names a provider or a Director, and they register against an
 * invitation token. Creating one here is a TESTING convenience only -- it makes
 * an account that can sign in, and its dashboard is empty until an organizer
 * nominates that email address and the account accepts the invitation. It does
 * not, and must not, let anyone self-register into an event.
 */
const COUNTERPARTY_ROLES = ['organizer', 'ems', 'director', 'response'];
const ALL_ROLES = [...MINISTRY_ROLES, ...COUNTERPARTY_ROLES];

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const role = arg('--role', 'ministry_admin');
  if (!ALL_ROLES.includes(role)) {
    process.stderr.write(`Unknown role "${role}". One of: ${ALL_ROLES.join(', ')}\n`);
    process.exit(1);
  }
  const email = arg('--email', `${role}@moph.test`).toLowerCase();
  const name = arg('--name', 'Ministry Administrator');
  const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), 'var', 'dev.db');

  const db = new DatabaseSync(dbPath);
  const existing = db.prepare('SELECT id, role FROM accounts WHERE email = ?').get(email);
  const password = generatePassword();
  const hash = hashPasswordLikeTheApp(password);

  if (existing) {
    // Re-running rotates the password rather than failing. Making a second account for
    // the same person would be worse than resetting the one that exists.
    db.prepare('UPDATE accounts SET password_hash = ?, role = ?, display_name = ?, is_demo = 0 WHERE id = ?')
      .run(hash, role, name, existing.id);
  } else {
    const initials = name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
    db.prepare(
      `INSERT INTO accounts (login, email, password_hash, display_name, initials, role, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ).run(`moph_${Date.now().toString(36)}`, email, hash, name, initials, role);
  }
  db.close();

  process.stdout.write(
    `\n  ${existing ? 'Password rotated' : 'Account created'} in ${dbPath}\n\n` +
      `    Email     ${email}\n` +
      `    Password  ${password}\n` +
      `    Role      ${role}\n` +
      `    Demo      no -- sees the real register, not the demonstration rows\n` +
      (COUNTERPARTY_ROLES.includes(role) && role !== 'organizer'
        ? `    Note      empty until an organizer nominates ${email} and this account\n` +
          `              accepts the invitation -- nomination, never self-registration.\n`
        : '') +
      (role === 'organizer'
        ? `    Note      register the organization first; filing opens once the Ministry\n` +
          `              records it. Creating, assessing and drafting work meanwhile.\n`
        : '') +
      `\n` +
      `  Sign in at /signin with the email and password. Shown once; not stored anywhere else.\n\n`,
  );
}

// Importable for the drift test without creating an account as a side effect.
if (process.argv[1] && process.argv[1].endsWith('make-ministry-account.mjs')) main();
