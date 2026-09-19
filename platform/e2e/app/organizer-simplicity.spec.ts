import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';
import { LANGUAGES, useLanguage } from '../helpers/language';

for (const lang of LANGUAGES) {
  test(`organizer sees event identity and can expand progress on a phone (${lang})`, async ({ page, context }) => {
    await useLanguage(context, lang);
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418');
    const header = page.locator('[data-region="record-header"]');
    const action = page.locator('[data-region="next-action"]');
    const progress = page.locator('[data-region="rail"]');
    await expect(header).toBeVisible();
    await expect(action).toBeVisible();
    expect(await header.evaluate((el) => (el.compareDocumentPosition(document.querySelector('[data-region="next-action"]')!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true);
    await expect(progress.locator('summary')).toBeVisible();
    await expect(progress).not.toHaveAttribute('open');
    await progress.locator('summary').click();
    await expect(progress.locator('[data-rail]')).toBeVisible();
    await expect(progress.locator('[data-rail] > div')).toHaveCount(6);
    await progress.locator('summary').press('Enter');
    await expect(progress).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await action.getByRole('link').click();
    await expect(page).toHaveURL(/\/events\/EV-0418\/(requirements|plan|submit)|\/organization/);
  });
}

for (const lang of LANGUAGES) {
  test(`requirements separates uploads, invitations and review (${lang})`, async ({ page, context }) => {
    await useLanguage(context, lang);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    const nav = page.locator('[data-region="preparation-nav"]');
    await expect(nav).toBeVisible();
    await expect(nav.locator('a')).toHaveCount(3);
    await nav.locator('a[href="#medical-team"]').click();
    // Own the pending invitation: other journeys legitimately withdraw the demo one.
    const name = `Copy check ${lang} ${Date.now()}`;
    const form = page.locator('form:has(input[name="kind"][value="ems"])');
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="email"]').fill('copy-check@example.test');
    await form.locator('button[type=submit]').click();
    const row = page.locator('[data-region="g2"] > div > div', { hasText: name });
    const invitation = row.locator('[data-invitation-link]');
    await expect(invitation).toBeVisible();
    await invitation.getByRole('button').click();
    await expect(invitation.getByRole('status').locator(`[data-l="${lang}"]`)).toHaveText(lang === 'en' ? 'Link copied' : 'نُسخ الرابط');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(copied).origin).toBe(new URL(page.url()).origin);
    expect(new URL(copied).pathname).toMatch(/^\/invitations\/.+/);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } } });
    });
    await invitation.getByRole('button').click();
    await expect(invitation.locator('code')).toBeVisible();
    await expect(invitation.locator('code')).toHaveText(copied);
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('main *')).filter((el) => {
      if (el.closest('.info-note-label, .sr-only')) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && (box.x < 0 || box.right > window.innerWidth + 1);
    }).map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 70), style: el.getAttribute('style') })))).toEqual([]);
    await page.screenshot({ path: `/tmp/moph-requirements-${lang}.png`, fullPage: true });
    await nav.locator('a[href="#review"]').click();
    const review = page.locator('[data-region="review-submission"]');
    await expect(review.getByRole('link')).toBeVisible();
    await review.getByRole('link').click();
    await expect(page).toHaveURL(/\/events\/EV-0418\/submit/);
  });
}
