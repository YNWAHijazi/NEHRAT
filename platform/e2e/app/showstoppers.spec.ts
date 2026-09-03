/**
 * The Pass A showstoppers, walked end to end. Each of these flows was impossible or
 * silently wrong while the suite was green -- they are here so it can never be green
 * that way again.
 *
 *  1. A Level 1 event FILES: the declaration gate counts what the form renders.
 *  3. A serious incident is notifiable mid-event on its own route, and the Ministry
 *     reads it in the incidents lane.
 *  4. A revision outcome reopens the submission and a revised version files, with the
 *     reference unchanged and the version visible to the reviewer.
 *  6. Saving the plan archives the version it replaced, readable on the screen.
 */
import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';


const fill = async (page: Page, label: string, value: string): Promise<void> => {
  await page.locator('label', { hasText: label }).first().locator('input').fill(value);
};

test.describe('showstopper 1 — a Level 1 event files end to end', () => {
  test('create, assess to Level 1, attach, declare six, file, receive the reference', async ({ page }) => {
    test.setTimeout(90_000);
    await signInAs(page, 'test_organizer');

    // The assessment: everything low-risk, nothing triggering a minimum condition.
    await gotoRidingRestarts(page, '/events/new');
    await fill(page, 'Event name (English)', 'Community Chess Afternoon');
    await fill(page, 'Event name (Arabic)', 'أمسية شطرنج مجتمعية');
    await fill(page, 'Start date', '2026-09-10');
    await fill(page, 'End date', '2026-09-10');
    await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
    await fill(page, 'Venue, route, or location', 'Municipal hall, Jounieh');
    await fill(page, 'Municipality or municipalities', 'Jounieh');
    await fill(page, 'Opening time', '14:00');
    await fill(page, 'Closing time', '18:00');
    await fill(page, 'Expected participants', '80');
    await fill(page, 'Expected spectators', '40');
    await fill(page, 'Expected staff and volunteers', '10');
    // The event-type dropdown answered the venue question above.
    // Every domain at score 0: the option button whose marker span reads exactly "0".
    const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
    const count = await zeros.count();
    expect(count).toBeGreaterThanOrEqual(9);
    for (let i = 0; i < count; i += 1) {
      await zeros.nth(i).click();
    }
    // Annex A Part F: the declaration's fields are required to save.
    await fill(page, 'Authorized representative', 'R. Haddad');
    await fill(page, 'Position', 'Events director');
    await page.locator('button:has-text("Save the assessment and open the event record")').click();
    await page.waitForURL(/\/events\/EV-\d+/);
    const eventUrl = new URL(page.url());
    const eventId = eventUrl.pathname.split('/')[2]!;
    await expect(page.locator('body')).toContainText('Level 1');

    // Level 1 package: the assessment (system) and the documented arrangements.
    await gotoRidingRestarts(page, `/events/${eventId}/requirements`);
    const attach = page.locator('form:has(input[name="docKey"])').first();
    // The control is a real file picker: a document is chosen, never a typed name.
    await attach.locator('input[type="file"]').setInputFiles({
      name: 'arrangements.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('review-build placeholder'),
    });
    await attach.locator('button:has-text("Attach")').click();
    await page.waitForLoadState('networkidle');

    // The compliance form renders SIX declarations at Level 1 -- and completes on six.
    await gotoRidingRestarts(page, `/events/${eventId}/submit`);
    const ticks = page.locator('label:has(input[type="checkbox"])').filter({ hasText: 'Not declared' });
    await expect(ticks).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      // The list re-renders on every tick; always take the first remaining.
      await page.locator('label:has(input[type="checkbox"])').filter({ hasText: 'Not declared' }).first().locator('input').check();
    }
    // THE CERTIFICATION. This walk used to tick six boxes and file, and it PASSED --
    // which is how a submission could be filed with no authorized representative
    // named. Ticking the declarations is not making the certification.
    await fill(page, 'Authorized representative', 'R. Haddad');
    await fill(page, 'Telephone', '+961 1 000 000');
    await fill(page, 'Position', 'Events director');

    // Blockers are server-derived: save, let the refresh recompute, then file.
    await page.locator('button:has-text("Save the form")').click();
    await expect(page.locator('text=Saved.')).toBeVisible();
    const fileBtn = page.locator('button:has-text("File the submission")');
    // 30s: measured too tight at 15 on the full run once the console grew.
    await expect(fileBtn).toBeEnabled({ timeout: 30_000 });
    await fileBtn.click();
    await page.waitForURL(/acknowledgment/);
    await expect(page.locator('body')).toContainText(/MOPH-EV-\d{4}-\d{4}/);
  });
});

