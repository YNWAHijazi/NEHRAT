/**
 * Ministry account administration, walked.
 *
 * The ruling (2026-08-28): the administrator sees and manages EVERY account with its
 * origin shown, creates accounts by issuing an activation link, changes roles and
 * suspends or restores — never their own row, never the platform owner's — and is
 * told what an account holds before acting on it.
 *
 * THE LOAD-BEARING ASSERTION is that no password crosses the administrator's screen.
 * An administrator who can set a password can sign in as that person, and every act
 * that person then performs is recorded against their name.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

/**
 * A fresh email per run. These tests CREATE accounts, and an email is unique in the
 * schema -- so a retry, or a second run against a database that was not re-seeded,
 * collided with its own first attempt and failed on email-taken. That reads as a
 * product defect and is a test writing over its own state.
 */
const unique = (prefix: string): string => `${prefix}.${Date.now().toString(36)}@example.lb`;

test.describe('the console sees every account', () => {
  test('all eight roles, not the four Ministry ones', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const users = page.locator('[data-region="users"]');
    await expect(users).toBeVisible();
    // The counterparty roles were invisible here: they exist, they sign in, and an
    // administrator asked to manage the accounts could not see them.
    //
    // RULING (partner review, 2026-09-01): the inspector role is MERGED into reviewer.
    // One Ministry role reviews, flags for inspection, self-assigns the visit and
    // records findings; there is no separate inspector account any more, so this test
    // stopped expecting one and now pins the FULL set of eight -- every role in
    // lib/rules roleLabels, Ministry side and counterparty side alike.
    for (const role of [
      'Organizer', 'EMS provider', 'Event Medical Director', 'First-response unit',
      'Reviewer', 'Administrator', 'Order of Physicians reviewer', 'Platform owner',
    ]) {
      await expect(users, `${role} is missing from the console`).toContainText(role);
    }
    // And the retired role must not resurface: an "Inspector" row here would mean the
    // merge regressed somewhere between the schema migration and this screen.
    await expect(users).not.toContainText('Inspector');
  });

  test('every row says where the account came from', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const origins = page.locator('[data-region="origin"]');
    const rows = page.locator('[data-region="holdings"]');
    await expect(origins.first()).toBeVisible();
    // One origin and one holdings line per account: an account with no origin is a
    // row nobody can account for.
    expect(await origins.count()).toBeGreaterThanOrEqual(9);
    expect(await origins.count()).toBe(await rows.count());
  });

  test('the untouchable rows name who holds them instead of hiding the control', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const bars = page.locator('[data-region="bar"]');
    // Two: the administrator's own row and the platform owner's.
    await expect(bars).toHaveCount(2);
    await expect(bars.first()).toBeVisible();
    const text = await bars.allInnerTexts();
    expect(text.join(' ')).toMatch(/your own account/i);
    expect(text.join(' ')).toMatch(/platform owner/i);
  });
});

test.describe('creating an account', () => {
  test('issues a link and never asks for a password', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const form = page.locator('[data-region="add-user"]');
    await form.locator('summary').click();

    // THE POINT: no password field exists on this screen at all.
    await expectAbsent(page, {
      absent: 'input[type="password"]',
      anchor: form.locator('input[name="email"]'),
      because: 'the administrator never sets or sees a password',
    });

    const name = `Console Walk ${Date.now().toString(36)}`;
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="email"]').fill(unique('console.walk'));
    await form.locator('select[name="role"]').selectOption('reviewer');
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/notice=invited/);

    // The link is handed over, once, and it names where it goes.
    const issued = page.locator('[data-region="issued-link"]');
    await expect(issued).toBeVisible();
    const href = (await issued.locator('code').innerText()).trim();
    expect(href).toMatch(/^\/activate\/[0-9a-f]{64}$/);

    // The account is listed, pending, with a route out of that state.
    const row = page.locator('[data-region="users"] > div', { hasText: name });
    await expect(row).toContainText('Pending');
    await expect(row).toContainText('Issue a new link');
  });

  test('the link sets the holder\'s own password and signs them in', async ({ page, context }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const form = page.locator('[data-region="add-user"]');
    await form.locator('summary').click();
    await form.locator('input[name="name"]').fill('Activation Walk');
    await form.locator('input[name="email"]').fill(unique('activation.walk'));
    await form.locator('select[name="role"]').selectOption('reviewer');
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/notice=invited/);
    const link = (await page.locator('[data-region="issued-link"] code').innerText()).trim();

    // The recipient is not the administrator: a fresh session, on the link alone.
    await context.clearCookies();
    await gotoRidingRestarts(page, link);
    await expect(page.locator('[data-region="set-password"]')).toBeVisible();
    await page.locator('input[name="password"]').fill('Nq7#reviewPass!2026');
    await page.locator('input[name="confirm"]').fill('Nq7#reviewPass!2026');
    await page.locator('button[type="submit"]').click();
    // Signed in, and landed on their own role's surface.
    await page.waitForURL('**/ministry');

    // SINGLE USE: the same link is dead the moment it has been spent.
    await context.clearCookies();
    await gotoRidingRestarts(page, link);
    await expect(page.locator('[data-region="activation-dead"]')).toBeVisible();
  });

  test('an invented token answers exactly as a spent one does', async ({ page }) => {
    // Distinguishing them would tell whoever is holding a guessed token which
    // guesses are close.
    await gotoRidingRestarts(page, `/activate/${'0'.repeat(64)}`);
    await expect(page.locator('[data-region="activation-dead"]')).toBeVisible();
    await expectAbsent(page, {
      absent: '[data-region="set-password"]',
      anchor: '[data-region="activation-dead"]',
      because: 'a token nobody issued sets no password',
    });
  });
});
