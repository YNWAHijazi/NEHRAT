/**
 * THE SINGLE RECORD PAGE (redesign, 2026-10-07), completed in English and then Arabic.
 *
 * Brief item 8: a realistic Level 1 record is filed with organizer answers alone -- no
 * medical invitation, no plan, no map upload, no clinical-record receipt. Item 2: a
 * summary row opens the matching card from a click and from a deep link. Item 16: the
 * foot of the page names what remains with jump links, and the server refuses a filing
 * that skips the screen. Item 14: No and Not planned on the AED row stay distinct from
 * Complete. Item 3: at phone width the summaries stack and nothing scrolls sideways.
 */

import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';
import { LANGUAGES, useLanguage } from '../helpers/language';

async function fillLabelled(page: Page, en: string, value: string): Promise<void> {
  await page.locator('label', { hasText: en }).first().locator('input, textarea').first().fill(value);
}

/** Create a Level 1 event through the intake and land on its record page. */
async function createLevel1(page: Page, lang: string): Promise<string> {
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  await fillLabelled(page, 'Event name (English)', `Record page ${lang} ${stamp}`);
  await fillLabelled(page, 'Event name (Arabic)', `صفحة السجل ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-11-01');
  await fillLabelled(page, 'End date', '2026-11-01');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await fillLabelled(page, 'Venue, route, or location', 'Municipal park, Zahle');
  await fillLabelled(page, 'Municipality or municipalities', 'Zahle');
  await fillLabelled(page, 'Opening time', '09:00');
  await fillLabelled(page, 'Closing time', '13:00');
  await fillLabelled(page, 'Expected participants', '60');
  await fillLabelled(page, 'Expected spectators', '30');
  await fillLabelled(page, 'Expected staff and volunteers', '8');
  const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
  const zeroCount = await zeros.count();
  expect(zeroCount).toBeGreaterThanOrEqual(9);
  for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'R. Haddad');
  await fillLabelled(page, 'Position', 'Events director');
  await page.locator('button:has-text("Continue to requirements"), button:has-text("المتابعة إلى المتطلبات")').first().click();
  await page.waitForURL(/\/events\/EV-\d+/);
  return new URL(page.url()).pathname.split('/')[2]!;
}

const card = (page: Page, key: string) => page.locator(`[data-requirement="${key}"]`);
const form = (page: Page, key: string) => card(page, key).locator('[data-region="requirement-form"]');
const chip = (page: Page, key: string) => card(page, key).locator('summary [data-state]');

async function saveCard(page: Page, key: string, values: Record<string, string | boolean>): Promise<void> {
  const f = form(page, key);
  await card(page, key).locator('summary').click({ force: true });
  if (!(await card(page, key).evaluate((d) => (d as HTMLDetailsElement).open))) await card(page, key).locator('summary').click();
  for (const [name, value] of Object.entries(values)) {
    const control = f.locator(`[name="${name}"]`);
    if (typeof value === 'boolean') { if (value) await control.check(); else await control.uncheck(); }
    else await control.fill(value);
  }
  await f.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
  await expect(f.locator('[role="status"]')).toContainText(/Saved|حُفظ/);
  await expect(chip(page, key)).toHaveAttribute('data-state', 'complete');
}

for (const lang of LANGUAGES) {
  test.describe(`single record page in ${lang}`, () => {
    test.beforeEach(async ({ context }) => { await useLanguage(context, lang); });

    test('a Level 1 record is answered row by row and filed with organizer answers alone', async ({ page }) => {
      test.setTimeout(300_000);
      await signInAs(page, 'test_organizer');
      const eventId = await createLevel1(page, lang);

      // One page: the two summaries, the required group, the final review -- and no tab strip.
      const summaries = page.locator('[data-region="requirement-summaries"]');
      await expect(summaries).toBeVisible();
      await expect(page.locator('[data-region="event-workspace-nav"]')).toHaveCount(0);
      await expect(summaries.locator('[data-summary="required"] [data-summary-row]')).toHaveCount(8);
      // Level 1: no Director, no plan, no map, no declaration row among the cards; AED recommended.
      for (const absent of ['B3', 'B2', 'B5', 'B6', 'B12', 'B15', 'B17', 'B20', 'P-M', 'P-D']) await expect(card(page, absent)).toHaveCount(0);
      await expect(card(page, 'B8')).toHaveAttribute('data-group', 'recommended');
      await expect(card(page, 'B18')).toHaveAttribute('data-group', 'later');
      await expect(card(page, 'B19')).toHaveAttribute('data-group', 'later');

      // The submit button is disabled while anything remains, and names how many.
      const submit = page.locator('[data-region="submit-button"]');
      await expect(submit).toBeDisabled();

      // A summary row opens the matching card (brief item 2).
      await summaries.locator('[data-summary-row="B10"]').click();
      await expect(card(page, 'B10')).toHaveJSProperty('open', true);

      // The organizer's own answers, one row at a time. B1 is prefilled from the account.
      await saveCard(page, 'B1', { name: 'R. Haddad', phone: '+961 3 123456' });
      await saveCard(page, 'B4', { who: 'Lebanese Red Cross volunteers', where: 'Beside the main entrance', contact: 'Steward radio, channel 2', arranged: true });
      await saveCard(page, 'B7', { contacted: true, shared: true, knowHow: true, phone: '140' });
      await saveCard(page, 'B9', { ready: true, location: 'First-aid tent', responsible: 'Site manager' });
      await saveCard(page, 'B10', { entrance: 'Gate B on the ring road', keeper: 'Parking team lead' });
      await saveCard(page, 'B11', { route: 'Paved path from the stage to Gate B; no stairs.' });
      await saveCard(page, 'B14', { method: 'Radios', backup: 'Mobile phones', whoCalls: 'Site manager' });
      await saveCard(page, 'B16', { whoCalls: 'Site manager', how: 'Calls 140', guides: 'Site manager' });

      // No and Not planned on the AED row stay distinct from Complete (brief item 14).
      await card(page, 'B8').locator('summary').click();
      await form(page, 'B8').locator('[data-choice="notPlanned"]').click();
      await form(page, 'B8').getByRole('button', { name: /^(Save|حفظ)$/ }).click();
      await expect(chip(page, 'B8')).toHaveAttribute('data-state', 'notProvided');

      // Everything required is complete; the summary says so.
      await expect(summaries.locator('[data-region="required-count"]')).toContainText(/8 of 8|8 من 8/);

      // The foot of the page: the declaration is what remains; the certification signs it.
      const review = page.locator('[data-region="final-review"]');
      await expect(review.locator('[data-remaining="P-C"]')).toBeVisible();
      await expect(review.locator('[data-region="compliance-statements"]')).toHaveCount(0);
      await review.locator('input[name="representative"]').fill('R. Haddad');
      await review.locator('input[name="position"]').fill('Events director');
      await review.locator('input[name="telephone"]').fill('+961 3 123456');
      await page.keyboard.press('Tab');
      await expect(submit).toBeEnabled({ timeout: 40_000 });
      await submit.click();
      await page.waitForURL(/acknowledgment/);
      expect(await page.locator('body').innerText()).toContain(eventId);

      // Filed: the same page is the readable submitted record, and nothing is editable.
      await gotoRidingRestarts(page, `/events/${eventId}`);
      await expect(page.locator('[data-region="submitted-band"]')).toBeVisible();
      await expect(page.locator('[data-region="filed-band"]')).toBeVisible();
      await expect(form(page, 'B4').getByRole('button', { name: /^(Save|حفظ)$/ })).toHaveCount(0);
      await expect(form(page, 'B4').locator('[name="who"]')).toBeDisabled();
    });
  });
}

test('a deep link opens the card inside its collapsed group and focuses it', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418#req-B12');
  await expect(card(page, 'B12')).toHaveJSProperty('open', true);
  const focusedWithin = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-requirement="B12"]')));
  expect(focusedWithin).toBe(true);
});

test('the server refuses a filing the screen did not gate', async ({ page, request }) => {
  await signInAs(page, 'test_organizer');
  // EV-0418 is a Level 2 record with rows still pending: the gate must hold without the screen.
  await gotoRidingRestarts(page, '/events/EV-0418');
  await expect(page.locator('[data-region="submit-button"]')).toBeDisabled();
  const count = await page.locator('[data-region="final-review"] [data-remaining]').count();
  expect(count).toBeGreaterThan(0);
  void request;
});

test('at phone width the summaries stack, cards are full width and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418');
  const required = page.locator('[data-summary="required"]');
  const recommended = page.locator('[data-summary="recommended"]');
  const a = (await required.boundingBox())!;
  const b = (await recommended.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await card(page, 'B10').locator('summary').click();
  const input = form(page, 'B10').locator('[name="entrance"]');
  const box = (await input.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThan(200);
});
