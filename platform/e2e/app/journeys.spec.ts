/**
 * PASS B — the journeys, COMPLETED, in English and then Arabic.
 *
 * The distinction the reviewer drew is the whole point of this file. Walking a
 * journey visits its screens; completing it means the party actually finishes what
 * the regulation asks of them and the record on the other side changes. A screen can
 * render perfectly in Arabic and still not be completable in Arabic -- a control
 * pushed off a mirrored layout, a validation message that never appears, a redirect
 * that lands somewhere else -- and no per-string parity guard or per-screen pixel
 * comparison can see that. Only a journey can.
 *
 * The language is set as a COOKIE BEFORE THE FIRST REQUEST, so the whole journey runs
 * in one language including redirects, server-action notices and refusals. Toggling
 * mid-journey would leave the earlier half untested.
 *
 * WHAT THIS FILE IS NOT: it is not every journey in ACCEPTANCE.md's fifteen. Several
 * are completed by the specs that already exist -- showstoppers completes Level 1
 * filing, nominations completes creation to determination, facility completes the
 * school-category stop, nomination-stages completes the three-stage nomination. Those
 * run in English only. This file completes the journeys where BOTH languages are
 * load-bearing, and the report says plainly which of the fifteen are covered how.
 */

import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';
import { LANGUAGES, useLanguage } from '../helpers/language';

/** A label lookup that works in either language, from the page's own bilingual DOM. */
async function fillLabelled(page: Page, en: string, value: string): Promise<void> {
  // Every label carries both languages as data-l spans, and the hidden one is still in
  // the DOM -- so an English label text finds the field whichever language is showing.
  await page.locator('label', { hasText: en }).first().locator('input, textarea').first().fill(value);
}

