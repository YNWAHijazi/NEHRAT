import { test, expect } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';
import { readFileSync } from 'node:fs';
const maxUploadBytes = () => (JSON.parse(readFileSync(new URL('../../lib/rules/data/uploads.json', import.meta.url), 'utf8')) as { maxBytes: number }).maxBytes;

for (const lang of ['en', 'ar']) {
  test(`map uploads accept the advertised limit, reject oversized files and keep the page usable (${lang})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'lang', value: lang, url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    const map = page.locator('[data-document="siteMap"]');
    await map.locator(':scope > summary').click();
    const existing = map.locator('details > summary');
    if (await existing.count()) await existing.click();
    const input = map.locator('input[type="file"]');
    await input.setInputFiles({ name: 'too-large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(maxUploadBytes() + 1) });
    await expect(map.getByRole('alert')).toBeVisible();
    expect(await input.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    const bytes = Buffer.alloc(maxUploadBytes(), 32); bytes.write('%PDF-1.4\n');
    await input.setInputFiles({ name: 'full-size-route-map.pdf', mimeType: 'application/pdf', buffer: bytes });
    await input.locator('xpath=ancestor::form').locator('button[type="submit"]').click();
    await expect(map).toContainText('full-size-route-map.pdf');
    const download = await page.request.get('/api/documents/EV-0418/siteMap');
    expect(download.status()).toBe(200);
    expect((await download.body()).equals(bytes)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: test.info().outputPath('requirements-mobile.png'), fullPage: true });
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
  await page.getByRole('button', { name: 'This event has been held before', exact: true }).click();
  const history = page.locator('[data-region="previous-history"]');
  await expect(history).toBeVisible();
  await history.getByRole('button').last().click();
  await expect(history.getByRole('button').last()).toHaveAttribute('aria-pressed', 'true');
});

test('Director and organizer share a guided plan without losing concurrent edits', async ({ page, browser, baseURL }) => {
  await signInAs(page, 'test_director');
  await gotoRidingRestarts(page, '/events/EV-0362');
  await page.locator('[data-region="director-plan"]').click();
  await expect(page).toHaveURL(/EV-0362\/plan/);
  const originalFile = await page.request.get('/api/documents/EV-0362/plan-document');
  expect(originalFile.status()).toBe(200);
  const originalBytes = await originalFile.body();
  await page.getByRole('button', { name: 'Write the plan here', exact: true }).click();
  const section = page.getByRole('button', { name: /^1 / }).and(page.locator('[aria-expanded]'));
  if (await section.getAttribute('aria-expanded') !== 'true') await section.click();
  await expect(page.getByRole('button', { name: 'What to include', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'What to include', exact: true }).first().click();
  const helpId = await page.getByRole('button', { name: 'What to include', exact: true }).first().getAttribute('aria-controls');
  await expect(page.locator(`[id="${helpId}"]`)).toBeVisible();
  await page.getByRole('textbox', { name: /^1\./ }).fill('Director medical planning contribution.');
  const organizer = await browser.newPage({ baseURL: baseURL! });
  await signInAs(organizer, 'test_organizer');
  await gotoRidingRestarts(organizer, '/events/EV-0362/plan');
  await page.getByRole('button', { name: /^Save the plan/ }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await organizer.getByRole('button', { name: /^Save the plan/ }).click();
  await expect(organizer.locator('main').getByRole('alert')).toContainText('Someone updated this plan');
  await organizer.reload();
  await expect(organizer.getByRole('button', { name: 'Write the plan here', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const first = organizer.getByRole('button', { name: /^1 / }).and(organizer.locator('[aria-expanded]'));
  if (await first.getAttribute('aria-expanded') !== 'true') await first.click();
  await expect(organizer.getByRole('textbox', { name: /^1\./ })).toHaveValue('Director medical planning contribution.');
  await organizer.locator('[data-region="versions"] details > summary').first().click();
  const oldAttachment = organizer.getByRole('link', { name: 'Open this version’s attachment', exact: true }).first();
  const historyDownload = await organizer.request.get((await oldAttachment.getAttribute('href'))!);
  expect(historyDownload.status()).toBe(200);
  expect((await historyDownload.body()).equals(originalBytes)).toBe(true);
  // Restore this shared fixture's complete attachment so later filing tests remain independent.
  await page.reload();
  await page.getByRole('button', { name: 'Attach an existing plan', exact: true }).click();
  await page.locator('[data-region="plan-attach"] input').setInputFiles({ name: 'restored-medical-plan.pdf', mimeType: 'application/pdf', buffer: originalBytes });
  await expect(page.getByText('Attached: restored-medical-plan.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Save the plan/ }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await organizer.close();
  expect((await page.request.get('/events/EV-0418/plan')).status()).toBe(404);
  await signInAs(page, 'test_ems');
  expect((await page.request.get('/events/EV-0362/plan')).status()).toBe(200);
});
