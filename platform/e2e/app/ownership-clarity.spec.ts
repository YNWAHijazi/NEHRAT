import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';
import { card, cardForm, openDetails, showStep, stateChip } from '../helpers/record';

/**
 * Owner feedback, 8 October 2026: Next saves what was typed; Save as draft keeps the record
 * and returns to the dashboard; another party's rows read as text or an italic "awaiting"
 * line, never as empty boxes; every card says who fills it; the Level 3 major-incident items
 * are answered on the requirement itself; inviting the EMS agency at Level 3 opens a dialog
 * naming the steps it fills, with a way on to the organizer's own steps.
 */

async function fillLabelled(page: Page, en: string, value: string): Promise<void> {
  await page.locator('label', { hasText: en }).first().locator('input, textarea').first().fill(value);
}

async function createLevel1(page: Page): Promise<string> {
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  await fillLabelled(page, 'Event name (English)', `Autosave ${stamp}`);
  await fillLabelled(page, 'Event name (Arabic)', `حفظ ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-11-20');
  await fillLabelled(page, 'End date', '2026-11-20');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await fillLabelled(page, 'Venue, route, or location', 'Municipal park, Zahle');
  await fillLabelled(page, 'Municipality or municipalities', 'Zahle');
  await fillLabelled(page, 'Expected participants', '60');
  await fillLabelled(page, 'Expected spectators', '30');
  await fillLabelled(page, 'Expected staff and volunteers', '8');
  const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
  for (let i = 0, n = await zeros.count(); i < n; i += 1) await zeros.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'R. Haddad');
  await fillLabelled(page, 'Position', 'Events director');
  await page.locator('button:has-text("Continue to requirements")').first().click();
  await page.waitForURL(/\/events\/EV-\d+/);
  return new URL(page.url()).pathname.split('/')[2]!;
}

test('Next saves the step that was typed on; Save as draft keeps the record and says nothing was sent', async ({ page }) => {
  test.setTimeout(240_000);
  await signInAs(page, 'test_organizer');
  const id = await createLevel1(page);
  await openDetails(card(page, 'B4'));
  await cardForm(page, 'B4').locator('[name="available"]').check();
  // No Save press: Next carries the answer.
  await page.locator('[data-region="step-next"]').click();
  await expect(card(page, 'B4')).toBeHidden();
  await gotoRidingRestarts(page, `/events/${id}`);
  await expect(stateChip(page, 'B4')).toHaveAttribute('data-state', 'complete');
  // Every card says who fills it.
  await openDetails(card(page, 'B9'));
  await expect(card(page, 'B9').locator('[data-region="card-owner"]')).toContainText('You fill this step');
  // Save as draft from the final review.
  await showStep(page, '#final-review');
  await page.locator('[data-region="save-draft"]').click();
  await page.waitForURL(/\/dashboard\?notice=draft-saved/);
  await expect(page.locator('[data-region="draft-saved-notice"]')).toContainText('Nothing is sent to the Ministry until you submit');
});

test('Level 3: other parties’ rows read as text, the major-incident items sit on the requirement, and inviting an agency names its steps', async ({ page }) => {
  test.setTimeout(240_000);
  const db = () => new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  const name = `Handoff agency ${Date.now()}`;
  try {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362');
    await expect(page.locator('[data-region="record-guide"]')).toContainText('Three parties fill in this record: you, the EMS agency and the Medical Director. Amber steps are yours.');
    // A row the EMS agency or the Director fills: no empty boxes, the owner said plainly.
    const cpr = await openDetails(card(page, 'B8'));
    await expect(cpr.locator('[data-region="card-owner"]')).toContainText('Filled by the EMS agency or the Medical Director');
    await expect(cpr.locator('[data-region="requirement-form"]')).toHaveAttribute('data-readonly', '');
    await expect(cpr.locator('[data-region="requirement-form"] input, [data-region="requirement-form"] textarea')).toHaveCount(0);
    // The eleven major-incident items are on the requirement itself.
    const mi = await openDetails(card(page, 'B16'));
    await expect(mi.locator('[data-major-incident-item]')).toHaveCount(11);
    // Inviting an agency opens the hand-off dialog; "skip" goes on to a step the organizer fills.
    const ems = await openDetails(card(page, 'B7'));
    const invite = ems.locator('form[data-region="invite"]');
    await invite.locator('input[name="name"]').fill(name);
    await invite.locator('input[name="email"]').fill('handoff-agency@example.test');
    await invite.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await invite.locator('button[type="submit"]').click();
    await page.waitForURL(/invited=ems/);
    const dialog = page.locator('[data-region="handoff-dialog"]');
    await expect(dialog).toBeVisible();
    // The pop-up opens where the organizer was; the page behind it does not jump to the top.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 80);
    await expect(dialog.locator('[data-region="handoff-steps"] li').first()).toBeVisible();
    await expect(dialog).toContainText('Number and type of committed units');
    await dialog.locator('[data-region="handoff-skip"]').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-region="step-body"] [data-step]:visible [data-region="card-owner"]')).toHaveAttribute('data-yours', 'true');
  } finally {
    const d = db();
    // The tables' activity triggers call the app's now_stamp(); a raw connection supplies it.
    d.function('now_stamp', () => new Date().toISOString().slice(0, 19).replace('T', ' '));
    d.prepare('DELETE FROM invitations WHERE name_en = ?').run(name);
    d.close();
  }
});

test('Level 3, before any agency is invited: the EMS step is the organizer\'s (amber, "invite first"); once invited it is the agency\'s (grey)', async ({ page }) => {
  test.setTimeout(240_000);
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  await fillLabelled(page, 'Event name (English)', `Invite first ${stamp}`);
  await fillLabelled(page, 'Event name (Arabic)', `الدعوة أولاً ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-12-12');
  await fillLabelled(page, 'End date', '2026-12-12');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await fillLabelled(page, 'Venue, route, or location', 'Waterfront, Beirut');
  await fillLabelled(page, 'Municipality or municipalities', 'Beirut');
  await fillLabelled(page, 'Expected participants', '600');
  await fillLabelled(page, 'Expected spectators', '300');
  await fillLabelled(page, 'Expected staff and volunteers', '40');
  const twos = page.locator('button[aria-pressed]:has(span:text-is("2"))');
  for (let i = 0, n = await twos.count(); i < n; i += 1) await twos.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'R. Haddad');
  await fillLabelled(page, 'Position', 'Events director');
  await page.locator('button:has-text("Continue to requirements")').first().click();
  await page.waitForURL(/\/events\/EV-\d+/);
  await expect(page.locator('[data-region="details-assessment"]')).toContainText('Level 3');
  // No agency yet: the invitation is the organizer's to send, so the step is theirs.
  await expect(page.locator('[data-step-item="B7"]')).toHaveAttribute('data-step-yours', 'true');
  const ems = await openDetails(card(page, 'B7'));
  await expect(ems.locator('[data-region="card-owner"]')).toHaveAttribute('data-yours', 'true');
  await expect(ems.locator('[data-region="card-owner"]')).toContainText('You invite the EMS agency first; it then fills this step');
  // The agency's other rows stay grey, labelled with who fills them.
  await expect(page.locator('[data-step-item="B8"]')).not.toHaveAttribute('data-step-yours', 'true');
  const invite = ems.locator('form[data-region="invite"]');
  await invite.locator('input[name="name"]').fill(`Invite-first agency ${stamp}`);
  await invite.locator('input[name="email"]').fill('invite-first@example.test');
  await invite.locator('button[type="submit"]').click();
  await page.waitForURL(/invited=ems/);
  await page.locator('[data-region="handoff-close"]').click();
  // Invited: the step is the agency's now -- grey, with the label.
  await expect(page.locator('[data-step-item="B7"]')).not.toHaveAttribute('data-step-yours', 'true');
  await expect((await openDetails(card(page, 'B7'))).locator('[data-region="card-owner"]')).toContainText('Filled by the EMS agency or the Medical Director');
});
