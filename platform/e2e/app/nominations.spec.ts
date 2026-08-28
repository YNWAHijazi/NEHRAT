/**
 * The nomination loop, closed. The trap this pins: one confirmed provider and one
 * unanswered nomination BLOCKED filing with nothing the organizer could do -- a
 * nomination, once sent, could never be stopped. Now:
 *
 *  - an unanswered nomination WITHDRAWS: the token dies, the nominee's page shows
 *    withdrawn, no material change arises, and filing derives from who remains;
 *  - a confirmed provider REMOVES: stated as a material change BEFORE the click,
 *    the party is notified, and a filed submission owes a change report.
 */
import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';


test.describe('the nomination loop', () => {
  // One serial flow on EV-0418 -- the seeded trap state: two confirmed providers and
  // one unanswered nomination (Coastal Medical Transport).
  test('withdraw frees the gate; remove states the material change first', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_organizer');

    // THE TRAP, asserted: the unanswered nomination blocks filing by name.
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    await expect(page.locator('body')).toContainText(
      'Coastal Medical Transport — a nomination is not a confirmation',
    );

    // WITHDRAW it. The reason-free path: nothing was confirmed, nothing is owed.
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    const row = page.locator('[data-region="g2"] > div > div', { hasText: 'Coastal Medical Transport' });
    await expect(row).toContainText('Withdraw the nomination');
    await expect(row).toContainText('no change report is owed');
    await row.locator('button:has-text("Withdraw the nomination")').click();
    await page.waitForURL('**/requirements?notice=withdrawn');
    await expect(
      page.locator('[data-region="g2"] > div > div', { hasText: 'Coastal Medical Transport' }),
    ).toContainText('Withdrawn');

    // The gate derives from who remains: the blocker is GONE.
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    await expect(page.locator('body')).not.toContainText(
      'Coastal Medical Transport — a nomination is not a confirmation',
    );

    // The token is dead: the nominee's page shows withdrawn and offers no response.
    await gotoRidingRestarts(page, '/invitations/demo-coastal-medical-0418');
    await expect(page.locator('body')).toContainText('withdrawn by the organizer');
    await expect(page.locator('button:has-text("Accept")')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // REMOVE a confirmed provider. The weight is stated BEFORE the confirming click.
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    const confirmed = page.locator('[data-region="g2"] > div > div', { hasText: 'Civil Defence — Beirut' });
    await confirmed.locator('summary', { hasText: 'Remove this provider' }).click();
    await expect(confirmed).toContainText('Removing a confirmed party is a material change');
    // EV-0418 is not filed, and the wording says exactly that.
    await expect(confirmed).toContainText('Nothing is filed yet, so no change report is owed');
    await confirmed.locator('button:has-text("Remove — a material change")').click();
    await page.waitForURL('**/requirements?notice=removed');
    await expect(
      page.locator('[data-region="g2"] > div > div', { hasText: 'Civil Defence — Beirut' }),
    ).toContainText('Removed');

    // One confirmed provider remains; the provider gate stays satisfied on it alone.
    await gotoRidingRestarts(page, '/events/EV-0418/submit');
    await expect(page.locator('body')).not.toContainText('a nomination is not a confirmation');

    // And a replacement can be nominated without touching who remains.
    await gotoRidingRestarts(page, '/events/EV-0418/requirements');
    await expect(page.locator('[data-region="invite"] form')).toHaveCount(1);
  });
});

test.describe('cancellation and postponement', () => {
  // A fresh draft, created and then cancelled -- the seeded events stay untouched.
  test('an event cancels with the consequence stated, and the Ministry reads it', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/new');
    const fill = async (label: string, value: string) => {
      await page.locator('label', { hasText: label }).first().locator('input').fill(value);
    };
    await fill('Event name (English)', 'Harbour Cleanup Morning');
    await fill('Event name (Arabic)', 'صباح تنظيف المرفأ');
    await fill('Start date', '2026-11-03');
    await fill('End date', '2026-11-03');
    await fill('Event type', 'Community volunteer gathering');
    await fill('Venue, route, or location', 'Jounieh old harbour');
    await fill('Municipality or municipalities', 'Jounieh');
    await fill('Opening time', '08:00');
    await fill('Closing time', '12:00');
    await fill('Expected participants', '60');
    await fill('Expected spectators or attendees', '20');
    await fill('Expected staff, performers, contractors, and volunteers', '8');
    await fill('Expected maximum simultaneous attendance', '80');
    const noPills = page.locator('button[data-yesno="no"]');
    await noPills.nth(0).click();
    await noPills.nth(1).click();
    const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
    const count = await zeros.count();
    for (let i = 0; i < count; i += 1) await zeros.nth(i).click();
    await page.locator('button:has-text("Save the assessment and open the event record")').click();
    await page.waitForURL(/\/events\/EV-\d+$/);
    const eventId = new URL(page.url()).pathname.split('/')[2]!;

    // Postpone first -- no new date; the band says the determination cannot carry.
    await gotoRidingRestarts(page, `/events/${eventId}/lifecycle`);
    await page.locator('form:has(button:has-text("Postpone the event")) textarea[name="reason"]').fill('Venue works overrun.');
    await page.locator('button:has-text("Postpone the event")').click();
    await page.waitForURL(`**/events/${eventId}?notice=postponed`);
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('no new date recorded yet');
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('does not carry to a new date');

    // Then cancel, with a reason. The record closes; filing is blocked by name.
    await gotoRidingRestarts(page, `/events/${eventId}/lifecycle`);
    await page.locator('form:has(button:has-text("Cancel the event")) textarea[name="reason"]').fill('The event will not be held.');
    await page.locator('button:has-text("Cancel the event — this closes the record")').click();
    await page.waitForURL(`**/events/${eventId}?notice=cancelled`);
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('cancelled');
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('nothing further can be filed');
    await gotoRidingRestarts(page, `/events/${eventId}/submit`);
    await expect(page.locator('body')).toContainText('Event cancelled — nothing further can be filed on this record');

    // The Ministry's changes lane reads it, reason verbatim, without a second filing.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/changes');
    const lane = page.locator('[data-region="changes"]');
    await expect(lane).toContainText('Harbour Cleanup Morning');
    await expect(lane).toContainText('Cancelled');
    await expect(lane).toContainText('The event will not be held.');
  });
});

