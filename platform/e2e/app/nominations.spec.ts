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
import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`form:has(input[value="${login}"]) button`).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/signin') || url.search.includes('notice='));
}

test.describe('the nomination loop', () => {
  // One serial flow on EV-0418 -- the seeded trap state: two confirmed providers and
  // one unanswered nomination (Coastal Medical Transport).
  test('withdraw frees the gate; remove states the material change first', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_organizer');

    // THE TRAP, asserted: the unanswered nomination blocks filing by name.
    await page.goto('/events/EV-0418/submit');
    await expect(page.locator('body')).toContainText(
      'Coastal Medical Transport — a nomination is not a confirmation',
    );

    // WITHDRAW it. The reason-free path: nothing was confirmed, nothing is owed.
    await page.goto('/events/EV-0418/requirements');
    const row = page.locator('[data-region="g2"] > div > div', { hasText: 'Coastal Medical Transport' });
    await expect(row).toContainText('Withdraw the nomination');
    await expect(row).toContainText('no change report is owed');
    await row.locator('button:has-text("Withdraw the nomination")').click();
    await page.waitForURL('**/requirements?notice=withdrawn');
    await expect(
      page.locator('[data-region="g2"] > div > div', { hasText: 'Coastal Medical Transport' }),
    ).toContainText('Withdrawn');

    // The gate derives from who remains: the blocker is GONE.
    await page.goto('/events/EV-0418/submit');
    await expect(page.locator('body')).not.toContainText(
      'Coastal Medical Transport — a nomination is not a confirmation',
    );

    // The token is dead: the nominee's page shows withdrawn and offers no response.
    await page.goto('/invitations/demo-coastal-medical-0418');
    await expect(page.locator('body')).toContainText('withdrawn by the organizer');
    await expect(page.locator('button:has-text("Accept")')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // REMOVE a confirmed provider. The weight is stated BEFORE the confirming click.
    await page.goto('/events/EV-0418/requirements');
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
    await page.goto('/events/EV-0418/submit');
    await expect(page.locator('body')).not.toContainText('a nomination is not a confirmation');

    // And a replacement can be nominated without touching who remains.
    await page.goto('/events/EV-0418/requirements');
    await expect(page.locator('[data-region="invite"] form')).toHaveCount(1);
  });
});

test.describe('cancellation and postponement', () => {
  // A fresh draft, created and then cancelled -- the seeded events stay untouched.
  test('an event cancels with the consequence stated, and the Ministry reads it', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_organizer');
    await page.goto('/events/new');
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
    await page.goto(`/events/${eventId}/lifecycle`);
    await page.locator('form:has(button:has-text("Postpone the event")) textarea[name="reason"]').fill('Venue works overrun.');
    await page.locator('button:has-text("Postpone the event")').click();
    await page.waitForURL(`**/events/${eventId}?notice=postponed`);
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('no new date recorded yet');
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('does not carry to a new date');

    // Then cancel, with a reason. The record closes; filing is blocked by name.
    await page.goto(`/events/${eventId}/lifecycle`);
    await page.locator('form:has(button:has-text("Cancel the event")) textarea[name="reason"]').fill('The event will not be held.');
    await page.locator('button:has-text("Cancel the event — this closes the record")').click();
    await page.waitForURL(`**/events/${eventId}?notice=cancelled`);
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('cancelled');
    await expect(page.locator('[data-region="lifecycle-band"]')).toContainText('nothing further can be filed');
    await page.goto(`/events/${eventId}/submit`);
    await expect(page.locator('body')).toContainText('Event cancelled — nothing further can be filed on this record');

    // The Ministry's changes lane reads it, reason verbatim, without a second filing.
    await signInAs(page, 'test_moph');
    await page.goto('/ministry/changes');
    const lane = page.locator('[data-region="changes"]');
    await expect(lane).toContainText('Harbour Cleanup Morning');
    await expect(lane).toContainText('Cancelled');
    await expect(lane).toContainText('The event will not be held.');
  });
});
