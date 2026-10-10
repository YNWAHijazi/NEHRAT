import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';
import { openDetails } from '../helpers/record';
import { readFileSync } from 'node:fs';
const maxUploadBytes = () => (JSON.parse(readFileSync(new URL('../../lib/rules/data/uploads.json', import.meta.url), 'utf8')) as { maxBytes: number }).maxBytes;

for (const lang of ['en', 'ar']) {
  test(`map uploads accept the advertised limit, reject oversized files and keep the page usable (${lang})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'lang', value: lang, url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418');
    // The site map is one required card on the record page (catalogue P-M, Level 2).
    const map = await openDetails(page.locator('[data-requirement="P-M"]'));
    const input = map.locator('input[type="file"]');
    await input.setInputFiles({ name: 'too-large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(maxUploadBytes() + 1) });
    await expect(map.getByRole('alert')).toBeVisible();
    expect(await input.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    const bytes = Buffer.alloc(maxUploadBytes(), 32); bytes.write('%PDF-1.4\n');
    await input.setInputFiles({ name: 'full-size-route-map.pdf', mimeType: 'application/pdf', buffer: bytes });
    await input.locator('xpath=ancestor::form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/saved=P-M/);
    const uploaded = page.locator('[data-requirement="P-M"]');
    await expect(uploaded).toContainText('full-size-route-map.pdf');
    await expect(uploaded.locator('summary [data-state]')).toHaveAttribute('data-state', 'complete');
    await expect(uploaded.locator('summary').getByText(lang === 'ar' ? 'مكتمل' : 'Complete', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^(Continue to|المتابعة إلى)/ })).toHaveCount(0);
    const download = await page.request.get('/api/documents/EV-0418/siteMap');
    expect(download.status()).toBe(200);
    expect((await download.body()).equals(bytes)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: test.info().outputPath('record-mobile.png'), fullPage: true });
  });
}

test('event type hides unrelated activities and a previous edition reveals the next questions', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/new');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('motor');
  const extra = page.locator('[data-region="additional-activities"]');
  await expect(extra).not.toHaveAttribute('open');
  await extra.locator('summary').click();
  await extra.getByRole('button', { name: 'Running', exact: true }).click();
  await expect(page.getByLabel('Course distance', { exact: false })).toBeVisible();
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await expect(extra.getByRole('button', { name: 'Running', exact: true })).toHaveAttribute('aria-pressed', 'false');
  // The held-before box is gone (owner, 10 October 2026): question 9 asks the history directly, with a plain line.
  await expect(page.getByRole('button', { name: 'This event has been held before', exact: true })).toHaveCount(0);
  await expect(page.getByText('If this is the first time, choose the first answer.')).toBeVisible();
});

/** The own-text form of one plan section on whichever page the party reads the record. */
async function section(page: Page, key: string) {
  await openDetails(page.locator('[data-requirement="B2"]'));
  return (await openDetails(page.locator(`#plan-${key}`))).locator('[data-region="requirement-form"]').first();
}

test('Director and EMS share one plan section by section; the organizer can only read it', async ({ page, browser, baseURL }) => {
  await signInAs(page, 'test_director');
  await gotoRidingRestarts(page, '/events/EV-0362');
  const originalFile = await page.request.get('/api/documents/EV-0362/plan-document');
  expect(originalFile.status()).toBe(200);
  const directorForm = await section(page, 'P13');
  const original = await directorForm.locator('textarea[name="text"]').inputValue();
  await directorForm.locator('textarea[name="text"]').fill('Director medical planning contribution.');
  const emsPage = await browser.newPage({ baseURL: baseURL! });
  await signInAs(emsPage, 'test_ems');
  await gotoRidingRestarts(emsPage, '/events/EV-0362/participation');
  // Unsaved edits keep the version they were read at when another medical user saves (brief item 11).
  const emsForm = await section(emsPage, 'P13');
  await emsForm.locator('textarea[name="text"]').fill('An agency edit over the same section.');
  await directorForm.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(directorForm.getByRole('status')).toContainText('Saved.');
  await emsForm.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(emsForm.getByRole('status')).toContainText('Someone saved a newer answer');
  await emsForm.getByRole('button', { name: 'Show the newer answer', exact: true }).click();
  await expect((await section(emsPage, 'P13')).locator('textarea[name="text"]')).toHaveValue('Director medical planning contribution.');
  await emsPage.close();
  // Restore the shared fixture's wording so later filing tests remain independent, then
  // sign the plan again: every saved edit reopens the Director's approval (D4).
  await page.reload();
  const restore = await section(page, 'P13');
  await restore.locator('textarea[name="text"]').fill(original);
  await restore.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(restore.getByRole('status')).toContainText('Saved.');
  await page.reload();
  await openDetails(page.locator('[data-requirement="B2"]'));
  const approval = page.locator('[data-region="plan-approval"]');
  await approval.getByRole('checkbox').check();
  await approval.getByRole('button', { name: 'Approve this version', exact: true }).click();
  await expect(page).toHaveURL(/approval=recorded/);
  await expect(page.locator('[data-requirement="B2"]')).toHaveAttribute('data-state', 'complete');
  const organizer = await browser.newPage({ baseURL: baseURL! });
  await signInAs(organizer, 'test_organizer');
  await gotoRidingRestarts(organizer, '/events/EV-0362');
  await openDetails(organizer.locator('[data-requirement="B2"]'));
  await expect(organizer.locator('[data-requirement="B2"] [data-plan-section]').first()).toBeVisible();
  await expect(organizer.locator('[data-requirement="B2"] textarea:enabled')).toHaveCount(0);
  await organizer.close();
  // A physician not named on an event cannot open it; the agency's old plan link lands on its own page.
  expect((await page.request.get('/events/EV-0418/plan')).status()).toBe(404);
  await signInAs(page, 'test_ems');
  expect((await page.request.get('/events/EV-0362/plan')).status()).toBe(200);
});
