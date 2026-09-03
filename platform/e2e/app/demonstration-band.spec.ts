/**
 * THE DEMONSTRATION BAND IS THE ONLY THING THAT SURVIVES THE SCREENSHOT. Six
 * demonstration accounts carry published credentials on a deployed instance
 * (non-negotiable 8); scope isolation keeps their sessions off real records,
 * but isolation is invisible -- a screenshotted demonstration determination is
 * indistinguishable from a real one unless the screen itself says otherwise.
 *
 * The band was built with the credentials (dc459bf) and mounted in the root
 * layout -- and NOTHING PINNED IT. An unasserted safety strip is one refactor
 * from silently gone, and it read as never-built in review precisely because
 * no test would have noticed either way. This spec is the pin: presence on
 * every session surface that matters (including the determination the threat
 * model names), both languages, absence for the public, and survival on paper.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

const BAND = '[data-demonstration-band]';

test.describe('the demonstration band', () => {
  test('rides every screen of a demonstration session, in both languages', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    for (const route of ['/dashboard', '/events/EV-0418', '/facilities/FC-0014', '/events/EV-0418/submit']) {
      await gotoRidingRestarts(page, route);
      const band = page.locator(BAND);
      await expect(band, `${route} must carry the band`).toBeVisible();
      await expect(band).toContainText('Every record shown here is an example. Nothing recorded in this account is a Ministry determination');
      await expect(band).toContainText('كل سجل معروض هنا مثال');
    }
  });

  test('rides the console too — the recorded determination is the screenshot the band exists for', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0301');
    await expect(page.locator(BAND)).toBeVisible();
    await expect(page.locator('body')).toContainText('Submission received but incomplete');
  });

  test('absent for the public — the band marks a session, not the platform', async ({ page }) => {
    await gotoRidingRestarts(page, '/');
    await expectAbsent(page, {
      absent: BAND,
      anchor: /National Health and Medical Readiness/,
      because: 'an anonymous visitor is not in a demonstration session',
    });
  });

  test('survives onto paper: the print rule keeps the band visible over the certificate', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // EV-0244 carries the satisfied determination; its certificate is the
    // printable determination screen.
    await gotoRidingRestarts(page, '/events/EV-0244/determination');
    await expect(page.locator('[data-region="certificate"]')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const visibility = await page.locator(BAND).evaluate((el) => window.getComputedStyle(el).visibility);
    expect(visibility, 'the band must print with the certificate — paper is the threat model').toBe('visible');
    await page.emulateMedia({ media: 'screen' });
  });
});