test.describe('creation to determination, end to end', () => {
  // THE PLAIN-ANSWER PROOF: an organizer takes an event from nothing to filed, and
  // the Ministry records every outcome the regulation gives it, all through the
  // screens -- on a fresh record, so nothing seeded is disturbed.
  test('an event is created, filed, and carries all three outcomes in turn', async ({ page }) => {
    test.setTimeout(180_000);
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/new');
    const fill = async (label: string, value: string) => {
      await page.locator('label', { hasText: label }).first().locator('input').fill(value);
    };
    await fill('Event name (English)', 'Batroun Heritage Walk');
    await fill('Event name (Arabic)', 'مسيرة تراث البترون');
    await fill('Start date', '2026-11-21');
    await fill('End date', '2026-11-21');
    await fill('Event type', 'Guided community walk');
    await fill('Venue, route, or location', 'Batroun old town');
    await fill('Municipality or municipalities', 'Batroun');
    await fill('Opening time', '09:00');
    await fill('Closing time', '13:00');
    await fill('Expected participants', '90');
    await fill('Expected spectators or attendees', '30');
    await fill('Expected staff, performers, contractors, and volunteers', '10');
    await fill('Expected maximum simultaneous attendance', '130');
    const noPills = page.locator('button[data-yesno="no"]');
    await noPills.nth(0).click();
    await noPills.nth(1).click();
    const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
    const count = await zeros.count();
    for (let i = 0; i < count; i += 1) await zeros.nth(i).click();
    await page.locator('button:has-text("Save the assessment and open the event record")').click();
    await page.waitForURL(/\/events\/EV-\d+$/);
    const eventId = new URL(page.url()).pathname.split('/')[2]!;

    // Level 1 package: attach the arrangements, declare six, file.
    await gotoRidingRestarts(page, `/events/${eventId}/requirements`);
    const attach = page.locator('form:has(input[name="docKey"])').first();
    await attach.locator('input[type="file"]').setInputFiles({
      name: 'arrangements.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x'),
    });
    await attach.locator('button:has-text("Attach")').click();
    await page.waitForLoadState('networkidle');
    await gotoRidingRestarts(page, `/events/${eventId}/submit`);
    for (let i = 0; i < 6; i += 1) {
      await page.locator('label:has(input[type="checkbox"])').filter({ hasText: 'Not declared' }).first().locator('input').check();
    }
    await page.locator('button:has-text("Save the form")').click();
    await expect(page.locator('text=Saved.')).toBeVisible();
    const fileBtn = page.locator('button:has-text("File the submission")');
    await expect(fileBtn).toBeEnabled({ timeout: 30_000 });
    await fileBtn.click();
    await page.waitForURL(/acknowledgment/);
    await expect(page.locator('body')).toContainText(/MOPH-EV-\d{4}-\d{4}/);

    // The Ministry records each of the three outcomes in turn, through the screen.
    await signInAs(page, 'test_moph');
    const review = `/ministry/submissions/${eventId}`;
    const record = async (value: string, expected: string) => {
      await gotoRidingRestarts(page, review);
      const outcome = page.locator('[data-region="outcome"]');
      await outcome.locator(`input[type="radio"][value="${value}"]`).check();
      await outcome.locator('textarea, input[name="note"]').first().fill(`Recorded in the completion walk — ${value}.`);
      await outcome.locator('button:has-text("Record the outcome")').click();
      await page.waitForURL(`**${review}**`);
      await expect(page.locator('[data-region="determinations"]')).toContainText(expected);
    };
    await record('incomplete', 'Submission received but incomplete');
    await record('revision', 'Additional information or revision required');
    // A Level 1 submission: no attestations apply, no inspection blocks -- the
    // satisfied outcome is open, and recording it completes the chain.
    await record('satisfied', 'Health and medical preparedness requirements satisfied');

    // And the organizer reads the determination on their own record.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/dashboard');
    await expect(page.locator('body')).toContainText('Batroun Heritage Walk');
    await gotoRidingRestarts(page, `/events/${eventId}`);
    await expect(page.locator('body')).toContainText('Health and medical preparedness requirements satisfied');
  });
});
