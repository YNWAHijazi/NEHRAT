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

/** Opens a collapsible card (or any details element) and returns it. */
export async function openDetails(locator: Locator): Promise<Locator> {
  if (!(await locator.evaluate((d) => (d as HTMLDetailsElement).open))) await locator.locator('summary').first().click();
  return locator;
}

/** Fills one card's short form by field name and saves it; the chip must read Complete after. */
export async function saveCard(page: Page, key: string, values: Record<string, string | boolean>): Promise<void> {
  await openDetails(card(page, key));
  const f = cardForm(page, key);
  for (const [name, value] of Object.entries(values)) {
    const control = f.locator(`[name="${name}"]`);
    if (typeof value === 'boolean') { if (value) await control.check(); else await control.uncheck(); }
    else await control.fill(value);
  }
  await f.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
  await expect(f.locator('[role="status"]')).toContainText(/Saved|حُفظ/);
  await expect(stateChip(page, key)).toHaveAttribute('data-state', 'complete');
}

/** Every row the catalogue requires of a Level 1 organizer, answered with plausible values. */
export async function answerLevel1Rows(page: Page): Promise<void> {
  await saveCard(page, 'B1', { name: 'R. Haddad', phone: '+961 3 123456' });
  await saveCard(page, 'B4', { who: 'Lebanese Red Cross volunteers', where: 'Beside the main entrance', contact: 'Steward radio, channel 2', arranged: true });
  await saveCard(page, 'B7', { contacted: true, shared: true, knowHow: true, phone: '140' });
  await saveCard(page, 'B9', { ready: true, location: 'First-aid tent', responsible: 'Site manager' });
  await saveCard(page, 'B10', { entrance: 'Gate B on the ring road', keeper: 'Parking team lead' });
  await saveCard(page, 'B11', { route: 'Paved path from the stage to Gate B; no stairs.' });
  await saveCard(page, 'B14', { method: 'Radios', backup: 'Mobile phones', whoCalls: 'Site manager' });
  await saveCard(page, 'B16', { whoCalls: 'Site manager', how: 'Calls 140', guides: 'Site manager' });
}

/**
 * The certification at the foot of the page: the three fields autosave on blur, and the
 * Submit button judges readiness from the server's blockers. Returns the button, enabled.
 */
export async function certify(page: Page, who: { representative: string; telephone: string; position: string }): Promise<Locator> {
  const review = page.locator('[data-region="final-review"]');
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
