/**
 * Permission refusals, by navigation.
 *
 * Not unit tests of a policy function -- the browser goes to the URL as the wrong role
 * and the response must refuse. These encode ROADMAP 5's tiers and SPEC 3's ownership
 * rules as mechanical facts about routes.
 *
 * This project only runs once app/ exists (see playwright.config.ts). The specs are
 * written first so Slice 1 arrives into them, not the other way round.
 *
 * Refusal contract, deliberately narrow: the wrong role gets a 401/403/404 status or a
 * redirect to sign-in. What it must NEVER get is a 200 carrying the surface's content.
 */

import { test, expect, type Page } from '@playwright/test';

/** The demonstration logins from SPEC 3b -- the roles the Ministry walks the platform with. */
const LOGINS = {
  organizer: 'test_organizer',
  ems: 'test_ems',
  director: 'test_director',
  response: 'test_response',
  reviewer: 'test_moph',
  admin: 'test_moph_admin',
} as const;

async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel(/username|اسم المستخدم/i).fill(login);
  await page.getByRole('button', { name: /sign in|تسجيل الدخول/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/signin'));
}

/**
 * Asserts a navigation was refused: not-found, forbidden, or bounced to sign-in.
 * A 200 that renders the surface is the failure.
 */
async function expectRefusal(page: Page, path: string, marker: RegExp): Promise<void> {
  const response = await page.goto(path);
  const status = response?.status() ?? 0;
  const landedOnSignin = page.url().includes('/signin');
  const refusedByStatus = status === 401 || status === 403 || status === 404;
  expect(
    refusedByStatus || landedOnSignin,
    `${path} answered ${status} at ${page.url()} -- neither an error status nor a sign-in redirect`,
  ).toBe(true);
  // And the surface's content must not be present regardless of how it refused.
  await expect(page.locator('body')).not.toContainText(marker);
}

test.describe('platform-owner surfaces are above the Ministry', () => {
  test('a reviewer cannot reach platform activity', async ({ page }) => {
    await signInAs(page, LOGINS.reviewer);
    await expectRefusal(page, '/platform/activity', /platform activity|نشاط المنصة/i);
  });

  test('a Ministry administrator cannot reach platform activity', async ({ page }) => {
    // ROADMAP 5: "A Ministry administrator cannot reach these." The stronger role is the
    // one worth testing -- admin outranks reviewer everywhere else.
    await signInAs(page, LOGINS.admin);
    await expectRefusal(page, '/platform/activity', /platform activity|نشاط المنصة/i);
  });

  test('a Ministry administrator cannot reach master admin', async ({ page }) => {
    await signInAs(page, LOGINS.admin);
    await expectRefusal(page, '/platform/admin', /master admin|الإدارة العليا/i);
  });
});

test.describe('Ministry tiers', () => {
  test('a reviewer cannot reach administrator configuration', async ({ page }) => {
    await signInAs(page, LOGINS.reviewer);
    await expectRefusal(
      page,
      '/ministry/admin/configuration',
      /configuration and versioning|الإعدادات/i,
    );
  });

  test('an organizer cannot reach the review queue', async ({ page }) => {
    await signInAs(page, LOGINS.organizer);
    await expectRefusal(page, '/ministry/queue', /review queue|قائمة المراجعة/i);
  });
});

test.describe('an organizer never sees another organizer\'s records', () => {
  test('a foreign event id refuses like a missing one', async ({ page }) => {
    await signInAs(page, LOGINS.organizer);
    // EV-0001 belongs to no demonstration organizer. Ownership refusal must be
    // indistinguishable from non-existence -- a 403 here and a 404 there would let an
    // attacker map which ids exist.
    const foreign = await page.goto('/events/EV-0001');
    const foreignStatus = foreign?.status() ?? 0;
    const missing = await page.goto('/events/EV-9999');
    const missingStatus = missing?.status() ?? 0;
    expect(foreignStatus).toBe(missingStatus);
    expect([401, 403, 404]).toContain(foreignStatus);
  });
});

test.describe('nominated roles see only what they were named in', () => {
  test('an EMS provider cannot open an event it was not named in', async ({ page }) => {
    await signInAs(page, LOGINS.ems);
    await expectRefusal(page, '/events/EV-0001/participation', /participation|المشاركة/i);
  });

  test('a medical director cannot open an unnamed event', async ({ page }) => {
    await signInAs(page, LOGINS.director);
    await expectRefusal(page, '/events/EV-0001', /event record|سجل الفعالية/i);
  });
});

test.describe('signed out', () => {
  test('every authenticated surface bounces to sign-in', async ({ page }) => {
    for (const path of ['/dashboard', '/ministry', '/ministry/queue', '/platform/activity']) {
      const response = await page.goto(path);
      const refused =
        page.url().includes('/signin') || [401, 403, 404].includes(response?.status() ?? 0);
      expect(refused, `${path} served content to a signed-out visitor`).toBe(true);
    }
  });
});
