/**
 * The five defects a person found by clicking, pinned so a person never finds them
 * again.
 *
 * Three of them are the same family the guards have been catching all week -- a field
 * that accepts anything, a form that validates nothing, a power held by nobody
 * reachable. All three were checks that passed without checking, and all three were
 * found by a walkthrough rather than by any test. These are the tests.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

test.describe('1 — evidence of insurance is a file, not a word', () => {
  test('the compliance form offers an upload, and no box to type Yes into', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362/submit');
    const row = page.locator('[data-region="insurance-evidence"]');
    await expect(row).toBeVisible();
    await expect(row.locator('input[type="file"]')).toBeVisible();
    // The defect exactly: a text input the word "yes" satisfied.
    await expectAbsent(page, {
      absent: row.locator('input[type="text"]'),
      anchor: row.locator('input[type="file"]'),
      because: 'a field asking whether evidence is attached, satisfied by typing, evidences nothing',
    });
  });
});

test.describe('2 — a certification with an empty field is not a signature', () => {
  test('every certification field is required, and the date is one of them', async ({ page }) => {
    // THE DEFECT: a declaration signed with an empty Date, released to the organizer
    // and counted toward the Level 3 package. The sign action checked the ten items
    // and never looked at this block.
    //
    // The seeded declaration is already SIGNED, so its inputs are disabled and the
    // refusal cannot be driven here. What IS assertable on any fixture is that every
    // field carries the requirement -- and the refusal itself is pinned in
    // tests/certification.test.ts, on the rule the server calls, which is where the
    // hole actually was.
    await signInAs(page, 'test_ems');
    await gotoRidingRestarts(page, '/events/EV-0362/declaration');
    const block = page.locator('[data-region="certification"]');
    await expect(block).toBeVisible();

    const inputs = block.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) {
      await expect(inputs.nth(i), `certification field ${i} is not required`).toHaveAttribute('required', '');
    }
    // The date specifically, since that is the one that was left blank.
    await expect(block.locator('input[type="date"]')).toHaveAttribute('required', '');
  });
});

test.describe('3 — a power held by nobody reachable', () => {
  test('the reviewer can schedule the inspection that gates their own outcome', async ({ page }) => {
    // The reviewer held a submission whose satisfied outcome was gated by an
    // inspection, was told a reviewer or inspector schedules one, and no account they
    // could reach held the power. The control existed; its named owner did not.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0455');
    await expect(page.locator('[data-region="schedule-inspection"]')).toBeVisible();
    await expect(page.locator('[data-region="schedule-inspection"] select[name="inspector"]')).toBeVisible();
  });
});

test.describe('4 — a determination is recorded once, and revised deliberately', () => {
  test('after recording, what stands is shown and the radios are gone', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    // EV-0362 carries a determination in the seed.
    const standing = page.locator('[data-region="standing-determination"]');
    await expect(standing).toBeVisible();
    await expect(standing).toContainText(/Recorded by/);
    // The whole defect: the three radios stayed live and re-recording overwrote.
    await expectAbsent(page, {
      absent: '[data-region="outcome"]',
      anchor: standing,
      because: 'recording is offered once; changing it is a separate deliberate act',
    });
    await expect(page.locator('[data-region="revise-determination"]')).toBeVisible();
  });

  test('revising requires a reason and keeps the original on the record', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const revise = page.locator('[data-region="revise-determination"]');
    await revise.locator('summary').click();
    await expect(revise.locator('textarea[name="reason"]')).toHaveAttribute('required', '');

    await revise.locator('input[name="outcome"][value="incomplete"]').check();
    await revise.locator('textarea[name="reason"]').fill('The deployment map supplied after the first determination changes the assessment.');
    await revise.locator('button[type="submit"]').click();
    await page.waitForURL(/notice=revised/);

    // BOTH on the record, and which is which.
    const history = page.locator('[data-region="determinations"]');
    await expect(history).toContainText('Stands');
    await expect(history).toContainText('Replaced');
    await expect(history).toContainText('Reason for the revision, as written');
  });
});

test.describe('5 — the record stops asking for what is already done', () => {
  test('the certificate is at the top of the record, and prints', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362');
    const card = page.locator('[data-region="determination-card"]');
    await expect(card).toBeVisible();
    await card.locator('a').click();
    await page.waitForURL(/\/determination$/);

    const cert = page.locator('[data-region="certificate"]');
    await expect(cert).toBeVisible();
    await expect(cert).toContainText('MOPH-EV-2026-0362');
    // It states what it is NOT: a determination is not authorization of the event.
    await expect(cert).toContainText(/Authorization of the event remains with the legally competent authority/);
    await expect(page.locator('[data-region="certificate-controls"]')).toBeVisible();
  });

  test('a Level 3 organizer with a confirmed Director is not told to appoint one', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362');
    // EV-0362 is Level 3 with a confirmed Director. The amber panel derived from the
    // level alone, so it told the organizer to do something already done, on the same
    // screen that shows it was done.
    await expectAbsent(page, {
      absent: 'text=An Event Medical Director — a licensed physician — is required',
      anchor: page.locator('h1'),
      because: 'the requirement is filled, so the instruction to fill it does not apply',
    });
  });
});
