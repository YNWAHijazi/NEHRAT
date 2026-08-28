/**
 * THE MASTER ADMINISTRATOR AS AN OVERSEEING PROFILE.
 *
 * It was a reviewer with fewer powers: five roles out of nine on a users screen, two
 * instruments on two unrelated screens, submissions read through the reviewer's own
 * queue, and no entry point to any of it from the Ministry dashboard. Four tabs now,
 * each answering a question about the PLATFORM rather than about one record.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

test.describe('the console', () => {
  test('is reachable from the dashboard, and has four tabs', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry');
    await page.locator('[data-region="master-admin-entry"]').click();
    await page.waitForURL('**/ministry/admin/records');
    const tabs = page.locator('[data-region="admin-tabs"] a');
    await expect(tabs).toHaveCount(4);
    for (const name of ['Records', 'Users', 'Activity', 'Configuration']) {
      await expect(tabs.filter({ hasText: name })).toHaveCount(1);
    }
  });

  test('Records shows every record, filed or not, and filters', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/records');
    const rows = page.locator('[data-region="records"] > a');
    const all = await rows.count();
    expect(all).toBeGreaterThanOrEqual(5);

    // A filtered view has a URL, so it can be sent to somebody.
    await gotoRidingRestarts(page, '/ministry/admin/records?level=3');
    const levelThree = await page.locator('[data-region="records"] > a').count();
    expect(levelThree).toBeGreaterThan(0);
    expect(levelThree).toBeLessThan(all);

    await gotoRidingRestarts(page, '/ministry/admin/records?status=undetermined');
    await expect(page.locator('[data-region="records"]')).toContainText('Byblos Harbour Swim');

    await gotoRidingRestarts(page, '/ministry/admin/records?q=Baalbeck');
    await expect(page.locator('[data-region="records"] > a')).toHaveCount(1);
  });

  test('the complete file carries every part, nothing summarised', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/records/EV-0362');
    // Every part the instruction named, each as its own region.
    for (const region of [
      'file-derivation', 'file-answers', 'file-declarations', 'file-attachments',
      'file-counterparty', 'file-plan', 'file-determinations', 'file-notifications',
    ]) {
      await expect(page.locator(`[data-region="${region}"]`), `${region} is missing`).toBeVisible();
    }
    // Attachments are READ here, not listed: a viewer per stored document.
    await expect(page.locator('[data-region="file-attachments"] [data-region="doc-viewer"]').first()).toBeVisible();
  });

  test('and the whole file prints as one document', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/records/EV-0362/report');
    const doc = page.locator('[data-region="certificate"]');
    await expect(doc).toBeVisible();
    await expect(doc).toContainText('Assessment answers');
    await expect(doc).toContainText('Compliance declarations');
    await expect(doc).toContainText('Determination history');
    // It states its own limits, because it can leave the platform.
    await expect(doc).toContainText(/Authorization of the event remains with the legally competent authority/);
  });

  test('Users is segmented by type and searchable', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    await expect(page.locator('[data-region="user-filters"]')).toBeVisible();
    const all = await page.locator('[data-region="users"] > div').count();
    await gotoRidingRestarts(page, '/ministry/admin/users?seg=ministry');
    const ministry = await page.locator('[data-region="users"] > div').count();
    expect(ministry).toBeGreaterThan(0);
    expect(ministry).toBeLessThan(all);
  });

  test('Activity reads the audit trail, and names powers nobody can use', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/activity');
    await expect(page.locator('[data-region="activity"]')).toContainText('Determination recorded');
    // The reachability check from item 3, on the screen for facts about the platform.
    await expect(page.locator('[data-region="unreachable-powers"]')).toBeVisible();
  });
});

test.describe('what the administrator can and cannot do', () => {
  test('it records determinations — the ruling reversed on 2026-08-29', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0455');
    // EV-0455 is filed with nothing recorded, so the recording panel is offered.
    await expect(page.locator('[data-region="outcome"]')).toBeVisible();
    await expect(page.locator('[data-region="outcome-options"] input[type="radio"]').first()).toBeEnabled();
  });

  test('and it cannot act on its own account', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const own = page.locator('[data-region="users"] > div', { hasText: 'Administrator' }).first();
    await expect(own).toBeVisible();
    // The bar is a reason, not a hidden control.
    await expect(page.locator('[data-region="bar"]').first()).toContainText(/your own account/i);
  });

  test('a reviewer cannot reach the overseeing console', async ({ page }) => {
    // viewRegistry is the administrator's; the console is oversight, not review.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry');
    await expectAbsent(page, {
      absent: '[data-region="master-admin-entry"]',
      anchor: /Operational dashboard/,
      because: 'the overseeing console belongs to the administrator',
    });
  });
});
