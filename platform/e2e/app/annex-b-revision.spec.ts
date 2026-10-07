import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { useLanguage } from '../helpers/language';
import { openDetails, openAllRequirements } from '../helpers/record';

/** The own-text form of one plan section, inside the plan card. */
async function sectionForm(page: Page, key: string) {
  await openDetails(page.locator('[data-requirement="B2"]'));
  const section = await openDetails(page.locator(`#plan-${key}`));
  return section.locator('[data-region="requirement-form"]').first();
}
async function saveSection(page: Page, key: string, text: string) {
  const form = await sectionForm(page, key);
  await form.locator('textarea[name="text"]').fill(text);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Saved.');
}

test('Level 2 plan is optional, the EMS agency writes it, and the organizer reads it on the same record', async ({ page, browser, baseURL }) => {
  await signInAs(page, 'test_organizer');
  await page.goto('/events/EV-0418');
  await expect(page.locator('[data-region="record-stepper"]')).toBeVisible();
  // D1: there is no Medical Director row at Level 2. D2: the plan is recommended, never a blocker.
  await expect(page.locator('[data-requirement="B3"]')).toHaveCount(0);
  const card = page.locator('[data-requirement="B2"]');
  await expect(card).toHaveAttribute('data-group', 'recommended');
  await openDetails(page.locator('[data-requirement="B2"]'));
  await expect(card).toContainText('Optional at Level 2 unless the Ministry requests it');
  await expect(card.locator('input[type=file]')).toHaveCount(0);
  // The organizer reads the plan; only the EMS agency or the Director writes it (catalogue B2 authors).
  await expect(card.locator('textarea:enabled')).toHaveCount(0);
  await expect(card.locator('[data-region="party-ems"]')).toHaveCount(0);
  const ems = await browser.newPage({ baseURL: baseURL! });
  await signInAs(ems, 'test_ems');
  // The organizer's record is not the agency's to open; its own view is the participation page.
  expect((await ems.request.get('/events/EV-0418')).status()).toBe(404);
  await ems.goto('/events/EV-0418/participation');
  await expect(ems.locator('[data-region="ems-record"]')).toBeVisible();
  await saveSection(ems, 'P13', 'Level 2 shared plan prepared by the EMS agency.');
  // The organizer's page reads the saved section at once, with who recorded it.
  await page.reload();
  await openDetails(page.locator('[data-requirement="B2"]'));
  const section = await openDetails(page.locator('#plan-P13'));
  await expect(section).toContainText('Level 2 shared plan prepared by the EMS agency.');
  await expect(section.locator('[data-region="answered-by"]')).toContainText('EMS agency');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/annex-b-record-mobile.png', fullPage: true });
  await ems.close();
});

test('an EMS editor receives the Director’s saved section without re-entry, and a stale save conflicts', async ({ page, browser, baseURL }) => {
  await signInAs(page, 'test_director');
  await page.goto('/events/EV-0362');
  const original = await (await sectionForm(page, 'P13')).locator('textarea[name="text"]').inputValue();
  await saveSection(page, 'P13', 'Initial Director version.');
  const ems = await browser.newPage({ baseURL: baseURL! });
  await signInAs(ems, 'test_ems');
  await ems.goto('/events/EV-0362/participation');
  const emsForm = await sectionForm(ems, 'P13');
  await expect(emsForm.locator('textarea[name="text"]')).toHaveValue('Initial Director version.');
  // The Director saves again; the agency's untouched form still holds the version it read.
  await saveSection(page, 'P13', 'Updated shared plan from the Director.');
  await emsForm.locator('textarea[name="text"]').fill('A save over an answer that moved on.');
  await emsForm.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(emsForm.getByRole('status')).toContainText('Someone saved a newer answer while you were editing');
  await emsForm.getByRole('button', { name: 'Show the newer answer', exact: true }).click();
  await expect((await sectionForm(ems, 'P13')).locator('textarea[name="text"]')).toHaveValue('Updated shared plan from the Director.');
  await ems.close();
  // Preserve the demonstration plan's own text for other independent journeys.
  await saveSection(page, 'P13', original);
});

test('the organizer reads the Level 3 Director and agency rows in Arabic, with each agency’s signature state', async ({ page, context }) => {
  await signInAs(page, 'test_organizer');
  await useLanguage(context, 'ar');
  await page.goto('/events/EV-0362');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const director = await openDetails(page.locator('[data-requirement="B3"]'));
  await expect(director.locator('[data-region="party-director"] [data-party="confirmed"]')).toBeVisible();
  const declarations = await openDetails(page.locator('[data-requirement="B20"]'));
  await expect(declarations.locator('[data-region="party-ems"]')).toContainText('الإقرار موقَّع');
  // The plan is the medical team's to write: the organizer's view carries no enabled plan field.
  await expect(page.locator('[data-requirement="B2"] textarea:enabled')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/annex-b-record-arabic.png', fullPage: true });
});

test('the Director and the EMS agency read the Level 3 record in Arabic on a phone', async ({ page, context }) => {
  await useLanguage(context, 'ar');
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [login, route] of [['test_director', '/events/EV-0362'], ['test_ems', '/events/EV-0362/participation']] as const) {
    await signInAs(page, login);
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await openAllRequirements(page);
    await expect(page.locator('[data-region="requirement-summaries"]')).toBeVisible();
    const plan = await openDetails(page.locator('[data-requirement="B2"]'));
    await expect(plan.locator('[data-plan-section="P01"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.screenshot({ path: `test-results/annex-b-${login}-arabic-phone.png`, fullPage: true });
  }
});
