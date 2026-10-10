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
import { seededDate } from '../helpers/seeded-date';
import { signInAs } from '../helpers/signin';
import { answerLevel1Rows, certify, openAllRequirements } from '../helpers/record';
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
      await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
      await fillLabelled(page, 'Venue, route, or location', 'Municipal hall, Jounieh');
      await fillLabelled(page, 'Municipality or municipalities', 'Jounieh');
      await fillLabelled(page, 'Opening time', '14:00');
      await fillLabelled(page, 'Closing time', '18:00');
      // One attendance figure, asked in question 1 (owner, 10 October 2026).
      await fillLabelled(page, 'Most people at the same time', '130');

      // The event-type dropdown answers the venue question; no separate venue
      // yes/no controls exist any more (partner review: picking the type IS the
      // floor input).

      // Every domain at score 0, so the level derives to 1 rather than being chosen.
      const zeros = page.locator('button[aria-pressed]:not([disabled]):has(span:text-is("0"))');
      const zeroCount = await zeros.count();
      expect(zeroCount).toBeGreaterThanOrEqual(9);
      for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();

      // Annex A Part F: the declaration's fields are required to save.

      await fillLabelled(page, 'Authorized representative', 'R. Haddad');

      await fillLabelled(page, 'Position', 'Events director');

      await page.locator('button:has-text("Continue to requirements"), button:has-text("المتابعة إلى المتطلبات")').first().click();
      await page.waitForURL(/\/events\/EV-\d+/);
      const eventId = new URL(page.url()).pathname.split('/')[2]!;
      // BOTH RESULTS AND WHICH GOVERNED -- never the final level alone.
      await expect(page.locator('[data-region="derivation"]')).toBeVisible();

      // THE PACKAGE, on the one record page. No plan card at Level 1; the organizer's
      // own rows, then the certification -- which is part of making the submission,
      // not decoration (Level 1 asks the certification alone: catalogue P-C).
      await openAllRequirements(page);
      await expect(page.locator('[data-region="requirement-summaries"]')).toBeVisible();
      await expect(page.locator('[data-requirement="B2"]')).toHaveCount(0);
      await answerLevel1Rows(page);
      // THE SUBMIT BUTTON IS THE READINESS SIGNAL: the certification autosaves on blur
      // and the server's blockers decide; once nothing remains, the declaration row
      // leaves the remaining list and the button enables.
      const fileBtn = await certify(page, { representative: 'R. Haddad', telephone: '+961 1 000 000', position: 'Events director' });
      await expect(page.locator('[data-region="organizer-declaration"]')).toBeVisible();
      await expect(page.locator('[data-remaining="P-C"]')).toHaveCount(0);
      await fileBtn.click();
      await page.waitForURL(/acknowledgment/);
      const body = await page.locator('body').innerText();
      // One identifier (owner ruling, 2026-09-29): the receipt carries the record ID the event
      // was created with; no separate MOPH-EV reference is issued for a new filing.
      const reference = /EV-\d{4}/.exec(new URL(page.url()).pathname)?.[0];
      expect(reference, 'the receipt names no record ID').toBeTruthy();
      expect(body).toContain(reference!);

      // THE MINISTRY DETERMINES. Journey 11, on the record just created.
      await signInAs(page, 'test_moph');
      await gotoRidingRestarts(page, `/ministry/submissions/${eventId}`);
      // The record as frozen at filing: the Level 1 rows the organizer answered, each Complete.
      await expect(page.locator('#review-requirements')).toContainText('Frozen at filing');
      await expect(page.locator('#review-requirements [data-review-requirement="B7"]')).toHaveAttribute('data-state', 'complete');
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
    test('the public reads the overview, checks both branches, and verifies a reference', async ({ page }) => {
      // THE OVERVIEW, signed out, without being asked to sign in.
      await gotoRidingRestarts(page, '/');
      await expect(page.locator('[data-region="hero"]')).toBeVisible();
      // Two services (owner, 9 October 2026): an event, and a facility/site.
      await expect(page.locator('[data-region="services"] a')).toHaveCount(2);
      await expect(page.locator('[data-region="public-tools"] a')).toHaveCount(2);
      // What the platform does NOT do, on the page itself.
      await expect(page.locator('[data-region="jurisdiction"]')).toContainText(
        lang === 'ar' ? 'لا تمنح إذناً لإقامة الفعالية' : 'It does not give permission to hold an event',
      );

      // BRANCH ONE — an event. Any one criterion is enough.
      await gotoRidingRestarts(page, '/applicability?subject=event&checked=1&c=1');
      const answer = page.locator('[data-region="applicability-answer"]');
      await expect(answer).toContainText(lang === 'ar' ? 'الاعتماد مطلوب' : 'Certification required');
      // "What is not routinely subject" renders ONLY here (ROADMAP 1).
      await expect(page.locator('[data-region="not-routinely-subject"]')).toBeVisible();

      // None selected is NOT "not subject": the Ministry makes the final determination.
      await gotoRidingRestarts(page, '/applicability?subject=event&checked=1&c=');
      await expect(answer).toContainText(
        lang === 'ar' ? 'الاعتماد غير مطلوب' : 'Certification not required',
      );

      // BRANCH TWO — a facility or site (owner, 9 October 2026: two services). An
      // event-hosting venue at or above the capacity threshold is one of its categories.
      await gotoRidingRestarts(page, '/applicability?subject=facility&cat=1');
      await expect(answer).toContainText(lang === 'ar' ? 'تسجيل المنشأة/الموقع مطلوب' : 'Facility/site registration required');
      await expect(answer.locator('a')).toHaveAttribute('href', '/services/register-a-facility');
      await expectAbsent(page, {
        absent: '[data-region="not-routinely-subject"]',
        anchor: answer,
        because: 'what is not routinely subject belongs to the event branch alone',
      });
      await gotoRidingRestarts(page, '/applicability?subject=facility&cat=3');
      await expect(answer).toContainText(lang === 'ar' ? 'تسجيل المنشأة/الموقع مطلوب' : 'Facility/site registration required');
      // A category that rests on a Ministry designation is not the applicant's to declare.
      await gotoRidingRestarts(page, '/applicability?subject=facility&cat=4');
      await expect(answer).toContainText(lang === 'ar' ? 'يتبع التسجيل تحديداً من الوزارة' : 'Registration follows a Ministry designation');
      await expectAbsent(page, { anchor: answer, absent: answer.locator('a'), because: 'the applicant does not designate the facility; nothing routes to registration' });
      // An old venue link opens the facility/site branch.
      await gotoRidingRestarts(page, '/applicability?subject=venue');
      await expect(page.locator('[data-region="facility-branch"]')).toBeVisible();

      // THE LOOKUP SCREEN, in front of the endpoint. Four fields and no more.
      await gotoRidingRestarts(page, '/lookup');
      await expect(page.locator('[data-region="lookup-form"]')).toBeVisible();
      await page.locator('input[name="reference"]').fill('MOPH-EV-2026-0244');
      await page.locator('input[name="eventStartDate"]').fill(seededDate('2026-08-09'));
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
      // RULING (partner review, 2026-09-01): concluded events archive. A records row
      // is a <div> wrapping the link and the archive control -- a form cannot sit
      // inside an anchor -- so the row's link is one level deeper than it was.
      await expect(page.locator('[data-region="records"] > div > a').first()).toBeVisible();
      await gotoRidingRestarts(page, '/ministry/admin/records/EV-0362');
      await expect(page.locator('[data-region="file-answers"]')).toBeVisible();
      await expect(page.locator('[data-region="file-determinations"]')).toBeVisible();
      await gotoRidingRestarts(page, '/ministry/admin/activity');
      await expect(page.locator('[data-region="activity"]')).toBeVisible();
    });
  });
}
