/**
 * Provisions the demonstration accounts and their records on a DEPLOYED instance.
 *
 *   npm run demo:bootstrap
 *
 * WHY THIS EXISTS. Non-negotiable 8 draws a line that is easy to read backwards:
 * demonstration ROWS are real rows carrying is_demo = 1 and they DO exist in
 * production, so the Ministry can walk the platform. What is forced off in a deployed
 * environment is the SEEDER -- the thing that runs by itself on every connection --
 * not the accounts. A fresh deployment therefore comes up correct and useless: no
 * accounts, no way in, and nothing on the sign-in page to explain that.
 *
 * This is the seeder's other half: never automatic, never triggered by an environment
 * variable, run once by a person at the host console who meant to run it. That is a
 * different act from a process deciding to write rows into a national register on
 * boot, and the difference is the whole reason lib/db.ts refuses to do it.
 *
 * IT REUSES seedDemonstration RATHER THAN DEFINING A SECOND DATASET. There is one
 * demonstration dataset and it lives in lib/demo-seed.ts. A parallel one here would
 * drift from it, and the copy that drifts is always the one somebody is looking at.
 *
 * WHAT IT REFUSES. If any demonstration account already exists it stops and changes
 * nothing. Re-running it would mean a second set of demonstration events in a register
 * the Ministry is reading, which is exactly the harm the production guard exists to
 * prevent. Refusing is cheap; a duplicated register is not.
 */

import { resolve } from 'node:path';
import { getDb } from '../lib/db';
import { linkDemonstrationCounterparties, seedDemonstration } from '../lib/demo-seed';
import { hashPassword, checkPasswordPolicy } from '../lib/password';

/**
 * The six credentialed demonstration logins, from SPEC 3b.
 *
 * FIXED AND KNOWN, ON PURPOSE. These are handed out; a generated secret that has to be
 * copied from a console once is not. What makes that acceptable is not the password --
 * it is lib/rules/scope.ts. A demonstration session sees demonstration rows and nothing
 * else, in both directions, on every surface that reads records. The isolation is the
 * safeguard; the credential is a doorbell.
 *
 * That also means the isolation is now load-bearing in production rather than in a
 * review build. It is covered by tests/demonstration-isolation.test.ts, and it should
 * stay covered.
 *
 * The seeder creates three further accounts -- first-response unit, platform
 * owner and the Order lane reviewer -- because the demonstration records reference them
 * and a walkthrough missing them is broken. Those are reachable from the demonstration
 * panel and carry no password, as before. Only the six below get credentials.
 */
const CREDENTIALED: { login: string; password: string; whoEn: string }[] = [
  { login: 'test_organizer', password: 'Demonstration-Organizer-1', whoEn: 'Organizer, organization recorded' },
  { login: 'test_organizer_pending', password: 'Demonstration-Pending-1', whoEn: 'Organizer, organization pending' },
  { login: 'test_ems', password: 'Demonstration-Ambulance-1', whoEn: 'EMS provider (named by the organizer)' },
  { login: 'test_director', password: 'Demonstration-Director-1', whoEn: 'Event Medical Director (named by the organizer)' },
  { login: 'test_moph', password: 'Demonstration-Reviewer-1', whoEn: 'Ministry reviewer' },
  { login: 'test_moph_admin', password: 'Demonstration-Administrator-1', whoEn: 'Ministry administrator' },
];

/**
 * A reserved TLD (RFC 2606), so nothing here can ever be mistaken for a mailbox that
 * receives. These addresses are sign-in identifiers and nothing else -- no notification,
 * no reset link and no nomination will ever arrive at one.
 */
const EMAIL_DOMAIN = 'demonstration.invalid';

