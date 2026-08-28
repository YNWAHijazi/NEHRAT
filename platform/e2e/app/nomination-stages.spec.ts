/**
 * The nomination in three stages: view, respond, account.
 *
 * The ruling these pin (2026-08-28): a nominated party must be able to read what they
 * are being asked to take on, answer it, and only then decide whether to hold an
 * account. Before it, one submit recorded the response AND created an account AND
 * started a session -- so accepting was the same click as being signed in, and
 * declining required registering with the platform in order to say no.
 *
 * The load-bearing assertions here are the SEPARATIONS: that stage one needs no
 * account, that stage two needs no account, and that stage three is reachable but not
 * compulsory. Each is a thing the old flow could not do.
 */

import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';

/**
 * THIS SPEC MAKES ITS OWN NOMINATION and does not borrow a seeded one.
 *
 * The first draft used demo-coastal-medical-0418, the only seeded invitation still
 * unanswered -- and nominations.spec.ts WITHDRAWS that same row, while this spec
 * ACCEPTS it. Whichever ran first broke the other, and the breakage read as a product
 * defect: "the unanswered nomination blocks filing by name" failed because the
 * nomination was no longer unanswered.
 *
 * Two specs mutating one seeded row is a shared-state bug, not a flake, and adding a
 * second seeded nomination would only move it. So this creates a nomination against
 * the organizer's own event, reads the token off the screen the organizer is given it
 * on, and walks the stages against that.
 */
let EMS_TOKEN = '';

/** Nominates a provider on EV-0418 and returns the token the organizer is handed. */
async function makeNomination(page: Page, name: string): Promise<string> {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418/requirements');
  const invite = page.locator('form:has(input[name="kind"][value="ems"])').first();
  await invite.locator('input[name="name"]').fill(name);
  await invite.locator('input[name="email"]').fill('stages@example.lb');
  await invite.locator('button[type="submit"]').first().click();
  await page.waitForURL('**/requirements**');
  const row = page.locator('[data-region="g2"] > div > div', { hasText: name });
  const link = await row.locator('code').first().innerText();
  const token = link.trim().replace('/invitations/', '');
  expect(token, 'no invitation token was rendered for the new nomination').not.toBe('');
  return token;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  EMS_TOKEN = await makeNomination(page, 'Stage Walk Medical');
  // Signed out again: stages one and two must work on the token ALONE, and a
  // lingering organizer session would hide it if they did not.
  await page.context().clearCookies();
  await page.close();
});

