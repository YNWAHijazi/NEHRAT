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
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

/** The demonstration logins from SPEC 3b -- the roles the Ministry walks the platform with. */
const LOGINS = {
  organizer: 'test_organizer',
  ems: 'test_ems',
  director: 'test_director',
  response: 'test_response',
  reviewer: 'test_moph',
  inspector: 'test_inspector',
  admin: 'test_moph_admin',
} as const;


/**
 * Asserts a navigation was refused: not-found, forbidden, or bounced to sign-in.
 * A 200 that renders the surface is the failure.
 */
async function expectRefusal(page: Page, path: string, marker: RegExp): Promise<void> {
  const response = await gotoRidingRestarts(page, path);
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
test.describe('the organizer surface belongs to the organizer', () => {
  // A Ministry role signing in used to LAND here: the credentialed sign-in redirected
  // every account to /dashboard regardless of role, so an administrator arrived at
  // Events, Venues, Facilities and a Start a service menu -- controls for a job that
  // role does not do. The refusal and the landing are both asserted, because fixing
  // one without the other leaves the surface reachable by typing the address.
  for (const [name, login] of [
    ['a reviewer', LOGINS.reviewer],
    ['an inspector', LOGINS.inspector],
    ['a Ministry administrator', LOGINS.admin],
  ] as const) {
    test(`${name} is refused the organizer dashboard`, async ({ page }) => {
      await signInAs(page, login);
      await expectRefusal(page, '/dashboard', /Start a service|ابدأ خدمة/i);
    });
  }

  test('a Ministry role lands on the console, not on the organizer dashboard', async ({ page }) => {
    await signInAs(page, LOGINS.reviewer);
    expect(new URL(page.url()).pathname).toBe('/ministry');
  });

  test('the Start a service menu does not exist for a Ministry role', async ({ page }) => {
    await signInAs(page, LOGINS.admin);
    await gotoRidingRestarts(page, '/ministry');
    // Not hidden -- unreachable. The menu lives only on the surface they are refused.
    // ANCHORED: both assertions here are absences, and on a 404 both used to pass.
    await expectAbsent(page, {
      absent: '[data-svc-menu]',
      anchor: /Ministry|الوزارة/,
      because: 'a Ministry role must not carry the organizer Start a service menu',
    });
    await expect(page.locator('body')).not.toContainText('Start a service');
  });
});

test.describe('platform-owner surfaces are above the Ministry', () => {
  test('a reviewer cannot reach platform activity', async ({ page }) => {
    // Real since Slice 6: the surface exists and a reviewer is refused.
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
    await expectRefusal(page, '/ministry/admin/cardiac', /cardiac-arrest configuration|إعدادات الجاهزية/i);
    await expectRefusal(page, '/ministry/admin/users', /users and roles|المستخدمون والأدوار/i);
  });

  test('an inspector holds no outcome control and no admin surface', async ({ page }) => {
    // The inspector reaches the queue and a submission, and the outcome block is
    // ABSENT there -- not greyed (rule 10). Admin surfaces refuse outright.
    await signInAs(page, 'test_inspector');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    await expectAbsent(page, {
      absent: '[data-region="outcome"]',
      anchor: /Inspections|التفتيشات/,
      because: 'the outcome block is ABSENT for an inspector, not greyed (rule 10)',
    });
    await expectRefusal(page, '/ministry/admin/cardiac', /cardiac-arrest configuration|إعدادات الجاهزية/i);
    await expectRefusal(page, '/platform/activity', /platform activity|نشاط المنصة/i);
  });

  test('an organizer cannot reach the review queue', async ({ page }) => {
    await signInAs(page, LOGINS.organizer);
    await expectRefusal(page, '/ministry/queue', /review queue|قائمة المراجعة/i);
    await expectRefusal(page, '/ministry', /operational dashboard|اللوحة التشغيلية/i);
  });
});

test.describe('an organizer never sees another organizer\'s records', () => {
  test('a foreign event id refuses like a missing one', async ({ page }) => {
    await signInAs(page, LOGINS.organizer);
    // EV-0001 belongs to no demonstration organizer. Ownership refusal must be
    // indistinguishable from non-existence -- a 403 here and a 404 there would let an
    // attacker map which ids exist.
    const foreign = await gotoRidingRestarts(page, '/events/EV-0001');
    const foreignStatus = foreign?.status() ?? 0;
    const missing = await gotoRidingRestarts(page, '/events/EV-9999');
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
      const foreign = await gotoRidingRestarts(page, `/venues/VN-0001${suffix}`);
      const foreignStatus = foreign?.status() ?? 0;
      const missing = await gotoRidingRestarts(page, `/venues/VN-9999${suffix}`);
      const missingStatus = missing?.status() ?? 0;
      expect(foreignStatus, `/venues/VN-0001${suffix}`).toBe(missingStatus);
      expect([401, 403, 404]).toContain(foreignStatus);
    }
  });
});

