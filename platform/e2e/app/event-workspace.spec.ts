import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { useLanguage } from '../helpers/language';

// The event's tabs became one record page (owner brief, 2026-10-07): the identity header
// leads it, the two requirement summaries follow, and Submit sits at its foot. The retired
// tab paths redirect to the page they became.
for (const lang of ['en', 'ar'] as const) {
  for (const width of [1280, 375]) {
    test(`event identity leads the record page and the retired tabs redirect to it (${lang}, ${width})`, async ({ page, context }) => {
      await useLanguage(context, lang);
      await page.setViewportSize({ width, height: 900 });
      await signInAs(page, 'test_organizer');
      await page.goto('/events/EV-0418');
      const header = page.locator('[data-region="event-workspace-header"]');
      await expect(header).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // Both names show: the reader's language leads, the other follows in brackets (2026-10-05).
      await expect(header.locator('bdi[lang="en"]:visible')).toBeVisible();
      await expect(header.locator('bdi[lang="ar"]:visible')).toBeVisible();
      await expect(header.locator('[data-region="record-status"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // Level 2: the site map is required; the plan and the Medical Director are recommended (D1, D2).
      const summaries = page.locator('[data-region="requirement-summaries"]');
      await expect(summaries.locator('[data-summary="required"] [data-summary-row="P-M"]')).toBeVisible();
      await expect(summaries.locator('[data-summary="recommended"] [data-summary-row="B2"]')).toBeVisible();
      await expect(summaries.locator('[data-summary="recommended"] [data-summary-row="B3"]')).toBeVisible();
      await expect(summaries.locator('[data-summary="required"] [data-summary-row="B2"]')).toHaveCount(0);
      await expect(page.locator('[data-requirement="B3"]')).toHaveAttribute('data-group', 'recommended');
      await expect(page.locator('[data-region="final-review"] [data-region="submit-button"]')).toBeDisabled();
      await page.screenshot({ path: `/tmp/moph-workspace-${lang}-${width}.png`, fullPage: true });
      await page.goto('/events/EV-0418/requirements');
      await expect(page.locator('[data-region="requirement-list"] [data-list-row="P-M"]')).toBeVisible();
      for (const [path, hash] of [['/submit', '#final-review'], ['/medical-team?tab=director', '#req-B3'], ['/medical-team?tab=ems', '#req-B7']] as const) {
        await page.goto(`/events/EV-0418${path}`);
        await expect(page).toHaveURL(new RegExp(`/events/EV-0418${hash}$`));
        await expect(header).toBeVisible();
      }
    });
  }
}

test('end date and closing time follow their starts until the user changes them', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await page.goto('/events/new');
  const start = page.getByLabel('Start date', { exact: false });
  const end = page.getByLabel('End date', { exact: false });
  const opening = page.getByLabel('Opening time', { exact: false });
  const closing = page.getByLabel('Closing time', { exact: false });
  await start.fill('2026-12-01');
  await expect(end).toHaveValue('2026-12-01');
  await start.fill('2026-12-02');
  await expect(end).toHaveValue('2026-12-02');
  await end.fill('2026-12-05');
  await start.fill('2026-12-03');
  await expect(end).toHaveValue('2026-12-05');
  await end.fill('');
  await expect(end).toHaveValue('2026-12-03');
  await opening.fill('09:00');
  await expect(closing).toHaveValue('09:00');
  await opening.fill('10:00');
  await expect(closing).toHaveValue('10:00');
  await closing.fill('18:00');
  await opening.fill('11:00');
  await expect(closing).toHaveValue('18:00');
  await closing.fill('');
  await expect(closing).toHaveValue('11:00');
});

test('Level 3 lists the plan, the Medical Director and each agency\'s declaration as required', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await page.goto('/events/EV-0362');
  const required = page.locator('[data-region="requirement-summaries"] [data-summary="required"]');
  await expect(required).toBeVisible();
  await expect(required.locator('[data-summary-row="B2"]')).toBeVisible();
  await expect(required.locator('[data-summary-row="B3"]')).toBeVisible();
  await expect(required.locator('[data-summary-row="B20"]')).toBeVisible();
  await expect(page.locator('[data-region="requirement-summaries"] [data-summary="recommended"] [data-summary-row="B2"]')).toHaveCount(0);
  await expect(page.locator('[data-requirement="B2"]')).toHaveAttribute('data-group', 'required');
});
