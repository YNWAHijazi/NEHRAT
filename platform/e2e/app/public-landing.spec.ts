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

    test('the hero is a dark band, and it is the page\'s one dark ground', async ({ page }) => {
      await gotoRidingRestarts(page, '/');
      const band = page.locator('[data-region="hero-band"]');
      await expect(band).toBeVisible();
      // The band takes its ground and its text from the hero tokens, not the page's --
      // its text sits on a dark ground in BOTH themes and cannot take the page ink.
      const ground = await band.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      const pageGround = await page.locator('body').evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(ground, 'the hero band shares the page ground -- there is no band').not.toBe(pageGround);
      // Full width: the band is not inset inside the measured column.
      const bandBox = await band.boundingBox();
      const viewport = page.viewportSize();
      expect(bandBox!.width).toBeGreaterThanOrEqual((viewport?.width ?? 1280) - 2);
    });

    test('the dock is four round controls, not a stack of labels', async ({ page }) => {
      await gotoRidingRestarts(page, '/');
      const dock = page.locator('[data-dock]');
      await expect(dock.locator('button')).toHaveCount(4);
      // Text size CYCLES on one button: three sizes are one setting.
      const sizeBtn = dock.locator('button[title="Text size"]');
      await expect(sizeBtn).toHaveCount(1);
      const before = await page.locator('html').getAttribute('data-textsize');
      await sizeBtn.click();
      await expect(page.locator('html')).not.toHaveAttribute('data-textsize', before ?? '100');
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

    test('all three services end with the same flow, and their own end state', async ({ page }) => {
      // They had drifted into three different shapes, which made two of the three read
      // as less considered than the first. Same table, different end state.
      const ends: [string, string, string][] = [
        ['/services/certify-an-event', 'From registration to reference number', 'من التسجيل إلى الرقم المرجعي'],
        ['/services/register-a-venue', 'From registration to classification', 'من التسجيل إلى التصنيف'],
        ['/services/register-a-facility', 'From registration to a maintained record', 'من التسجيل إلى سجل محفوظ'],
      ];
      for (const [route, en, ar] of ends) {
        await gotoRidingRestarts(page, route);
        const flow = page.locator('[data-region="flow"]');
        await expect(flow, `${route} has no flow`).toBeVisible();
        await expect(page.locator('body')).toContainText(lang === 'ar' ? ar : en);
        // A numbered sequence, not a paragraph: header row plus at least six steps.
        expect(await flow.locator('> div').count()).toBeGreaterThanOrEqual(7);
      }

      // The venue reuses the SAME nine domains the event assessment uses, answered for
      // a routine operating session. That section did not exist and made the annual
      // classification look like a formality.
      await gotoRidingRestarts(page, '/services/register-a-venue');
      await expect(page.locator('[data-region="domains"] > div')).toHaveCount(9);

      // The facility names the rule beside each category, not the category alone.
      await gotoRidingRestarts(page, '/services/register-a-facility');
      await expect(page.locator('[data-region="facility-categories"] > div')).toHaveCount(6);
      await expect(page.locator('[data-region="facility-obligations"] > div')).toHaveCount(9);
    });

    test('each suggestion chip reaches a different kind of result', async ({ page }) => {
      // One per kind, from the prototype: a service, guidance, a real reference number
      // so the lookup path is discoverable, and a term that matches nothing so the
      // no-results state is reachable without inventing a failure.
      const expected: [string, string][] = [
        ['Certify an event', 'search-services'],
        ['defibrillator', 'search-guidance'],
        ['MOPH-EV-2026-0418', 'search-reference'],
        ['Road closure', 'search-no-results'],
      ];
      for (const [q, region] of expected) {
        await gotoRidingRestarts(page, `/search?q=${encodeURIComponent(q)}`);
        await expect(page.locator(`[data-region="${region}"]`), `${q} should reach ${region}`).toBeVisible();
      }
    });
  });
}
