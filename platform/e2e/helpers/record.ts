/**
 * The single record page (redesign, 2026-10-07), driven the way an organizer drives it:
 * one requirement card at a time, then the certification at the foot of the page. Shared
 * by every journey that files a fresh Level 1 record, so the rows the catalogue asks at
 * Level 1 are answered in one place and a catalogue change is one edit here.
 */

import { expect, type Locator, type Page } from '@playwright/test';

export const card = (page: Page, key: string): Locator => page.locator(`[data-requirement="${key}"]`);
export const cardForm = (page: Page, key: string): Locator => card(page, key).locator('[data-region="requirement-form"]').first();
export const stateChip = (page: Page, key: string): Locator => card(page, key).locator('summary [data-state]');

/** Names a step by its anchor: the stepper shows it, as a summary row, a deep link or a redirect would. */
export async function showStep(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    if (window.location.hash !== h) window.location.hash = h;
    window.dispatchEvent(new CustomEvent('record:jump', { detail: h }));
  }, hash);
}

/**
 * Shows a card or a section and opens it. A card inside the stepper is on screen only
 * while it is the current step, so it is named by its anchor first.
 */
export async function openDetails(locator: Locator): Promise<Locator> {
  const page = locator.page();
  const id = await locator.getAttribute('id');
  if (id && !(await locator.isVisible())) {
    // Named again until it shows: a hash set while the page is still hydrating is dropped
    // when the router re-applies its own URL, and an event sent then has no listener yet.
    await expect.poll(async () => { await showStep(page, `#${id}`); return locator.isVisible(); }, { timeout: 60_000, intervals: [250, 500, 1000] }).toBe(true);
  }
  await locator.evaluate((el) => { if (el instanceof HTMLDetailsElement) el.open = true; });
  return locator;
}

/** Opens the collapsed "All requirements" list below the steps (closed by default, owner direction 2026-10-07). */
export async function openAllRequirements(page: Page): Promise<void> {
  const all = page.locator('[data-region="requirement-list-all"]');
  await expect(all).toBeAttached();
  await all.evaluate((el) => { if (el instanceof HTMLDetailsElement) el.open = true; });
}

/** Fills one card's short form by field name and saves it; the chip must read Complete after. */
export async function saveCard(page: Page, key: string, values: Record<string, string | boolean>): Promise<void> {
  await openDetails(card(page, key));
  const f = cardForm(page, key);
  for (const [name, value] of Object.entries(values)) {
    const control = f.locator(`[name="${name}"]`);
    if (typeof value === 'boolean') { if (value) await control.check(); else await control.uncheck(); }
    else if (await control.count() === 0) await f.locator(`[data-choice="${value}"]`).first().click(); // a choice field is a row of buttons
    else await control.fill(value);
  }
  await f.locator('[data-region="save"]').click();
  await expect(f.locator('[role="status"]')).toContainText(/Saved|حُفظ/);
  await expect(stateChip(page, key)).toHaveAttribute('data-state', 'complete');
}

/** Every row the catalogue requires of a Level 1 organizer, answered with plausible values. */
export async function answerLevel1Rows(page: Page): Promise<void> {
  await saveCard(page, 'B1', { name: 'R. Haddad', phone: '+961 3 123456' });
  await saveCard(page, 'B4', { available: true });
  await saveCard(page, 'B7', { how: 'Call 140 (Lebanese Red Cross)' });
  await saveCard(page, 'B9', { ready: true });
  await saveCard(page, 'B10', { access: 'yes' });
  await saveCard(page, 'B11', { clearRoute: 'yes', route: 'Paved path from the stage to Gate B; no stairs.' });
  await saveCard(page, 'B14', { method: 'Mobile phones and radios' });
  await saveCard(page, 'B16', { how: 'The site manager calls 140' });
}

/**
 * The certification on the final step: the three fields autosave on blur, and the
 * Submit button judges readiness from the server's blockers. Returns the button, enabled.
 */
export async function certify(page: Page, who: { representative: string; telephone: string; position: string }): Promise<Locator> {
  const review = page.locator('[data-region="final-review"]');
  await showStep(page, '#final-review');
  await expect(review).toBeVisible();
  // Any compliance statements the level applies are ticked first (none at Level 1: catalogue P-C).
  const statements = review.locator('[data-region="compliance-statements"] input[type="checkbox"]:not(:checked)');
  while (await statements.count()) await statements.first().check();
  await review.locator('input[name="representative"]').fill(who.representative);
  await review.locator('input[name="position"]').fill(who.position);
  await review.locator('input[name="telephone"]').fill(who.telephone);
  await page.keyboard.press('Tab');
  await expect(review.locator('[data-region="autosaved"]')).toBeVisible({ timeout: 15_000 });
  const submit = review.locator('[data-region="submit-button"]');
  await expect(submit).toBeEnabled({ timeout: 40_000 });
  return submit;
}
