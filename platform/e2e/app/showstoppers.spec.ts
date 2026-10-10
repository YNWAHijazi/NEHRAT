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
 *  6. Saving a plan section archives the version it replaced in the answer history.
 */
import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';
import { answerLevel1Rows, certify, openDetails, openAllRequirements } from '../helpers/record';
import { DatabaseSync } from 'node:sqlite';


const fill = async (page: Page, label: string, value: string): Promise<void> => {
  await page.locator('label', { hasText: label }).first().locator('input').fill(value);
};

test.describe('showstopper 1 — a Level 1 event files end to end', () => {
  test('create, assess to Level 1, answer the rows, certify, file, receive the reference', async ({ page }) => {
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
    // One attendance figure, asked in question 1 (owner, 10 October 2026).
    await fill(page, 'Most people at the same time', '130');
    // The event-type dropdown answered the venue question above.
    // Every domain at score 0: the option button whose marker span reads exactly "0".
    const zeros = page.locator('button[aria-pressed]:not([disabled]):has(span:text-is("0"))');
    const count = await zeros.count();
    expect(count).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < count; i += 1) {
      await zeros.nth(i).click();
    }
    // Annex A Part F: the declaration's fields are required to save.
    await fill(page, 'Authorized representative', 'R. Haddad');
    await fill(page, 'Position', 'Events director');
    await page.locator('button:has-text("Continue to requirements")').click();
    await page.waitForURL(/\/events\/EV-\d+/);
    const eventUrl = new URL(page.url());
    const eventId = eventUrl.pathname.split('/')[2]!;
    await expect(page.locator('body')).toContainText('Level 1');

    // Revised Annex B: Level 1 has no medical plan and no map upload -- the record page
    // carries neither card (catalogue B2 and P-M at Level 1).
    await openAllRequirements(page);
    await expect(page.locator('[data-region="requirement-summaries"]')).toBeVisible();
    await expect(page.locator('[data-requirement="B2"], [data-requirement="P-M"]')).toHaveCount(0);

    // The organizer's own rows, one card at a time; the summary counts them.
    await answerLevel1Rows(page);
    // The declaration is counted with the rows (live review, 10 October 2026): it is what remains.
    await expect(page.locator('[data-region="required-count"]')).toContainText('9 of 10');
    // THE CERTIFICATION. This walk used to tick six boxes and file, and it PASSED --
    // which is how a submission could be filed with no authorized representative
    // named. Answering the rows is not making the certification; Level 1 asks the
    // certification alone (catalogue P-C: the statements apply when the Ministry
    // requests them), and the Submit button is server-gated on it.
    await expect(page.locator('[data-region="compliance-statements"]')).toHaveCount(0);
    const fileBtn = await certify(page, { representative: 'R. Haddad', telephone: '+961 1 000 000', position: 'Events director' });
    await fileBtn.click();
    await page.waitForURL(/acknowledgment/);
    // One identifier (owner ruling, 2026-09-29): the receipt carries the record ID the event was
    // created with; no separate MOPH-EV reference is issued for a new filing.
    const recordId = /EV-\d{4}/.exec(new URL(page.url()).pathname)?.[0];
    expect(recordId, 'the receipt names no record ID').toBeTruthy();
    await expect(page.locator('body')).toContainText(recordId!);
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
    await gotoRidingRestarts(page, '/events/EV-0362');
    // The revision banner, and the record unlocked despite being filed: the one Submit
    // at the foot of the page re-files, and says so.
    await expect(page.locator('body')).toContainText('open for revision');
    const refile = page.locator('[data-region="submit-button"]');
    await expect(refile).toHaveText(/Submit the revised record/);
    await expect(refile).toBeEnabled();
    await refile.click();
    await page.waitForURL(/acknowledgment/);
    // One identifier (owner ruling, 2026-09-29): the record ID is what holds across versions.
    await expect(page.locator('body')).toContainText('EV-0362');

    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    await expect(page.locator('[data-region="review-header"]')).toContainText(
      `revised submission, version ${before + 1}`,
    );
    // The reviewer reads the requirement record frozen at this filing, not the live answers.
    const frozen = page.locator('#review-requirements');
    await expect(frozen).toContainText(`Frozen at filing · version ${before + 1}`);
    await expect(frozen.locator('[data-review-requirement="B2"]')).toHaveAttribute('data-state', 'complete');
    // The version it replaced is archived and readable, which is the showstopper.
    await expect(page.locator('[data-region="review-versions"]')).toContainText(
      `Version ${before} — superseded`,
    );
  });
});

