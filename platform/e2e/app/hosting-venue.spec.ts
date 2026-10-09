/**
 * THE HOSTING VENUE (platform owner, 8 October 2026). Ticking "It is at a fixed venue
 * that hosts events repeatedly" opens a venue selector right under the box, listing the
 * registered hosting venues by name, district and record id. The chosen venue is stored
 * on the event and read back on the record page and on the edit-details screen.
 */

import { expect, test, type Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
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

function storedLink(eventId: string): string | null {
  const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  try {
    return (db.prepare('SELECT hosting_venue_id FROM events WHERE id = ?').get(eventId) as { hosting_venue_id: string | null }).hosting_venue_id;
  } finally {
    db.close();
  }
}

/**
 * THE LOCATION FIELD LINKS A REGISTERED VENUE (platform owner, 8 October 2026). Typing in
 * "Venue, route, or location" suggests registered venues; "Show all registered venues"
 * opens the full list. Either choice links the event by record id, without the fixed-venue
 * tick, and the venue's owner then reads the event -- as text -- on their dashboard.
 */
test('the location field suggests and links a registered venue, and the venue owner sees the event', async ({ page }) => {
  test.setTimeout(240_000);
  // The event is organized by an account that does not own Forum de Beyrouth.
  await signInAs(page, 'test_organizer_pending');
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  const name = `Linked ${stamp}`;
  await fillLabelled(page, 'Event name (English)', name);
  await fillLabelled(page, 'Event name (Arabic)', `فعالية مرتبطة ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-12-12');
  await fillLabelled(page, 'End date', '2026-12-13');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');

  const field = page.locator('input[data-field="venueRoute"]');
  const suggestions = page.locator('[data-region="venue-suggestions"]');
  const linkLine = page.locator('[data-region="linked-venue"]');
  await expect(field).toHaveAttribute('role', 'combobox');
  await expect(field).toHaveAttribute('aria-expanded', 'false');

  // 1. Typing the record id suggests the venue; a click chooses it.
  await field.click();
  await field.pressSequentially('vn-003');
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await expect(suggestions).toHaveAttribute('role', 'listbox');
  const forumOption = suggestions.locator('[role="option"][data-venue-id="VN-0032"]');
  await expect(forumOption).toContainText('Forum de Beyrouth');
  await expectAbsent(page, { anchor: forumOption, absent: suggestions.getByText('R. Haddad'), because: 'a suggestion carries no contact details' });
  expect((await forumOption.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await forumOption.click();
  await expect(field).toHaveValue('Forum de Beyrouth');
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await expect(linkLine).toContainText('Registered venue: Forum de Beyrouth · VN-0032');

  // 2. Remove unlinks and keeps the text.
  await linkLine.locator('button[data-action="unlink-venue"]').click();
  await expectAbsent(page, { anchor: field, absent: '[data-region="linked-venue"]', because: 'Remove unlinks the venue' });
  await expect(field).toHaveValue('Forum de Beyrouth');

  // 3. A route that matches no registered venue stays typed text, with nothing suggested.
  await field.fill('');
  await field.pressSequentially('Corniche run route');
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await expectAbsent(page, { anchor: field, absent: '[data-region="venue-suggestions"]', because: 'a route matches no registered venue' });

  // 4. The keyboard: Escape closes the list, ArrowDown opens it on the first match, Enter chooses.
  await field.fill('');
  await field.pressSequentially('foru');
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await field.press('Escape');
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await field.press('ArrowDown');
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await expect(suggestions.locator('[role="option"][aria-selected="true"]')).toContainText('Forum de Beyrouth');
  await expect(field).toHaveAttribute('aria-activedescendant', /.+/);
  await field.press('Enter');
  await expect(field).toHaveValue('Forum de Beyrouth');
  await expect(linkLine).toContainText('VN-0032');

  // 5. Editing the text away from the chosen name unlinks it.
  await field.press('End');
  await field.pressSequentially(', hall B');
  await expectAbsent(page, { anchor: field, absent: '[data-region="linked-venue"]', because: 'the text no longer names the chosen venue' });

  // 6. Show all registered venues: a modal dialog with a search; the page behind does not scroll.
  await page.locator('button[data-action="show-all-venues"]').click();
  const dialog = page.locator('dialog[data-region="all-venues-dialog"]');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(dialog.locator('button[data-venue-id="VN-0028"]')).toBeVisible();
  await dialog.locator('input[data-field="allVenuesSearch"]').fill('forum');
  await expectAbsent(page, { anchor: dialog.locator('button[data-venue-id="VN-0032"]'), absent: dialog.locator('button[data-venue-id="VN-0028"]'), because: 'the search narrows the list' });
  await dialog.locator('button[data-venue-id="VN-0032"]').click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
  await expect(field).toHaveValue('Forum de Beyrouth');
  await expect(linkLine).toContainText('Registered venue: Forum de Beyrouth · VN-0032');

  // The fixed-venue box is not ticked: the link stands on its own. Ticking it shows the same venue.
  const tick = page.locator('button[aria-pressed]', { hasText: 'It is at a fixed venue that hosts events repeatedly' });
  await tick.click();
  await expect(page.locator('select[data-field="hostingVenueId"]')).toHaveValue('VN-0032');
  await tick.click();
  await expect(tick).toHaveAttribute('aria-pressed', 'false');

  await fillLabelled(page, 'Municipality or municipalities', 'Beirut');
  await fillLabelled(page, 'Expected participants', '30');
  await fillLabelled(page, 'Expected spectators', '150');
  await fillLabelled(page, 'Expected staff and volunteers', '10');
  const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
  const zeroCount = await zeros.count();
  for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'S. Khoury');
  await fillLabelled(page, 'Position', 'Secretary');
  await page.locator('button:has-text("Continue to requirements")').first().click();
  await page.waitForURL(/\/events\/EV-\d+$/);
  const eventId = new URL(page.url()).pathname.split('/')[2]!;

  // The link is stored on the record, by record id.
  expect(storedLink(eventId)).toBe('VN-0032');
  await expect(page.locator('[data-region="details-assessment"] [data-region="hosting-venue"]')).toContainText('Hosting venue: Forum de Beyrouth · VN-0032');

  // The edit-details screen opens on the link, with no fixed-venue selector for this event.
  await gotoRidingRestarts(page, `/events/${eventId}/edit`);
  await expect(page.locator('input[data-field="venueRoute"]')).toHaveValue('Forum de Beyrouth');
  await expect(page.locator('[data-region="linked-venue"]')).toContainText('VN-0032');
  await expectAbsent(page, { anchor: 'input[data-field="venueRoute"]', absent: 'select[data-field="hostingVenueId"]', because: 'the event is not ticked as at a fixed venue' });

  // The venue's owner reads the event on their dashboard: text, no link into the record.
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/dashboard');
  const section = page.locator('[data-region="events-at-your-venues"]');
  await expect(section.locator('h2')).toContainText('Events at your venues');
  const row = section.locator(`[data-venue-id="VN-0032"] li[data-event-id="${eventId}"]`);
  await expect(row).toContainText(name);
  await expect(row).toContainText(eventId);
  await expect(row).toContainText('2026-12-12 – 2026-12-13');
  await expect(row).toContainText('Level 1');
  await expect(row).toContainText('In preparation');
  await expect(section.locator('[data-venue-id="VN-0032"] h3')).toContainText('Forum de Beyrouth · VN-0032');
  await expectAbsent(page, { anchor: row, absent: row.locator('a'), because: 'the venue owner has no access to the event record' });
  await expectAbsent(page, { anchor: row, absent: row.getByText('S. Khoury'), because: 'the organizer’s details are not the venue owner’s to read' });
});
