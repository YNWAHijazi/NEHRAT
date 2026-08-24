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

/**
 * Signs in through the demonstration-login buttons on /signin. Roles whose surfaces are
 * not yet built are bounced back to /signin with a build notice -- their session still
 * exists, which is exactly what these refusal tests need: a signed-in wrong role.
 */
async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`form:has(input[value="${login}"]) button`).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/signin') || url.search.includes('notice='));
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

/**
 * VACUOUS UNTIL THEIR SURFACES EXIST. Every route below 404s for everyone today, so a
 * "refusal" proves nothing about role gating -- and a green test implying coverage it
 * lacks is worse than a red one. Skipped, with the slice that unskips each. The refusal
 * contract they will enforce is already written.
 */
test.describe('platform-owner surfaces are above the Ministry', () => {
  test('a reviewer cannot reach platform activity', async ({ page }) => {
    test.skip(true, 'Vacuous: /platform/activity 404s for everyone until Slice 6 builds it.');
    await signInAs(page, LOGINS.reviewer);
    await expectRefusal(page, '/platform/activity', /platform activity|نشاط المنصة/i);
  });

  test('a Ministry administrator cannot reach platform activity', async ({ page }) => {
    // ROADMAP 5: "A Ministry administrator cannot reach these." The stronger role is the
    // one worth testing -- admin outranks reviewer everywhere else.
    test.skip(true, 'Vacuous: /platform/activity 404s for everyone until Slice 6 builds it.');
    await signInAs(page, LOGINS.admin);
    await expectRefusal(page, '/platform/activity', /platform activity|نشاط المنصة/i);
  });

  test('a Ministry administrator cannot reach master admin', async ({ page }) => {
    test.skip(true, 'Vacuous: /platform/admin 404s for everyone until Slice 6 builds it.');
    await signInAs(page, LOGINS.admin);
    await expectRefusal(page, '/platform/admin', /master admin|الإدارة العليا/i);
  });
});

test.describe('Ministry tiers', () => {
  test('a reviewer cannot reach administrator configuration', async ({ page }) => {
    test.skip(true, 'Vacuous: /ministry/admin/configuration 404s for everyone until Slice 6 builds it.');
    await signInAs(page, LOGINS.reviewer);
    await expectRefusal(
      page,
      '/ministry/admin/configuration',
      /configuration and versioning|الإعدادات/i,
    );
  });

  test('an organizer cannot reach the review queue', async ({ page }) => {
    test.skip(true, 'Vacuous: /ministry/queue 404s for everyone until Slice 6 builds it.');
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

  test('a foreign venue id refuses like a missing one', async ({ page }) => {
    // Same property on the venue service (Slice 3): VN-0001 belongs to no demonstration
    // organizer, VN-9999 to nobody; the record, the assessment and the change screen
    // must all be indistinguishable between the two.
    await signInAs(page, LOGINS.organizer);
    for (const suffix of ['', '/assessment', '/change']) {
      const foreign = await page.goto(`/venues/VN-0001${suffix}`);
      const foreignStatus = foreign?.status() ?? 0;
      const missing = await page.goto(`/venues/VN-9999${suffix}`);
      const missingStatus = missing?.status() ?? 0;
      expect(foreignStatus, `/venues/VN-0001${suffix}`).toBe(missingStatus);
      expect([401, 403, 404]).toContain(foreignStatus);
    }
  });
});

test.describe('nominated roles see only what they were named in', () => {
  test('an EMS provider cannot open an event it was not named in', async ({ page }) => {
    test.skip(true, 'Vacuous: the EMS surface arrives in Slice 5; the route 404s for everyone today.');
    await signInAs(page, LOGINS.ems);
    await expectRefusal(page, '/events/EV-0001/participation', /participation|المشاركة/i);
  });

  test('a medical director cannot open an unnamed event', async ({ page }) => {
    // Not fully vacuous -- /events/:id exists -- but the director ROLE cannot yet hold a
    // nomination, so the refusal tested (unnamed event) cannot be distinguished from
    // "role has no events at all". Real once Slice 5 gives directors nominations.
    test.skip(true, 'Vacuous until Slice 5: directors cannot yet be named in any event.');
    await signInAs(page, LOGINS.director);
    await expectRefusal(page, '/events/EV-0001', /event record|سجل الفعالية/i);
  });
});

test.describe('signed out', () => {
  test('every built authenticated surface bounces to sign-in', async ({ page }) => {
    // Only surfaces that EXIST are asserted -- a 404 on an unbuilt route would pass
    // vacuously. Extend this list as slices land.
    for (const path of ['/dashboard', '/organization', '/notifications', '/events/EV-0418', '/events/new', '/venues/new', '/venues/VN-0032', '/venues/VN-0032/assessment', '/venues/VN-0032/change']) {
      const response = await page.goto(path);
      const refused =
        page.url().includes('/signin') || [401, 403].includes(response?.status() ?? 0);
      expect(refused, `${path} served content to a signed-out visitor`).toBe(true);
    }
  });
});