test.describe('showstopper 3 — the 24-hour notification lives on its own route', () => {
  test('a late notification is accepted and marked late (owner decision D6, 10 October 2026)', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // A concluded event still takes a notice: the 24 hours run from the occurrence, and a
    // deadline does not authorize refusing a late report. The September 26 lock is withdrawn.
    await gotoRidingRestarts(page, '/events/EV-0244/incident');
    await expect(page.locator('body')).not.toContainText('Closed — more than 24 hours have passed');
    await expect(page.locator('body')).toContainText('a late notice is accepted and marked late');
    const start = /\d{4}-\d{2}-\d{2}/.exec((await page.locator('main').innerText()))![0];
    await page.locator('input[name="incidentType"][value="major"]').check();
    await page.locator('input[name="occurredAt"]').fill(`${start}T10:00`);
    await page.getByRole('button', { name: 'Notify the Ministry', exact: true }).click();
    await page.waitForURL(/notice=notified/);
    await expect(page.locator('[data-incident-late]').first()).toContainText('Late — notified');
  });

  test('before the event starts, the control is a reason, not a form', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    // EV-0362 starts after the review clock's today.
    await gotoRidingRestarts(page, '/events/EV-0362/incident');
    await expectAbsent(page, {
      absent: 'button:has-text("Notify the Ministry")',
      anchor: /Available from \d{4}-\d{2}-\d{2}/,
      because: 'before the event starts the control is a reason, not a form',
    });
  });
});

test.describe('showstopper 6 — plan versions survive saving', () => {
  test('a second save of a plan section keeps the first wording in the answer history', async ({ page }) => {
    // Two save-and-reload cycles: generous under full-suite dev-compile load.
    test.setTimeout(90_000);
    await signInAs(page, 'test_ems');
    await gotoRidingRestarts(page, '/events/EV-0418/participation');
    // The plan is sections on the record; section 14 carries its own text (catalogue P14).
    const section = async () => {
      await openDetails(page.locator('[data-requirement="B2"]'));
      return (await openDetails(page.locator('#plan-P14'))).locator('[data-region="requirement-form"]').first();
    };
    let form = await section();
    const textarea = form.locator('textarea[name="text"]');
    await expect(textarea).toBeVisible();
    const original = await textarea.inputValue();
    await textarea.fill('Version one wording for the contingency.');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Saved.');
    const first = Number(/version (\d+)/.exec((await form.locator('[data-region="answered-by"]').innerText()))?.[1] ?? '0');
    expect(first).toBeGreaterThan(0);
    // The card may close on refresh; re-open before the second edit.
    await page.reload();
    form = await section();
    await form.locator('textarea[name="text"]').fill('Version two wording, replacing version one.');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Saved.');
    await expect(form.locator('[data-region="answered-by"]')).toContainText(`version ${first + 1}`);
    // The version it replaced is archived, not overwritten -- which is the showstopper.
    const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
    try {
      const archived = db.prepare("SELECT answers FROM requirement_answer_history WHERE record_kind = 'event' AND record_id = 'EV-0418' AND key = 'P14' AND version = ?").get(first) as { answers: string } | undefined;
      expect(archived?.answers).toContain('Version one wording for the contingency.');
    } finally { db.close(); }
    // Leave the demonstration record's own wording for the journeys that read it.
    if (original) {
      form = await section();
      await form.locator('textarea[name="text"]').fill(original);
      await form.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(form.getByRole('status')).toContainText('Saved.');
    }
  });
});
