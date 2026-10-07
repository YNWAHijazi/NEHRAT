import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';
import { LANGUAGES, useLanguage } from '../helpers/language';
import { openDetails } from '../helpers/record';

for (const lang of LANGUAGES) {
  test(`organizer sees event identity and always sees progress on a phone (${lang})`, async ({ page, context }) => {
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
    await expect(progress.locator('[data-rail]')).toBeVisible();
    await expect(progress.locator('[data-rail] > div')).toHaveCount(6);
    await expect(progress.locator('summary')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    // The next step is a card on this same page, or the organization screen.
    await action.getByRole('link').click();
    await expect(page).toHaveURL(/\/events\/EV-0418|\/organization/);
  });
}

for (const lang of LANGUAGES) {
  test(`the invitation is sent from the row that needs the party, and its link is copied there (${lang})`, async ({ page, context }) => {
    await useLanguage(context, lang);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418');
    // Own the pending invitation: other journeys legitimately withdraw the demo one.
    const name = `Copy check ${lang} ${Date.now()}`;
    const ems = await openDetails(page.locator('[data-requirement="B7"]'));
    const form = ems.locator('form:has(input[name="kind"][value="ems"])');
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="email"]').fill('copy-check@example.test');
    await form.locator('button[type=submit]').click();
    await page.waitForURL(/\/events\/EV-0418/);
    const row = page.locator('[data-requirement="B7"] [data-region="party-ems"] [data-party="nominated"]', { hasText: name });
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
    await page.screenshot({ path: `/tmp/moph-record-${lang}.png`, fullPage: true });
    // The foot of the same page is where the record is submitted from.
    await openDetails(page.locator('#final-review'));
    await expect(page.locator('[data-region="final-review"] [data-region="submit-button"]')).toBeVisible();
  });
}