test.describe('stage one — what you are being asked to take on', () => {
  test('reads on the token alone, with no account and no session', async ({ page }) => {
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    const briefing = page.locator('[data-region="briefing"]');
    await expect(briefing).toBeVisible();

    // The event, in enough detail to decide on: not five facts.
    const event = page.locator('[data-region="briefing-event"]');
    await expect(event).toContainText('Beirut Coastal 12K');
    await expect(event).toContainText('Level 2');
    for (const label of ['Organizer', 'Dates', 'Opening and closing', 'Venue, route, or location', 'Municipality']) {
      await expect(event, `the briefing omits ${label}`).toContainText(label);
    }

    // The organizer's filing deadline -- the nominee's deadline in practice.
    await expect(page.locator('[data-region="briefing-deadline"]')).toBeVisible();

    // The requirements THIS level puts on THIS party, derived from the matrix.
    const reqs = page.locator('[data-region="briefing-requirements"]');
    await expect(reqs).toBeVisible();
    // At Level 2 the provider carries six matrix rows. The declaration is a LEVEL 3
    // row and must not appear here -- the briefing states the level's real demands,
    // not the heaviest level's.
    await expect(reqs).toContainText('Basic Life Support medical response team');
    await expectAbsent(page, {
      absent: 'text=EMS Readiness Declaration',
      anchor: reqs,
      because: 'the readiness declaration is a Level 3 requirement and this event is Level 2',
    });

    // Who else is named -- including the Director, whose identity declaration item 7
    // turns on. An EMS provider cannot evaluate the nomination without it.
    const parties = page.locator('[data-region="briefing-parties"]');
    await expect(parties).toBeVisible();
    // Every party named on the event, this one marked. EV-0418 carries three EMS
    // nominations and no Director (none is required at Level 2).
    await expect(parties).toContainText('Stage Walk Medical');
    await expect(parties).toContainText('(you)');

    // Documents concerning their role.
    await expect(page.locator('[data-region="briefing-documents"]')).toBeVisible();
  });

  test('the documents open on the token, and only the ones for this role', async ({ page }) => {
    // Allowed: the site map concerns where the provider deploys.
    const allowed = await page.request.get(`/api/nomination-documents/${EMS_TOKEN}/siteMap`);
    expect(allowed.status()).toBe(200);
    expect(allowed.headers()['content-type']).toBe('application/pdf');
    expect(allowed.headers()['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers()['content-security-policy']).toContain('sandbox');

    // Refused: an allow-list, not a subtraction. A document outside the nominee's
    // role is invisible even though the same token reads the two that are in it.
    for (const key of ['insuranceCertificate', 'complianceForm', 'riskAssessment']) {
      const refused = await page.request.get(`/api/nomination-documents/${EMS_TOKEN}/${key}`);
      expect(refused.status(), `${key} must not be readable on a nomination token`).toBe(404);
    }
  });

  test('the briefing is not the submission', async ({ page }) => {
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    // Being named in an event is not being named in all of it: no assessment answers,
    // no compliance form, no other party's declaration.
    await expectAbsent(page, {
      absent: '[data-region="assessment-answers"]',
      anchor: '[data-region="briefing"]',
      because: 'a nominated party is shown their own part, never the organizer\'s file',
    });
  });
});

test.describe('stage two — the answer, on the token, with no account', () => {
  test('all three responses are offered', async ({ page }) => {
    // The Director used to be offered two: asking a question first was filtered out by
    // kind, leaving a physician to accept blind or decline. The filter is gone, and
    // that removal is pinned per-kind in tests/roles.test.ts -- no seeded nomination
    // has a Director in the unanswered state, and inventing one below Level 3 would be
    // incoherent regulatory data, since the matrix names no Director there.
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    const respond = page.locator('[data-region="respond"]');
    await expect(respond).toBeVisible();
    await expect(respond).toContainText('Accept');
    await expect(respond).toContainText('Decline');
    await expect(respond).toContainText(/modification|further information/i);
  });

  test('no account fields stand between reading and answering', async ({ page }) => {
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    await expectAbsent(page, {
      absent: 'input[type="password"]',
      anchor: '[data-region="respond"]',
      because: 'accepting must never be the same click as being signed in',
    });
  });

  test('declining states the consequence before the click, and needs no account', async ({ page }) => {
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    await page.locator('[data-region="respond"] button', { hasText: 'Decline' }).first().click();
    // The material-change weight is stated BEFORE the confirming control appears.
    await expect(page.locator('body')).toContainText(/material change/i);
    await expect(page.locator('button:has-text("I understand")')).toBeVisible();
  });
});

test.describe('stage three — the account, after the answer and never as part of it', () => {
  test('an unanswered nomination has no account screen -- that is the forbidden order', async ({ page }) => {
    const response = await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}/account`);
    expect(response?.status()).toBeLessThan(400);
    // Bounced back to the nomination: there is nothing to register against yet.
    await expect(page).toHaveURL(new RegExp(`/invitations/${EMS_TOKEN}$`));
  });

  // MUTATING, AND LAST. It answers the one unanswered seeded nomination, so it runs
  // after every test that needs it unanswered. The file is serial under the app
  // project's fullyParallel: false, so declaration order is execution order.
  test('accepting records the answer and offers an account without requiring one', async ({ page }) => {
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    await page.locator('[data-region="respond"] button', { hasText: 'Accept' }).first().click();
    await page.locator('button:has-text("Accept the nomination")').click();
    await page.waitForURL(new RegExp(`/invitations/${EMS_TOKEN}/account`));

    // The answer is already recorded. The account is an offer.
    await expect(page.locator('[data-region="answer-recorded"]')).toBeVisible();
    await expect(page.locator('[data-region="create-account"]')).toBeVisible();
    // And the other path, for a party nominated to a second event.
    await expect(page.locator('[data-region="sign-in-instead"]')).toBeVisible();

    // Walking away does not undo it: the answer stands and the link comes back here.
    await gotoRidingRestarts(page, `/invitations/${EMS_TOKEN}`);
    await expect(page.locator('[data-region="accepted-no-account"]')).toBeVisible();
  });
});
