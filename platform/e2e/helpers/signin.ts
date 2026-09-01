/**
 * Signing in as a demonstration role, and PROVING it took.
 *
 * THE BUG THIS REPLACES. Every app spec carried its own copy of:
 *
 *   await page.goto('/signin');
 *   await page.locator(`form:has(input[value="${login}"]) button`).first().click();
 *   await page.waitForURL((url) => !url.pathname.includes('/signin')
 *                              || url.search.includes('notice='));
 *
 * The second clause is the problem. It exists for a landing that carries a notice,
 * but `waitForURL` evaluates the CURRENT url first -- and if the previous page was
 * something like /events/EV-0244/incident?notice=notified and the address had not
 * yet settled after the goto, that clause matched the OLD url and the helper
 * returned before the click's navigation had landed. The next goto then cancelled
 * the sign-in, the session never changed, and the test carried on as the previous
 * role. In the run that exposed this, a reviewer assertion ran as the organizer and
 * read a 404 -- the CORRECT refusal for that role, so nothing looked broken except
 * a missing region.
 *
 * A sign-in helper that can silently not sign in is worse than no helper. This one
 * waits for the role's OWN landing route, which is derived from the same
 * landingRouteFor the product uses, so a no-op cannot pass.
 */

import { expect, type Page } from '@playwright/test';
import { gotoRidingRestarts } from './resilient';

/**
 * Where each demonstration login lands. Mirrors lib/rules/roles.ts landingRouteFor;
 * kept as data here rather than imported so a wrong landing fails the test instead
 * of agreeing with itself.
 */
export const LANDING: Record<string, string> = {
  test_organizer: '/dashboard',
  test_organizer_queue: '/dashboard',
  test_ems: '/dashboard',
  test_director: '/dashboard',
  test_response: '/first-response/readiness',
  test_moph: '/ministry',
  test_moph_admin: '/ministry',
  test_owner: '/platform/admin',
  test_order: '/ministry/order',
};

export async function signInAs(page: Page, login: string): Promise<void> {
  await gotoRidingRestarts(page, '/signin');
  const form = page.locator(`form:has(input[value="${login}"])`);
  // One form per demonstration role. If this ever becomes one form with many
  // buttons, `.first()` would click the wrong role and every later assertion would
  // run as somebody else -- so the shape is asserted, not assumed.
  await expect(form, `no sign-in form for ${login}`).toHaveCount(1);
  await form.locator('button').first().click();

  const landing = LANDING[login];
  if (landing) {
    await page.waitForURL((url) => url.pathname === landing, { timeout: 30_000 });
  } else {
    await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30_000 });
  }
}
