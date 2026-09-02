/**
 * Ending a facility's coverage is a DETERMINATION, not housekeeping (partner
 * ruling, 2026-09-03): a covered facility's obligations are permanent, so the act
 * says the facility is no longer covered, requires the Ministry's reason, and is
 * read by the activity trail. Coverage returns by designation, never un-archiving.
 *
 * Walked on FC-0021, seeded for exactly this -- FC-0014 is half the facility
 * suite's fixture and is not touched.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

test.describe('no longer covered', () => {
  test('the act needs a reason, lands on the trail, and closes the record read-only', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/registry');
    const row = page.locator('div', { hasText: 'Jounieh Aquatic Centre' }).last();
    await row.locator('input[name="reason"]').fill('The aquatic centre has closed permanently.');
    await row.locator('button:has-text("No longer covered")').click();
    await page.waitForURL(/notice=coverage-ended/);
    await expect(page.locator('body')).toContainText('no longer covered');
    // The row now states the determination, dated; the control is gone.
    const after = page.locator('div', { hasText: 'Jounieh Aquatic Centre' }).last();
    await expect(after).toContainText(/No longer covered — \d{4}-\d{2}-\d{2}/);

    // THE ACT IS ON THE ACTIVITY TRAIL: who, when, and the reason as written.
    await gotoRidingRestarts(page, '/ministry/admin/activity');
    await expect(page.locator('[data-region="activity"]')).toContainText('Jounieh Aquatic Centre');
    await expect(page.locator('[data-region="activity"]')).toContainText(
      'No longer covered — The aquatic centre has closed permanently.',
    );
  });

  test('the operator reads the determination on a read-only record, under Previous services', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/facilities/FC-0021');
    const band = page.locator('[data-region="archived-band"]');
    await expect(band).toContainText('No longer covered by the Ministry');
    await expect(band).toContainText('The aquatic centre has closed permanently.');
    await expect(band).toContainText('Coverage returns by Ministry designation');

    // Off the LIVE dashboard sections, into the collapsed section, still openable.
    // (main still contains the name -- inside previous-services -- so the absence
    // is asserted on everything OUTSIDE that details element.)
    await gotoRidingRestarts(page, '/dashboard');
    await expect(page.locator('main > :not([data-region="previous-services"])').filter({ hasText: 'Jounieh Aquatic Centre' })).toHaveCount(0);
    await page.locator('[data-region="previous-services"] > summary').click();
    await expect(page.locator('[data-region="previous-facilities"]')).toContainText('Jounieh Aquatic Centre');
  });
});