test.describe('nominated roles see only what they were named in', () => {
  test('an EMS provider cannot open an event it was not named in', async ({ page }) => {
    // Real since Slice 5: the surface exists and test_ems holds two nominations.
    await signInAs(page, LOGINS.ems);
    await expectRefusal(page, '/events/EV-0001/participation', /Event participation|المشاركة في الفعالية/i);
    await expectRefusal(page, '/events/EV-0001/declaration', /Readiness Declaration|إقرار جاهزية/i);
    // Not even the ORGANIZER'S OWN record: nomination scopes the route, not the role.
    await expectRefusal(page, '/events/EV-0301/participation', /Event participation|المشاركة في الفعالية/i);
  });

  test('a medical director cannot open an unnamed event', async ({ page }) => {
    // Real since Slice 5: test_director holds nominations on EV-0362 and EV-0244,
    // and an unnamed event refuses like a missing one.
    await signInAs(page, LOGINS.director);
    await expectRefusal(page, '/events/EV-0418', /What you are responsible for|ما أنتم مسؤولون عنه/i);
    await expectRefusal(page, '/events/EV-0418/governance', /Clinical governance|الحوكمة السريرية/i);
    await expectRefusal(page, '/events/EV-0418/report', /Post-event medical report|التقرير الطبي/i);
  });

  test('the two EMS-side actors never share a surface', async ({ page }) => {
    // The first-response unit's account cannot open the provider surfaces, and the
    // provider's account cannot open the unit's -- different instruments (SPEC).
    await signInAs(page, LOGINS.response);
    await expectRefusal(page, '/events/EV-0362/declaration', /Readiness Declaration|إقرار جاهزية/i);
    await signInAs(page, LOGINS.ems);
    const r = await gotoRidingRestarts(page, '/first-response/readiness');
    const refused = page.url().includes('/signin') || page.url().includes('/dashboard') || [401, 403, 404].includes(r?.status() ?? 0);
    expect(refused, 'the EMS provider account reached the first-response surface').toBe(true);
  });
});

test.describe('signed out', () => {
  test('every built authenticated surface bounces to sign-in', async ({ page }) => {
    // Only surfaces that EXIST are asserted -- a 404 on an unbuilt route would pass
    // vacuously. Extend this list as slices land.
    for (const path of ['/dashboard', '/organization', '/notifications', '/events/EV-0418', '/events/new', '/venues/new', '/venues/VN-0032', '/venues/VN-0032/assessment', '/venues/VN-0032/change', '/facilities/new', '/facilities/FC-0014', '/facilities/FC-0014/devices', '/facilities/FC-0014/plan', '/profile', '/credentials', '/first-response/readiness', '/first-response/reports/new', '/events/EV-0362/declaration', '/events/EV-0362/governance', '/ministry', '/ministry/queue', '/ministry/submissions/EV-0362', '/ministry/admin/cardiac', '/platform/admin', '/platform/activity']) {
      const response = await gotoRidingRestarts(page, path);
      const refused =
        page.url().includes('/signin') || [401, 403].includes(response?.status() ?? 0);
      expect(refused, `${path} served content to a signed-out visitor`).toBe(true);
    }
  });
});
