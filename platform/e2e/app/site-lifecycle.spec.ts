/**
 * THE SITE AFTER IT IS FILED (owner, 10 October 2026: "if someone filled a site and they want to
 * change something after they submitted ... add an AED ... and after it gets accepted ... add
 * AEDs, maintenance, the drill, an urgent incident, the renewal").
 *
 * With the Ministry the record is read-only, so the operator asks for the change: what and why.
 * The Ministry reopens the registration for it; the operator adds the AED, confirms again and
 * refiles. Once accepted, the dashboard says what can be done, how renewal works and by when,
 * and each AED has its readiness check.
 */
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { recordReadiness, registerAed, registerFacility, submitRegistration } from '../helpers/facility-map';

test('a filed site asks for a change, is reopened, refiled and accepted, then maintained', async ({ page }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);
  await registerAed(page, 'LIFE-1', 'Reception');
  await recordReadiness(page);
  await submitRegistration(page);

  // WITH THE MINISTRY: read-only, with a way to ask for a change and to report an incident.
  await page.goto(`/facilities/${id}`);
  await expect(page.locator('[data-region=record-actions] [data-region=report-incident]')).toBeVisible();
  await page.locator('[data-region=ask-change]').click();
  await expect(page.locator('[data-region=site-change]')).toHaveAttribute('data-mode', 'request');
  // Send with nothing chosen: both missing items are named, nothing is sent.
  await page.locator('[data-region=send-change-request]').click();
  await expect(page.locator('[data-region=change-request-missing] [data-missing]')).toHaveCount(2);
  await page.locator('[data-region=site-change-form] [data-aspect=aedAdd]').click();
  await page.locator('[data-region=site-change-form] textarea[name=description]').fill('A second AED was installed at the gym entrance.');
  await page.locator('[data-region=send-change-request]').click();
  await expect(page).toHaveURL(/notice=requested/);
  await expect(page.locator('[data-region=change-requests] [data-status=open]')).toContainText('A second AED was installed at the gym entrance.');

  // THE MINISTRY reopens the registration for the change.
  await signInAs(page, 'test_moph');
  await page.goto(`/ministry/facilities/${id}`);
  const panel = page.locator('[data-region=ministry-change-requests]');
  await expect(panel).toContainText('A second AED was installed at the gym entrance.');
  await panel.locator('input[name=note]').fill('Add it and submit again.');
  await panel.locator('[data-act=reopen-for-change]').click();
  await expect(page).toHaveURL(/notice=change-reopened/);

  // THE OPERATOR reads why it reopened, adds the AED, confirms again and refiles.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}`);
  await expect(page.locator('[data-region=open-information-requests]')).toContainText('A second AED was installed at the gym entrance.');
  await expect(page.locator('[data-region=ask-change]')).toHaveCount(0);
  await page.goto(`/facilities/${id}?step=aeds#aeds`);
  await page.locator('[data-region=add-device]').click();
  await registerAed(page, 'LIFE-2', 'Gym entrance');
  await recordReadiness(page);
  await submitRegistration(page);

  // THE MINISTRY accepts version 2.
  await signInAs(page, 'test_moph');
  await page.goto(`/ministry/facilities/${id}`);
  await expect(page.locator('[data-region=ministry-change-requests] [data-status=reopened]')).toBeVisible();
  await page.locator('input[data-outcome=accept]').check();
  await page.locator('[data-act=outcome]').click();
  await expect(page).toHaveURL(/notice=accepted/);

  // ACCEPTED: the dashboard says what can be done, and how renewal works and by when.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}`);
  for (const group of ['routine', 'changes', 'urgent']) await expect(page.locator(`[data-maintenance-group=${group}]`)).toBeVisible();
  await expect(page.locator('[data-maintenance=incident]')).toHaveAttribute('href', `/facilities/${id}/incidents/new`);
  await expect(page.locator('[data-region=renewal-explained] [data-l=en]').first()).toContainText('Renewal is the practical cardiac-emergency drill and the readiness confirmation');
  await expect(page.locator('[data-region=renewal-explained]')).toContainText('Next due by 2027-08-01');
  // The change page now says the change is made directly.
  await page.goto(`/facilities/${id}/change`);
  await expect(page.locator('[data-region=site-change]')).toHaveAttribute('data-mode', 'direct');
  await expect(page.locator('[data-change=aedAdd]')).toHaveAttribute('href', `/facilities/${id}?tab=aeds#aeds`);

  // AED MAINTENANCE: a readiness check with its dates. A refusal names the field and keeps the form.
  await page.goto(`/facilities/${id}?tab=aeds`);
  await page.locator('[data-device-check=AED-001] [data-region=record-check]').click();
  const card = page.locator('[data-region=device-card]');
  await card.locator('input[name=checkDate]').fill('2026-08-10');
  await card.locator('input[name=representative]').fill('Facility manager');
  await card.getByRole('button', { name: 'Record the check', exact: true }).click();
  await expect(card.locator('[data-region=device-autosave-refused] [data-l=en]')).toHaveText('Not saved: enter the electrode-pad expiry date printed on the pads.');
  await expect(card.locator('input[name=checkDate]')).toHaveValue('2026-08-10');
  await card.locator('input[name=padExpiry]').fill('2027-03-01');
  await card.getByRole('button', { name: 'Record the check', exact: true }).click();
  await page.waitForURL(/notice=saved/);
  await page.goto(`/facilities/${id}?tab=aeds`);
  await expect(page.locator('[data-device-check=AED-001]')).toContainText('2026-08-10 · pads to 2027-03-01');
});
