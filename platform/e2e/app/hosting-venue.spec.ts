/**
 * THE HOSTING VENUE (platform owner, 8 October 2026). Ticking "It is at a fixed venue
 * that hosts events repeatedly" opens a venue selector right under the box, listing the
 * registered hosting venues by name, district and record id. The chosen venue is stored
 * on the event and read back on the record page and on the edit-details screen.
 */

import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';
import { expectAbsent } from '../helpers/absence';

async function fillLabelled(page: Page, en: string, value: string): Promise<void> {
  await page.locator('label', { hasText: en }).first().locator('input, textarea').first().fill(value);
}

test('an event at a fixed venue names a registered hosting venue and the record shows it', async ({ page }) => {
  test.setTimeout(180_000);
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  await fillLabelled(page, 'Event name (English)', `Hosted ${stamp}`);
  await fillLabelled(page, 'Event name (Arabic)', `فعالية مستضافة ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-12-05');
  await fillLabelled(page, 'End date', '2026-12-05');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await fillLabelled(page, 'Venue, route, or location', 'Forum de Beyrouth');
  await fillLabelled(page, 'Municipality or municipalities', 'Beirut');
  await fillLabelled(page, 'Opening time', '18:00');
  await fillLabelled(page, 'Closing time', '22:00');
  await fillLabelled(page, 'Expected participants', '40');
  await fillLabelled(page, 'Expected spectators', '200');
  await fillLabelled(page, 'Expected staff and volunteers', '12');

  // Absent until the box says the event is at a fixed venue.
  const picker = page.locator('[data-region="hosting-venue"]');
  await expectAbsent(page, { anchor: page.locator('button[aria-pressed]', { hasText: 'It is at a fixed venue that hosts events repeatedly' }), absent: '[data-region="hosting-venue"]', because: 'the venue choice appears only once the event is said to be at a fixed venue' });
  await page.locator('button[aria-pressed]', { hasText: 'It is at a fixed venue that hosts events repeatedly' }).click();
  await expect(picker).toBeVisible();

  // The list: name, district when recorded, record id -- and nothing about who runs the venue.
  const select = picker.locator('select[data-field="hostingVenueId"]');
  await expect(select.locator('option[value="VN-0032"]')).toHaveText('Forum de Beyrouth · VN-0032');
  await expect(picker).not.toContainText('R. Haddad');
  // A 44px control, reachable on a phone.
  expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // The search narrows the list; the select keeps the choice.
  await picker.locator('input[data-field="hostingVenueSearch"]').fill('forum');
  await expect(select.locator('option[value="VN-0028"]')).toHaveCount(0);
  await select.selectOption('VN-0032');
  await expect(select).toHaveValue('VN-0032');

  const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
  const zeroCount = await zeros.count();
  for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'R. Haddad');
  await fillLabelled(page, 'Position', 'Events director');
  await page.locator('button:has-text("Continue to requirements")').first().click();
  await page.waitForURL(/\/events\/EV-\d+$/);
  const eventId = new URL(page.url()).pathname.split('/')[2]!;

  // The record page names the venue in its details card.
  await expect(page.locator('[data-region="details-assessment"] [data-region="hosting-venue"]')).toContainText('Hosting venue: Forum de Beyrouth · VN-0032');

  // The edit-details screen opens on the stored choice.
  await gotoRidingRestarts(page, `/events/${eventId}/edit`);
  await expect(page.locator('select[data-field="hostingVenueId"]')).toHaveValue('VN-0032');
});
