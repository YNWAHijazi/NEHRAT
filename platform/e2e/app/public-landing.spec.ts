/**
 * SLICE 0 — the public surface, signed out.
 *
 * The overview, three service detail screens, the branching applicability check, the
 * search screen and the lookup. None of it touches an account, and none of it stores
 * anything: every answer is in the URL, so it can be shared and re-read, and nothing a
 * person tries here is recorded against them.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { LANGUAGES, useLanguage } from '../helpers/language';

for (const lang of LANGUAGES) {
  test.describe(`the public surface in ${lang}`, () => {
    test.beforeEach(async ({ context }) => {
      await useLanguage(context, lang);
    });

    test('search answers with services and guidance, in either language', async ({ page }) => {
      await gotoRidingRestarts(page, '/');
      // The hero field, which is how most people arrive at a question.
      await expect(page.locator('[data-region="hero-search"]')).toBeVisible();
      await expect(page.locator('[data-region="hero-chips"] a')).toHaveCount(4);

      await gotoRidingRestarts(page, '/search?q=deadline');
      await expect(page.locator('[data-region="search-services"]')).toBeVisible();
      await expect(page.locator('[data-region="search-guidance"]')).toBeVisible();

      // THE SAME SEARCH IN ARABIC FINDS THE SAME THINGS. Matching is bilingual, so the
      // Arabic side is the tool rather than a translation of one.
      await gotoRidingRestarts(page, `/search?q=${encodeURIComponent('مهل')}`);
      await expect(page.locator('[data-region="search-guidance"]')).toBeVisible();
    });

    test('a reference number goes to the lookup, and is not answered in place', async ({ page }) => {
      // The prototype answers a pasted reference immediately and shows five facts. This
      // shows four and asks for the second factor first: a reference alone, answered
      // instantly, is a register anyone can walk by counting upwards.
      await gotoRidingRestarts(page, '/search?q=MOPH-EV-2026-0244');
      const ref = page.locator('[data-region="search-reference"]');
      await expect(ref).toBeVisible();
      await expectAbsent(page, {
        absent: '[data-region="lookup-result"]',
        anchor: ref,
        because: 'a reference is not verified without the event start date',
      });
      await ref.locator('a').click();
      await page.waitForURL(/\/lookup\?reference=MOPH-EV-2026-0244/);
      // Carried over, and the second factor still asked for.
      await expect(page.locator('input[name="reference"]')).toHaveValue('MOPH-EV-2026-0244');
      await expect(page.locator('input[name="eventStartDate"]')).toBeVisible();
    });

    test('nothing matching is not a dead end', async ({ page }) => {
      await gotoRidingRestarts(page, '/search?q=zzzznothing');
      const none = page.locator('[data-region="search-no-results"]');
      await expect(none).toBeVisible();
      // Two routes out, and both are real screens.
      await expect(none.locator('a[href="/applicability"]')).toBeVisible();
      await expect(none.locator('a[href="/contact"]')).toBeVisible();
    });

    test('the Ministry contact names an owner rather than offering a form to nowhere', async ({ page }) => {
      await gotoRidingRestarts(page, '/contact');
      await expect(page.locator('[data-region="contact-scope"]')).toBeVisible();
      await expect(page.locator('[data-region="contact-channel"]')).toBeVisible();
      // No form: a message box that stored a question nobody reads is the worse failure.
      await expectAbsent(page, {
        absent: 'textarea, input[type="email"]',
        anchor: '[data-region="contact-channel"]',
        because: 'this platform does not carry messages to the Ministry and does not pretend to',
      });
    });

    test('every service detail screen is reachable and states the fee', async ({ page }) => {
      for (const route of [
        '/services/certify-an-event',
        '/services/register-a-venue',
        '/services/register-a-facility',
      ]) {
        await gotoRidingRestarts(page, route);
        await expect(page.locator('[data-region="service-detail"]')).toBeVisible();
        await expect(page.locator('body')).toContainText(lang === 'ar' ? 'الرسم: لا يوجد' : 'Fee: None');
      }
    });
  });
}
