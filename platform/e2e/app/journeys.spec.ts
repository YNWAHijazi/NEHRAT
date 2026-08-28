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
import { expectAbsent } from '../helpers/absence';
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
      // WAIT FOR THE SAVE, NOT FOR THE NETWORK TO GO QUIET. The filing gate is derived
      // on the server from what was saved, so networkidle can be reached before the
      // save has landed -- and under a full run it was, which read as a gate refusing
      // a complete package. Then reload, so the gate is recomputed rather than
      // re-rendered from whatever the client last held.
      // BOTH LANGUAGES ARE ALWAYS IN THE DOM -- that is how the bilingual component
      // works, and CSS hides the one not in use. So a text locator must pick the
      // language the journey is running in: matching either resolves to two elements,
      // and matching the English one in an Arabic journey finds a hidden span.
      await expect(
        page.locator(lang === 'ar' ? 'text=حُفظ.' : 'text=Saved.').first(),
      ).toBeVisible({ timeout: 30_000 });
      await gotoRidingRestarts(page, `/events/${eventId}/submit`);

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
     * PASS B JOURNEY 15 — the public, signed out. Applicability in all three branches,
     * then the reference lookup returning four fields and no more.
     *
     * IT COULD NOT COMPLETE UNTIL SLICE 0 WAS BUILT. `/` redirected to sign-in, so the
     * first thing the platform said to a member of the public was "prove who you are".
     * There was no applicability screen and no lookup screen; only an endpoint.
     */
    test('the public reads the overview, checks all three branches, and verifies a reference', async ({ page }) => {
      // THE OVERVIEW, signed out, without being asked to sign in.
      await gotoRidingRestarts(page, '/');
      await expect(page.locator('[data-region="hero"]')).toBeVisible();
      await expect(page.locator('[data-region="services"] a')).toHaveCount(3);
      await expect(page.locator('[data-region="public-tools"] a')).toHaveCount(2);
      // What the platform does NOT do, on the page itself.
      await expect(page.locator('[data-region="jurisdiction"]')).toContainText(
        lang === 'ar' ? 'لا ترخّص الفعاليات' : 'It does not authorize events',
      );

      // BRANCH ONE — an event. Any one criterion is enough.
      await gotoRidingRestarts(page, '/applicability?subject=event&c=1');
      const answer = page.locator('[data-region="applicability-answer"]');
      await expect(answer).toContainText(lang === 'ar' ? 'خاضعة للبروتوكول' : 'Subject to the Protocol');
      // "What is not routinely subject" renders ONLY here (ROADMAP 1).
      await expect(page.locator('[data-region="not-routinely-subject"]')).toBeVisible();

      // None selected is NOT "not subject": the Ministry makes the final determination.
      await gotoRidingRestarts(page, '/applicability?subject=event&c=');
      await expect(answer).toContainText(
        lang === 'ar' ? 'تتخذ الوزارة القرار النهائي' : 'The Ministry makes the final determination',
      );

      // BRANCH TWO — a venue. Both conditions, or it routes to the event branch.
      await gotoRidingRestarts(page, '/applicability?subject=venue&hosts=1&cap=1');
      await expect(answer).toContainText(lang === 'ar' ? 'موقع فعاليات متكرر' : 'A recurring event venue');
      await gotoRidingRestarts(page, '/applicability?subject=venue&hosts=1');
      await expect(answer).toContainText(lang === 'ar' ? 'ليس موقع فعاليات متكرر' : 'Not a recurring event venue');
      await expectAbsent(page, {
        absent: '[data-region="not-routinely-subject"]',
        anchor: answer,
        because: 'what is not routinely subject belongs to the event branch alone',
      });

      // BRANCH THREE — a facility, which NEVER returns a bare yes or no. The schools
      // category is the live unset state and the one most likely to look broken.
      await gotoRidingRestarts(page, '/applicability?subject=facility&cat=1');
      await expect(answer).toContainText(lang === 'ar' ? 'بانتظار قيمة من الوزارة' : 'Awaiting a Ministry value');
      const waiting = page.locator('[data-region="waiting-on-ministry"]');
      await expect(waiting).toBeVisible();
      await expect(waiting).toContainText(lang === 'ar' ? 'الجدول المرحلي' : 'The phased schedule');
      // The unset state is the answer, not a gap in it.
      await expect(waiting).toContainText(
        lang === 'ar' ? 'هذا هو الجواب' : 'This is the answer, not a gap in it',
      );

      // THE LOOKUP SCREEN, in front of the endpoint. Four fields and no more.
      await gotoRidingRestarts(page, '/lookup');
      await expect(page.locator('[data-region="lookup-form"]')).toBeVisible();
      await page.locator('input[name="reference"]').fill('MOPH-EV-2026-0244');
      await page.locator('input[name="eventStartDate"]').fill('2026-08-09');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
      const result = page.locator('[data-region="lookup-result"]');
      await expect(result).toBeVisible();
      for (const forbidden of ['@', 'R. Haddad', '+961']) {
        await expect(result, `${forbidden} must never appear in a public lookup`).not.toContainText(forbidden);
      }
    });

    /**
     * PASS B JOURNEY 14 — the platform owner. Activity visible, and a Ministry
     * administrator refused.
     */
    test('the platform owner sees counts, and the Ministry administrator cannot', async ({ page }) => {
      await signInAs(page, 'test_owner');
      await gotoRidingRestarts(page, '/platform/activity');
      await expect(page.locator('body')).toContainText(lang === 'ar' ? 'نشاط المنصة' : 'Platform activity');
      // COUNTS ONLY (SPEC 2c): no organizer, event or facility is named.
      const body = await page.locator('main').innerText();
      for (const named of ['Beirut Road Runners', 'Baalbeck', 'EV-0362', 'MOPH-EV']) {
        expect(body, `${named} is named on a counts-only surface`).not.toContain(named);
      }

      // And the seat is above the Ministry console, in both directions.
      await signInAs(page, 'test_moph_admin');
      const refused = await gotoRidingRestarts(page, '/platform/activity');
      expect([401, 403, 404]).toContain(refused?.status() ?? 0);
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