function main(): void {
  /**
   * WHERE, before anything else.
   *
   * This is the correction to a real failure. On the first deployed run DATABASE_PATH
   * was unset, so lib/db.ts fell back to its development default -- a file on the
   * CONTAINER's own disk, which the next deploy destroys -- while an empty volume sat
   * mounted at /data. The command wrote eleven accounts and a full demonstration
   * dataset there and printed "Demonstration accounts provisioned." The operator did
   * everything correctly and the tool told them it had worked.
   *
   * The one fact that would have exposed it -- the path actually written -- was the one
   * the success message left out. So: refuse when the path is not stated, and print the
   * resolved path whatever happens. A provisioning command on a deployed host has no
   * business guessing where the national register lives.
   */
  const configured = process.env['DATABASE_PATH'];
  if (configured === undefined || configured.trim() === '') {
    process.stderr.write(
      `\nREFUSING: DATABASE_PATH IS NOT SET\n\n` +
        `Without it the database falls back to a development default inside the\n` +
        `container, which the next deploy destroys -- and this command would report\n` +
        `success while writing there.\n\n` +
        `On Railway: Variables -> DATABASE_PATH=/data/nehrat.db, then REDEPLOY (a new\n` +
        `variable only reaches a new deployment), then run this again. Check the volume\n` +
        `is mounted at the same path first:\n\n` +
        `  echo "DATABASE_PATH=[$DATABASE_PATH]"\n` +
        `  ls -la /data\n`,
    );
    process.exit(1);
  }
  const target = resolve(configured);

  const db = getDb();

  const existing = db
    .prepare(`SELECT login FROM accounts WHERE is_demo = 1 ORDER BY login`)
    .all() as unknown as { login: string }[];

  if (existing.length > 0) {
    // Not a plain refusal any more: an instance provisioned before the counterparty
    // linkage entered the seeder holds test_ems and test_director with zero linked
    // nominations, and re-provisioning is exactly what must not happen. Repair the
    // linkage, say which it was, and refuse the reseeding either way.
    const repaired = linkDemonstrationCounterparties(db);
    if (repaired > 0) {
      process.stdout.write(
        `\nALREADY PROVISIONED — COUNTERPARTY LINKAGE REPAIRED\n\n` +
          `  database: ${target}\n\n` +
          `  ${repaired} demonstration nomination(s) were not linked to their\n` +
          `  accounts, so the EMS and Director demonstration dashboards rendered\n` +
          `  empty. They are linked now. No account, event or invitation was added.\n`,
      );
      return;
    }
    process.stderr.write(
      `\nREFUSING: THIS INSTANCE ALREADY HOLDS DEMONSTRATION ACCOUNTS\n\n` +
        `  database: ${target}\n\n` +
        existing.map((r) => `  ${r.login}\n`).join('') +
        `\nNothing has been changed. Running again would add a second set of\n` +
        `demonstration events to a register the Ministry reads, and the duplicates\n` +
        `would be indistinguishable from the first set.\n\n` +
        `To provision a fresh instance, point DATABASE_PATH at an empty database.\n`,
    );
    process.exit(1);
  }

  // One clock, one dataset: the same seeder the review build runs, called deliberately.
  seedDemonstration(db);

  const setCredentials = db.prepare(
    `UPDATE accounts SET email = ?, password_hash = ? WHERE login = ? AND is_demo = 1`,
  );

  for (const account of CREDENTIALED) {
    // The policy is Ministry-configurable data (lib/rules/data/auth-policy.json). If it
    // tightens, these fixed passwords must still satisfy it -- so this fails loudly here
    // rather than at a sign-in that quietly never works.
    const policy = checkPasswordPolicy(account.password);
    if (!policy.ok) {
      process.stderr.write(
        `\nREFUSING: the demonstration password for ${account.login} does not satisfy\n` +
          `the configured credential policy (failed: ${policy.failed}). Update the\n` +
          `passwords in scripts/bootstrap-demonstration.ts to match the policy.\n`,
      );
      process.exit(1);
    }
    const result = setCredentials.run(
      `${account.login}@${EMAIL_DOMAIN}`,
      hashPassword(account.password),
      account.login,
    );
    if (result.changes !== 1) {
      process.stderr.write(
        `\nREFUSING: ${account.login} was not created by the seeder, so this script and\n` +
          `lib/demo-seed.ts disagree about which accounts exist. Nothing further has\n` +
          `been written; reconcile the two before running again.\n`,
      );
      process.exit(1);
    }
  }

  const rows = db
    .prepare(`SELECT COUNT(*) AS n FROM accounts WHERE is_demo = 1`)
    .get() as { n: number };

  const width = Math.max(...CREDENTIALED.map((a) => `${a.login}@${EMAIL_DOMAIN}`.length));
  process.stdout.write(
    `\nDemonstration accounts provisioned.\n\n` +
      `  database: ${target}\n\n` +
      `${rows.n} accounts carry is_demo = 1. Six sign in with the credentials below;\n` +
      `the rest are reachable from the demonstration panel on the sign-in page, which\n` +
      `appears because these accounts now exist.\n\n` +
      CREDENTIALED.map(
        (a) =>
          `  ${`${a.login}@${EMAIL_DOMAIN}`.padEnd(width)}  ${a.password.padEnd(30)}  ${a.whoEn}\n`,
      ).join('') +
      `\nThese accounts see demonstration records and nothing else, in both directions.\n` +
      `Their records are excluded from the national registry, every Ministry aggregate\n` +
      `and every reviewer queue.\n\n` +
      `They are not private. Anyone holding one of these can open the platform as that\n` +
      `role. Hand them out on that understanding.\n\n`,
  );
}

main();
