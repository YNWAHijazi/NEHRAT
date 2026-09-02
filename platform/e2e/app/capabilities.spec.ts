/**
 * THE SHAPE (partner ruling, 2026-09-02): the capability list does not toggle --
 * each capability has its own page with what it is, the toggle top right, and its
 * configuration beneath. A capability with no configuration cannot be enabled,
 * and the disabled toggle names what is missing. Turning one on is a licensing
 * act recorded with who, when, and the configuration at that moment.
 *
 * And the refusal is VERIFIED, not assumed: the Ministry administrator cannot
 * reach any of this -- these are platform-owner capabilities.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

test.describe('the capability shape', () => {
  test('the list carries no control, and the page enforces enable-requires-configuration end to end', async ({ page }) => {
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin');

    // A list, only a list: state and an Open link per row, both groups titled.
    const flags = page.locator('[data-region="flags"]');
    await expect(flags).toContainText('Commercial');
    await expect(flags).toContainText('Assistive');
    await expect(flags.locator('button')).toHaveCount(0);
    await expect(flags).toContainText('Application fees');

    // The capability's own page: toggle disabled, naming every missing field.
    await flags.locator('a[href="/platform/admin/capabilities/applicationFees"]').click();
    await page.waitForURL(/capabilities\/applicationFees/);
    const toggle = page.locator('[data-region="capability-toggle"]');
    await expect(toggle.locator('button[disabled]')).toHaveCount(1);
    await expect(toggle).toContainText('Configuration missing: Currency.');
    await expect(toggle).toContainText('Configuration missing: Fee — certify an event.');

    // Configure -- a zero fee is a value, an unset one is not.
    const config = page.locator('[data-region="capability-config"]');
    await config.locator('select[name="currency"]').selectOption('USD');
    await config.locator('input[name="feeCertifyEvent"]').fill('0');
    await config.locator('input[name="feeRegisterVenue"]').fill('0');
    await config.locator('input[name="feeRegisterFacility"]').fill('0');
    await config.locator('select[name="variesByLevel"]').selectOption('no');
    await config.locator('button:has-text("Store the configuration")').click();
    await page.waitForURL(/notice=config/);

    // The toggle is live now, and the act is recorded with the snapshot.
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(0);
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);
    const acts = page.locator('[data-region="capability-acts"]');
    await expect(acts).toContainText('Turned on');
    await expect(acts).toContainText('currency: USD');
    await expect(acts).toContainText('Platform operations');

    // The licensing act reads on the activity trail.
    await gotoRidingRestarts(page, '/ministry/admin/activity');
    const trail = page.locator('[data-region="activity"]');
    await expect(trail).toContainText('applicationFees');
    await expect(trail).toContainText('Turned on');

    // Off again -- always allowed, recorded the same way. The suite leaves the
    // tenant as it found it: nothing commercial on.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/applicationFees');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    await expect(page.locator('[data-region="capability-acts"]')).toContainText('Turned off');
  });

  test('dependencies, readiness checks and the unmade decision each name themselves', async ({ page }) => {
    await signInAs(page, 'test_owner');

    // Sponsored listings depends on the directory, and says so.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/sponsoredListings');
    await expect(page.locator('[data-region="capability-toggle"]')).toContainText('Needs Vendor directory on first.');
    await expect(page.locator('[data-region="dependency"]')).toContainText('Depends on Vendor directory.');

    // The directory itself waits on a listed vendor -- a fact, not a field.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await expect(page.locator('[data-region="capability-checks"]')).toContainText('At least one listed vendor');
    await expect(page.locator('[data-region="capability-checks"]')).toContainText('Not yet met');
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(1);

    // Platform intelligence: the contradiction is surfaced as an open decision,
    // and no configuration unblocks it.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/aiPlatformIntelligenceAssistant');
    await expect(page.locator('[data-region="open-decision"]')).toContainText('full tenant visibility');
    await expect(page.locator('[data-region="open-decision"]')).toContainText('counts only');
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(1);
  });

  test('the Ministry administrator cannot reach any of it, and the configuration tab no longer shows switches', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');

    // The refusal, verified: the capability pages 404 like any route above the
    // role's permission -- manageFlags is the owner's alone.
    for (const path of ['/platform/admin/capabilities/applicationFees', '/platform/admin/capabilities/vendorDirectory']) {
      const response = await gotoRidingRestarts(page, path);
      const status = response?.status() ?? 0;
      expect(status === 404 || page.url().includes('/signin'), `${path} answered ${status}`).toBe(true);
      await expect(page.locator('body')).not.toContainText('Store the configuration');
    }

    // Absent entirely on the Ministry's configuration tab -- these never apply here.
    await gotoRidingRestarts(page, '/ministry/admin/configuration');
    await expect(page.locator('main')).not.toContainText('Capability switches');
    await expect(page.locator('[data-region="flags"]')).toHaveCount(0);
  });

  test('the two AED registry capabilities are Ministry switches under cardiac configuration', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/cardiac');
    const region = page.locator('[data-region="registry-capabilities"]');
    await expect(region).toContainText('Geolocation registry');
    await expect(region).toContainText('Automated upkeep notifications');
    await expect(region).toContainText('regulatory, not commercial');

    // A Ministry switch that works: on, recorded with who and when, then off.
    const row = region.locator('> div > div').filter({ hasText: 'Automated upkeep notifications' });
    await row.locator('button:has-text("Turn on")').click();
    await page.waitForURL(/notice=capability/);
    const after = page.locator('[data-region="registry-capabilities"] > div > div').filter({ hasText: 'Automated upkeep notifications' });
    await expect(after).toContainText('ON');
    await expect(after).toContainText(/Recorded \d{4}-\d{2}-\d{2}/);
    await after.locator('button:has-text("Turn off")').click();
    await page.waitForURL(/notice=capability/);
  });
});