test.describe('showstopper 4 — a revision outcome reopens the submission', () => {
  test('EV-0362 refiles as a new version; the reviewer sees it; the reference holds', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // THE VERSION IS READ BEFORE AND COMPARED, not asserted as the number 2.
    // Refiling is a MUTATION and this test used to assert an absolute version, so its
    // own retry failed: the first attempt refiled to 2, timed out on a navigation,
    // and the retry refiled to 3 and then failed the assertion. That reads as a
    // product defect and is a test that cannot survive being run twice. What the
    // showstopper is about is that refiling ARCHIVES the version it replaces and the
    // reference number does not change -- neither of which is a fact about the
    // number 2.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const beforeText = await page.locator('[data-region="review-header"]').innerText();
    const before = Number(/version (\d+)/.exec(beforeText)?.[1] ?? '1');

    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362/submit');
    // The revision banner, and the form unlocked despite being filed.
    await expect(page.locator('body')).toContainText('open for revision');
    const refile = page.locator('button:has-text("File the revised submission")');
    await expect(refile).toBeVisible();
    await refile.click();
    await page.waitForURL(/acknowledgment/);
    await expect(page.locator('body')).toContainText('MOPH-EV-2026-0362');

    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    await expect(page.locator('[data-region="review-header"]')).toContainText(
      `revised submission, version ${before + 1}`,
    );
    // The version it replaced is archived and readable, which is the showstopper.
    await expect(page.locator('[data-region="review-versions"]')).toContainText(
      `Version ${before} — superseded`,
    );
  });
});

test.describe('showstopper 3 — the 24-hour notification lives on its own route', () => {
  test('notifiable on a started event, and the Ministry incidents lane reads it', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // EV-0244 is held 2026-08-09 and ended before the review clock (2026-08-13):
    // started, filed, notifiable. The occurrence is on the event's own day.
    await gotoRidingRestarts(page, '/events/EV-0244/incident');
    await page.locator('label:has-text("Major incident") input[type="radio"]').check();
    await page.locator('input[name="occurredAt"]').fill('2026-08-09T21:30');
    await page.locator('button:has-text("Notify the Ministry")').click();
    await page.waitForURL(/notice=notified/);
    await expect(page.locator('body')).toContainText('The Ministry has been notified');

    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/incidents');
    const lane = page.locator('[data-region="serious-incidents"]');
    await expect(lane).toContainText('Major incident');
    await expect(lane).toContainText('hour');
  });

  test('before the event starts, the control is a reason, not a form', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // EV-0362 starts after the review clock's today.
    await gotoRidingRestarts(page, '/events/EV-0362/incident');
    await expectAbsent(page, {
      absent: 'button:has-text("Notify the Ministry")',
      anchor: /Available from the event's first day/,
      because: 'before the event starts the control is a reason, not a form',
    });
  });
});

test.describe('showstopper 6 — plan versions survive saving', () => {
  test('a second save archives version 1, readable under Earlier versions', async ({ page }) => {
    // Two save-and-reload cycles: generous under full-suite dev-compile load.
    test.setTimeout(90_000);
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418/plan');
    // Sections are accordion rows: expand section 1, whose textarea then renders.
    const sectionRow = page.locator('button[aria-expanded]', { hasText: 'Event description and schedule' });
    await sectionRow.click();
    const firstSection = page.locator('textarea').first();
    await expect(firstSection).toBeVisible();
    await firstSection.fill('Version one wording for the schedule.');
    await page.locator('button:has-text("Save the plan")').first().click();
    // The versions section appears only AFTER a second save; wait on the save itself.
    await expect(page.locator('text=A new version was recorded')).toBeVisible({ timeout: 20_000 });
    // The accordion may close on refresh; re-open before the second edit.
    await page.reload();
    await page.locator('button[aria-expanded]', { hasText: 'Event description and schedule' }).click();
    await page.locator('textarea').first().fill('Version two wording, replacing version one.');
    await page.locator('button:has-text("Save the plan")').first().click();
    // Wait for the SECOND save to land before reloading -- networkidle raced it, and a
    // reload mid-save read the page back before version 1 had been archived.
    await expect(page.locator('text=A new version was recorded')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    const history = page.locator('details', { hasText: 'Version 1' }).first();
    await expect(history).toBeVisible();
    await history.locator('summary').click();
    await expect(history).toContainText('Version one wording for the schedule.');
  });
});