for (const lang of LANGUAGES) {
  test.describe(`journeys in ${lang}`, () => {
    test.beforeEach(async ({ context }) => {
      await useLanguage(context, lang);
    });

    /**
     * PASS B JOURNEY 1 (abbreviated to its load-bearing half) and JOURNEY 11.
     *
     * Create an event, complete the assessment, watch the level derive, file, and
     * have the Ministry record a determination the organizer can then read and print.
     * This is the spine of the platform: if it completes in a language, that language
     * works for the thing the platform is for.
     */
    test('an organizer creates, assesses, files; the Ministry determines; the organizer prints', async ({ page }) => {
      test.setTimeout(240_000);
      await signInAs(page, 'test_organizer');

      // The document is in the right language and the right direction from the first
      // request -- not after a toggle.
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', lang);
      await expect(html).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

      await gotoRidingRestarts(page, '/events/new');
      const stamp = Date.now().toString(36);
      await fillLabelled(page, 'Event name (English)', `Journey ${lang} ${stamp}`);
      await fillLabelled(page, 'Event name (Arabic)', `رحلة ${stamp}`);
      await fillLabelled(page, 'Start date', '2026-10-02');
      await fillLabelled(page, 'End date', '2026-10-02');
      await fillLabelled(page, 'Event type', 'Indoor recreational gathering');
      await fillLabelled(page, 'Venue, route, or location', 'Municipal hall, Jounieh');
      await fillLabelled(page, 'Municipality or municipalities', 'Jounieh');
      await fillLabelled(page, 'Opening time', '14:00');
      await fillLabelled(page, 'Closing time', '18:00');
      await fillLabelled(page, 'Expected participants', '80');
      await fillLabelled(page, 'Expected spectators or attendees', '40');
      await fillLabelled(page, 'Expected staff, performers, contractors, and volunteers', '10');
      await fillLabelled(page, 'Expected maximum simultaneous attendance', '120');

      // THE TWO VENUE QUESTIONS ARE ANSWERED BY THE ORGANIZER, not by the form on
      // their behalf -- an unanswered pair derives nothing (non-negotiable 0). In
      // Arabic these are the same controls in a mirrored layout, which is the half a
      // per-string parity check cannot see.
      const noPills = page.locator('button[data-yesno="no"]');
      await expect(noPills).toHaveCount(2);
      await noPills.nth(0).click();
      await noPills.nth(1).click();

      // Every domain at score 0, so the level derives to 1 rather than being chosen.
      const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
      const zeroCount = await zeros.count();
      expect(zeroCount).toBeGreaterThanOrEqual(9);
      for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();

      await page.locator('button:has-text("Save the assessment and open the event record"), button:has-text("حفظ التقييم وفتح سجل الفعالية")').first().click();
      await page.waitForURL(/\/events\/EV-\d+/);
      const eventId = new URL(page.url()).pathname.split('/')[2]!;
      // BOTH RESULTS AND WHICH GOVERNED -- never the final level alone.
      await expect(page.locator('[data-region="derivation"]')).toBeVisible();

      // THE PACKAGE. One attachment at Level 1, six declarations, and the
      // certification -- which is part of making the submission, not decoration.
      await gotoRidingRestarts(page, `/events/${eventId}/requirements`);
      const attach = page.locator('form:has(input[name="docKey"])').first();
      await attach.locator('input[type="file"]').setInputFiles({
        name: 'arrangements.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 journey'),
      });
      await attach.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');

      await gotoRidingRestarts(page, `/events/${eventId}/submit`);
      for (let i = 0; i < 6; i += 1) {
        await page.locator('label:has(input[type="checkbox"]:not(:checked))').first().locator('input').check();
      }
      await fillLabelled(page, 'Authorized representative', 'R. Haddad');
      await fillLabelled(page, 'Telephone', '+961 1 000 000');
      await fillLabelled(page, 'Position', 'Events director');
      await page.locator('button:has-text("Save the form"), button:has-text("حفظ النموذج")').first().click();
      await page.waitForLoadState('networkidle');

      const fileBtn = page.locator('button:has-text("File the submission"), button:has-text("تقديم الملف")').first();
      await expect(fileBtn).toBeEnabled({ timeout: 40_000 });
      await fileBtn.click();
      await page.waitForURL(/acknowledgment/);
      const body = await page.locator('body').innerText();
      const reference = /MOPH-EV-\d{4}-\d{4}/.exec(body)?.[0];
      expect(reference, 'no Ministry reference number was issued').toBeTruthy();

      // THE MINISTRY DETERMINES. Journey 11, on the record just created.
      await signInAs(page, 'test_moph');
      await gotoRidingRestarts(page, `/ministry/submissions/${eventId}`);
      const outcome = page.locator('[data-region="outcome"]');
      await expect(outcome).toBeVisible();
      await outcome.locator('input[type="radio"][value="satisfied"]').check();
      await outcome.locator('button[type="submit"]').first().click();
      await page.waitForURL(/notice=recorded/);
      await expect(page.locator('[data-region="standing-determination"]')).toBeVisible();

      // AND THE ORGANIZER READS IT, and can print the certificate -- the document
      // they hand to the authorising authority.
      await signInAs(page, 'test_organizer');
      await gotoRidingRestarts(page, `/events/${eventId}`);
      await expect(page.locator('[data-region="determination-card"]')).toBeVisible();
      await gotoRidingRestarts(page, `/events/${eventId}/determination`);
      const cert = page.locator('[data-region="certificate"]');
      await expect(cert).toBeVisible();
      await expect(cert).toContainText(reference!);
      await expect(page.locator('[data-region="certificate-controls"]')).toBeVisible();
    });

    /**
     * PASS B JOURNEY 15 — the public, signed out.
     *
     * IT CANNOT COMPLETE, AND THIS TEST SAYS SO RATHER THAN PRETENDING. The journey
     * is "applicability in all three branches → reference lookup → four fields", and
     * Slice 0 -- the public landing, the applicability screen and the lookup screen --
     * is not built. `/` redirects to sign-in. The only public surface that exists is
     * the lookup ENDPOINT.
     *
     * So what is asserted here is the part that exists: the endpoint returns four
     * fields and never a fifth, signed out, in either language. The missing screens
     * are reported as unbuilt in the acceptance report, not covered by a test that
     * quietly tests something smaller.
     */
    test('the only public surface that exists returns four fields and no more', async ({ page }) => {
      // The lookup takes a SECOND FACTOR -- the event start date -- because sequential
      // references plus an unauthenticated lookup would let anyone walk the national
      // register (non-negotiable 5b). e2e/app/public-lookup.spec.ts is the thorough
      // test of this endpoint; this asserts only that the public path exists and
      // discloses four fields, as the journey's surviving half.
      const response = await page.request.get(
        '/api/public/reference-lookup?reference=MOPH-EV-2026-0244&eventStartDate=2026-08-09',
      );
      expect(response.ok()).toBe(true);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(['eventName', 'exists', 'level', 'status'].sort());
      const serialised = JSON.stringify(payload);
      for (const forbidden of ['@', 'R. Haddad', '+961', 'representative']) {
        expect(serialised, `${forbidden} must never leave the lookup`).not.toContain(forbidden);
      }
    });

    /**
     * PASS B JOURNEY 13 — the Ministry administrator oversees. The console exists,
     * every tab loads, and the complete file is readable in this language.
     */
    test('the administrator opens the console and reads a complete file', async ({ page }) => {
      await signInAs(page, 'test_moph_admin');
      await gotoRidingRestarts(page, '/ministry/admin/records');
      await expect(page.locator('[data-region="admin-tabs"] a')).toHaveCount(4);
      await expect(page.locator('[data-region="records"] > a').first()).toBeVisible();
      await gotoRidingRestarts(page, '/ministry/admin/records/EV-0362');
      await expect(page.locator('[data-region="file-answers"]')).toBeVisible();
      await expect(page.locator('[data-region="file-determinations"]')).toBeVisible();
      await gotoRidingRestarts(page, '/ministry/admin/activity');
      await expect(page.locator('[data-region="activity"]')).toBeVisible();
    });
  });
}
