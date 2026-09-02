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
    await expect(reapply).toContainText('Nothing from the previous event carries over as approved.');
    await reapply.locator('button:has-text("Reapply")').click();
    await page.waitForURL(/\/events\/EV-\d+\?notice=reapplied/);

    // A NEW record with its own identifier, naming its source.
    const newId = new URL(page.url()).pathname.split('/')[2]!;
    expect(newId).not.toBe('EV-0244');
    await expect(page.locator('[data-region="reapplied-notice"]')).toContainText(
      'Nothing from the previous event carries over as approved. The level is derived again from your answers.',
    );
    await expect(page.locator('[data-region="copied-from"]')).toContainText('Copied from EV-0244');

    // The level DERIVES from the copied answers -- EV-0244's answers give Level 3 --
    // and the dates are the organizer's to enter: no File-by tile without them.
    await expect(page.locator('body')).toContainText('Level 3');
    await expect(page.locator('body')).not.toContainText('File by');
    // Prefilled event information and the copied nomination, unanswered.
    await expect(page.locator('h1')).toContainText('Tripoli Marathon');
    await gotoRidingRestarts(page, `/events/${newId}/requirements`);
    await expect(page.locator('body')).toContainText('Dr. N. Salameh');
    await expect(page.locator('body')).not.toContainText('Confirmed —');

    // THE SOURCE IS UNTOUCHED: same determination, no copied-from line, still
    // offering Reapply for the next time.
    await gotoRidingRestarts(page, '/events/EV-0244');
    await expect(page.locator('body')).toContainText('Health and medical preparedness requirements satisfied');
    await expect(page.locator('[data-region="copied-from"]')).toHaveCount(0);
    await expect(page.locator('[data-region="reapply"]')).toBeVisible();
  });
});
