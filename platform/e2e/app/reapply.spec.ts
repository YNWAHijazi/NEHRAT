/**
 * Reapply (partner ruling, 2026-09-02): inside a concluded event, one action that
 * starts a NEW event prefilled from the old one — everything except the dates.
 *
 * The load-bearing assertions: nothing carries over as approved (the screen says
 * so in the partner's words), the level derives from the copied answers rather
 * than being inherited, the new record has its own identifier and names its
 * source, the old record stays untouched, and a live event offers no Reapply.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

test.describe('reapply from a concluded event', () => {
  test('a live event offers no Reapply', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418');
    await expect(page.locator('h1')).toContainText('Beirut Coastal 12K');
    await expect(page.locator('[data-region="reapply"]')).toHaveCount(0);
  });

  test('the copy starts new, says so in the ruled words, and leaves the source alone', async ({ page }) => {
    // EV-0244 (Tripoli Marathon) is concluded at the review clock: ended, satisfied,
    // Level 3, one confirmed Director nomination.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0244');
    const reapply = page.locator('[data-region="reapply"]');
    await expect(reapply).toBeVisible();
    await expect(reapply).toContainText('Enter new dates and review the requirements before submitting.');
    await reapply.locator('button:has-text("Duplicate event")').click();
    await page.waitForURL(/\/events\/EV-\d+\/prepare/);

    // A NEW record with its own identifier, naming its source.
    const newId = new URL(page.url()).pathname.split('/')[2]!;
    expect(newId).not.toBe('EV-0244');
    const modal = page.locator('dialog[open]');
    if (await modal.count()) await modal.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Event name (English)', exact: true })).toHaveValue('Tripoli Marathon');
    await expect(page.locator('input[type="date"]').first()).toHaveValue('');
    await gotoRidingRestarts(page, `/events/${newId}/requirements`);
    await expect(page.locator('body')).toContainText('Dr. N. Salameh');
    await expect(page.locator('body')).not.toContainText('Confirmed —');

    // THE SECOND RUNNING READS AS ONE AT A GLANCE (partner instruction,
    // 2026-09-03): the new card carries the previous edition's date beside its
    // identity, from copied_from. Display, not lineage merging -- the records
    // stay separate, one per authorisation.
    await gotoRidingRestarts(page, '/dashboard');
    const newCard = page.locator(`a[href="/events/${newId}"]`);
    await expect(newCard.locator('[data-region="previous-edition"]')).toContainText(/Previous edition \d{4}-\d{2}-\d{2}/);

    // THE SOURCE IS UNTOUCHED: same determination, no copied-from line, still
    // offering Reapply for the next time.
    await gotoRidingRestarts(page, '/events/EV-0244');
    await expect(page.locator('body')).toContainText('Health and medical preparedness requirements satisfied');
    await expect(page.locator('[data-region="copied-from"]')).toHaveCount(0);
    await expect(page.locator('[data-region="reapply"]')).toBeVisible();
  });
});
