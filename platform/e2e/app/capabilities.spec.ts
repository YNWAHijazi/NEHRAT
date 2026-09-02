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
    await expect(toggle).toContainText('Configuration missing: Fee — certify an event (Level 1 when the fee varies by level).');

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

  test('application fees: nothing renders while off, the amount renders while on, and filing names the unpaid fee', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_owner');

    // A real fee, stored. The capability stays OFF -- and configured-but-off
    // still renders exactly what always rendered: nothing commercial.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/applicationFees');
    const config = page.locator('[data-region="capability-config"]');
    await config.locator('select[name="currency"]').selectOption('USD');
    await config.locator('input[name="feeCertifyEvent"]').fill('100');
    await config.locator('input[name="feeRegisterVenue"]').fill('0');
    await config.locator('input[name="feeRegisterFacility"]').fill('0');
    await config.locator('select[name="variesByLevel"]').selectOption('no');
    await config.locator('button:has-text("Store the configuration")').click();
    await page.waitForURL(/notice=config/);
    await gotoRidingRestarts(page, '/services/certify-an-event');
    await expect(page.locator('[data-region="fee-lines"]')).toContainText('Fee: None.');
    await expect(page.locator('[data-region="fee-lines"]')).not.toContainText('100');

    // On: the fee appears on the service page before an organizer starts...
    await gotoRidingRestarts(page, '/platform/admin/capabilities/applicationFees');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);
    await gotoRidingRestarts(page, '/services/certify-an-event');
    await expect(page.locator('[data-region="fee-lines"]')).toContainText('Fee: 100 USD.');

    // ...and on the submission package as an amount due, with filing naming it.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    const due = page.locator('[data-region="amount-due"]');
    await expect(due).toContainText('Application fee');
    await expect(due).toContainText('Amount due: 100 USD');
    await expect(due).toContainText('No payment channel is configured on the platform yet');
    await expect(page.locator('body')).toContainText('Application fee — awaiting payment: 100 USD');

    // Off again, fee cleared: the tenant leaves as it arrived, and the region
    // is ABSENT for the organizer, not greyed.
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/applicationFees');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    await page.locator('[data-region="capability-config"] input[name="feeCertifyEvent"]').fill('0');
    await page.locator('[data-region="capability-config"] button:has-text("Store the configuration")').click();
    await page.waitForURL(/notice=config/);
    await gotoRidingRestarts(page, '/services/certify-an-event');
    await expect(page.locator('[data-region="fee-lines"]')).toContainText('Fee: None.');
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    await expect(page.locator('[data-region="amount-due"]')).toHaveCount(0);
  });

  test('vendor directory: a listed vendor readies the toggle, the public page and links exist only while on', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_owner');

    // The directory's content is its configuration: add a vendor while OFF.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    const manager = page.locator('[data-region="vendor-manager"]');
    await manager.locator('input[name="nameEn"]').fill('Cedar Medical Supplies');
    await manager.locator('input[name="nameAr"]').fill('لوازم الأرز الطبية');
    await manager.locator('select[name="category"]').selectOption('defibrillatorSupply');
    await manager.locator('input[name="contact"]').fill('01 000 000');
    await manager.locator('input[name="area"]').fill('Beirut');
    await manager.locator('button:has-text("Add the vendor")').click();
    await page.waitForURL(/notice=vendor-added/);

    // The readiness check flips to met and the toggle is live.
    await expect(page.locator('[data-region="capability-checks"]')).toContainText('Met');
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(0);

    // Listed but OFF: the public route does not exist, the operator link is absent.
    const offResponse = await gotoRidingRestarts(page, '/vendors');
    expect(offResponse?.status()).toBe(404);

    // On: the public page carries the category, the vendor and the disclaimer.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);
    await gotoRidingRestarts(page, '/vendors');
    await expect(page.locator('[data-region="vendor-directory"]')).toContainText('Commercial vendor directory');
    await expect(page.locator('body')).toContainText('Cedar Medical Supplies');
    await expect(page.locator('body')).toContainText('Defibrillator supply');
    await expect(page.locator('[data-region="vendor-disclaimer"]')).toContainText('Listing is commercial and is not Ministry endorsement.');

    // The two operator screens carry the one quiet link, disclaimer attached.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    await expect(page.locator('[data-region="vendor-directory-link"]')).toContainText('Commercial vendor directory');
    await gotoRidingRestarts(page, '/facilities/FC-0014/devices');
    await expect(page.locator('[data-region="vendor-directory-link"]')).toContainText('not Ministry endorsement');

    // Off again: the route 404s and the link is ABSENT, not greyed. The vendor
    // row stays -- content persists, the capability governs rendering.
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    const backOff = await gotoRidingRestarts(page, '/vendors');
    expect(backOff?.status()).toBe(404);
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    await expect(page.locator('[data-region="vendor-directory-link"]')).toHaveCount(0);
  });

  test('sponsored listings: a booked period readies the toggle, and the label rides the capability, not the row', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_owner');

    // Both blockers named: the dependency and the missing sponsorship.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/sponsoredListings');
    const toggle = page.locator('[data-region="capability-toggle"]');
    await expect(toggle).toContainText('Needs Vendor directory on first.');
    await expect(toggle).toContainText('sponsorship in period');

    // Directory on (the Cedar vendor from the previous walk readies it).
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);

    // Book the sponsorship over the review clock's today, and the toggle is live.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/sponsoredListings');
    const manager = page.locator('[data-region="sponsorship-manager"]');
    await manager.locator('select[name="vendorId"]').selectOption({ label: 'Cedar Medical Supplies' });
    await manager.locator('input[name="starts"]').fill('2026-08-01');
    await manager.locator('input[name="ends"]').fill('2026-12-31');
    await manager.locator('button:has-text("Book the sponsorship")').click();
    await page.waitForURL(/notice=sponsorship-added/);
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(0);
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);

    // The sponsored row is labelled, top of its category.
    await gotoRidingRestarts(page, '/vendors');
    const row = page.locator('[data-region="vendors-defibrillatorSupply"] [data-sponsored]');
    await expect(row).toContainText('Sponsored');

    // Sponsored listings off: the directory stays, the label and position go.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/sponsoredListings');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    await gotoRidingRestarts(page, '/vendors');
    await expect(page.locator('body')).toContainText('Cedar Medical Supplies');
    await expect(page.locator('[data-sponsored]')).toHaveCount(0);

    // Directory off too: the tenant leaves as it arrived.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
  });

  test('AED purchase links: where-to-buy resolves to the directory, and only while both are on', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_owner');

    // The dependency names itself; the directory going on makes the toggle live.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/aedPurchaseLinks');
    await expect(page.locator('[data-region="capability-toggle"]')).toContainText('Needs Vendor directory on first.');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);
    await gotoRidingRestarts(page, '/platform/admin/capabilities/aedPurchaseLinks');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);

    // The registry gains where-to-buy: the Cedar vendor, the disclaimer, and
    // every destination local -- resolution is to the directory, nowhere else.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/facilities/FC-0014/devices');
    const region = page.locator('[data-region="where-to-buy"]');
    await expect(region).toContainText('Where to buy');
    await expect(region).toContainText('Cedar Medical Supplies');
    await expect(region).toContainText('not Ministry endorsement');
    for (const href of await region.locator('a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))) {
      expect(href.startsWith('/')).toBe(true);
    }

    // The directory going off takes the resolution with it, purchase links
    // still on: absent, not a link to nowhere. Then both off.
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/facilities/FC-0014/devices');
    await expect(page.locator('[data-region="where-to-buy"]')).toHaveCount(0);
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/aedPurchaseLinks');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
  });

  test('advertising: the foot of public pages only, labelled, and the filing screen never carries one', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_owner');

    // The check names itself; booking an advert in period readies the toggle.
    await gotoRidingRestarts(page, '/platform/admin/capabilities/advertising');
    await expect(page.locator('[data-region="capability-toggle"]')).toContainText('placement holding an advert in period');
    const manager = page.locator('[data-region="advert-manager"]');
    await manager.locator('select[name="placement"]').selectOption('publicLanding');
    await manager.locator('input[name="imageUrl"]').fill('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
    await manager.locator('input[name="linkUrl"]').fill('https://example.com/autumn');
    await manager.locator('input[name="alt"]').fill('Cedar Medical autumn range');
    await manager.locator('input[name="starts"]').fill('2026-08-01');
    await manager.locator('input[name="ends"]').fill('2026-12-31');
    await manager.locator('button:has-text("Book the advert")').click();
    await page.waitForURL(/notice=advert-added/);
    await expect(page.locator('[data-region="capability-toggle"] button[disabled]')).toHaveCount(0);
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn on")').click();
    await page.waitForURL(/notice=on/);

    // The foot of the landing page carries it, labelled -- and only its own
    // placement: the vendors placement holds nothing, so nothing renders there.
    await gotoRidingRestarts(page, '/');
    const foot = page.locator('[data-region="ad-footer"]');
    await expect(foot).toContainText('Advertisement');
    await expect(foot.locator('img[alt="Cedar Medical autumn range"]')).toHaveCount(1);

    // A screen where someone is filing carries none -- the constraint is
    // structural, and this walks it with the capability ON.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    await expect(page.locator('[data-region="ad-footer"]')).toHaveCount(0);

    // Off: the foot is empty again. The booking stays; the capability governs.
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/advertising');
    await page.locator('[data-region="capability-toggle"] button:has-text("Turn off")').click();
    await page.waitForURL(/notice=off/);
    await gotoRidingRestarts(page, '/');
    await expect(page.locator('[data-region="ad-footer"]')).toHaveCount(0);
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
