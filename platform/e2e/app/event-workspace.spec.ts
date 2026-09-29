import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { useLanguage } from '../helpers/language';

for (const lang of ['en', 'ar'] as const) {
  for (const width of [1280, 375]) {
    test(`event identity and navigation stay aligned across tabs (${lang}, ${width})`, async ({ page, context }) => {
      await useLanguage(context, lang);
      await page.setViewportSize({ width, height: 900 });
      await signInAs(page, 'test_organizer');
      let expectedY: number | undefined;
      let identity: string | undefined;
      for (const [path, active] of [['', 'Overview'], ['/requirements', 'Requirements'], ['/medical-team?tab=director', 'Medical Director'], ['/medical-team?tab=ems', 'EMS agencies'], ['/submit', 'Submit']] as const) {
        await page.goto(`/events/EV-0418${path}`);
        const header = page.locator('[data-region="event-workspace-header"]');
        await expect(header).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const nav = header.locator('nav');
        await expect(nav.locator('a')).toHaveCount(5);
        await expect(nav.locator('[aria-current="page"]')).toContainText(active);
        const y = (await nav.boundingBox())!.y;
        if (expectedY === undefined) expectedY = y;
        expect(Math.abs(y - expectedY)).toBeLessThanOrEqual(1);
        const text = await header.locator('[data-region="record-header"]').innerText();
        if (identity === undefined) identity = text;
        expect(text).toBe(identity);
        await expect(header.locator('bdi[lang="en"]')).toBeVisible();
        await expect(header.locator('bdi[lang="ar"]')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      const required = page.locator('[data-checklist="required"]');
      const optional = page.locator('[data-checklist="optional"]');
      await expect(required.locator('[data-check="siteMap"]')).toBeVisible();
      await expect(optional.locator('[data-check="plan"]')).toBeVisible();
      await expect(optional.locator('[data-check="director"]')).toBeVisible();
      await expect(required.locator('[data-check="plan"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: lang === 'en' ? /^Submit/ : /^تقديم/ }).last()).toBeDisabled();
      await page.screenshot({ path: `/tmp/moph-workspace-${lang}-${width}.png`, fullPage: true });
      await page.goto('/events/EV-0418/requirements');
      await expect(page.locator('h2').filter({ hasText: 'Medical Director' })).toContainText('3');
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

test('Level 3 lists the plan and Medical Director as required', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await page.goto('/events/EV-0362/submit');
  const required = page.locator('[data-checklist="required"]');
  await expect(required).toBeVisible();
  await expect(required.locator('[data-check="plan"]')).toBeVisible();
  await expect(required.locator('[data-check="director"]')).toBeVisible();
  await expect(required.locator('[data-check="emsDeclarations"]')).toBeVisible();
  await expect(page.locator('[data-checklist="optional"] [data-check="plan"]')).toHaveCount(0);
});
