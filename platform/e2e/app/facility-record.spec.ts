/**
 * THE FACILITY RECORD IN THE EVENT AND VENUE FORMAT (owner, 9 October 2026): "the same
 * format as the events and venues, with the vertical path, and after they fully register,
 * it'll become a managing page to manage it."
 *
 *  - a one-page intake lands on the record, its step path open at the AEDs;
 *  - the steps are amber while open and green once complete, and Next saves what was typed;
 *  - the review names what remains, with a link to each, and the facility confirmation
 *    completes the registration;
 *  - registered, the same address is the management page: sections with anchors, no tabs;
 *  - the old sub-routes land on the record.
 */
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { registerFacility } from '../helpers/facility-map';
import { expectAbsent } from '../helpers/absence';
import { useLanguage } from '../helpers/language';

const stepState = (page: import('@playwright/test').Page, key: string) => page.locator(`[data-step-item=${key}]`);

test('a new facility walks the step path, then is managed from the same page', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);

  // THE RECORD WHILE REGISTERING: header, next step, rail, the compact details card, the vertical steps.
  const header = page.locator('[data-region=facility-workspace-header]');
  await expect(header).toContainText(id);
  await expect(header).toContainText('Registration in progress');
  await expectAbsent(page, { anchor: header, absent: '[data-region=facility-workspace-nav]', because: 'the facility record has no section tabs' });
  await expect(page.locator('[data-region=next-action]')).toHaveAttribute('data-next-action', 'aeds');
  await expect(page.locator('[data-region=rail]')).toContainText('Registration certificate');
  await expect(page.locator('[data-region=facility-details] [data-region=edit-details-link]')).toHaveAttribute('href', `/facilities/${id}/profile`);
  const nav = page.locator('[data-region=step-nav]');
  await expect(nav).toContainText('AEDs');
  await expect(nav).toContainText('Review and register');
  await expect(stepState(page, 'aeds')).toHaveAttribute('data-step-state', 'current');
  await expect(stepState(page, 'contact')).toHaveAttribute('data-step-state', 'complete');
  await expect(stepState(page, 'plan')).toHaveAttribute('data-step-state', 'pending');
  await expect(page.locator('#aeds [data-region=registry-empty]')).toContainText('No AED registered yet.');

  // NEXT SAVES WHAT WAS TYPED: a device left unregistered is refused with the reason, and the person stays.
  const aeds = page.locator('#aeds');
  await aeds.locator('input[name=identification]').fill('STEP-SERIAL-1');
  await page.locator('[data-region=step-next]').click();
  await expect(aeds.locator('[data-region=device-autosave-refused]')).toContainText('The device was not saved.');
  await expect(stepState(page, 'aeds')).toHaveAttribute('data-step-state', 'current');
  // Completed, the same Next registers it and moves on; the AED step turns green.
  await aeds.locator('input[name=location]').fill('Front desk');
  await aeds.locator('input[name=representative]').fill('Facility manager');
  await page.locator('[data-region=step-next]').click();
  await expect(stepState(page, 'contact')).toHaveAttribute('data-step-state', 'current');
  await expect(stepState(page, 'aeds')).toHaveAttribute('data-step-state', 'complete');
  await expect(page.locator('[data-region=registry-table]')).toContainText('STEP-SERIAL-1');

  // The contact saves on Next too.
  await page.locator('#contact input[name=coordinatorName]').fill('Duty manager');
  await page.locator('[data-region=step-next]').click();
  await expect(stepState(page, 'plan')).toHaveAttribute('data-step-state', 'current');
  await expect(page.locator('#plan [data-region=plan-contact]')).toContainText('Duty manager');

  // THE REVIEW NAMES WHAT REMAINS: half the readiness confirmations, no drill date.
  const checks = page.locator('#plan [data-region=readiness-checks]');
  for (let i = 0; i < 3; i++) await checks.locator('button[aria-pressed=false]').first().click();
  await page.locator('[data-region=step-next]').click();
  const review = page.locator('#final-review');
  await expect(review.locator('[data-region=remaining]')).toContainText('Readiness confirmations in the response plan (3 of 6)');
  await expect(review.locator('[data-region=remaining] [data-remaining=checks]')).toHaveAttribute('href', '#plan');
  await expect(review.locator('input[name=representative]')).toHaveValue('Duty manager');
  await review.getByRole('button', { name: 'Complete the registration', exact: true }).click();
  await expect(review.locator('[data-region=please-fill]')).toContainText('the readiness confirmations, the drill date');
  await expect(page).not.toHaveURL(/notice=confirmed/);
  // Its link goes back to the plan step, where the ticks are still held.
  await review.locator('[data-region=please-fill] a').click();
  await expect(stepState(page, 'plan')).toHaveAttribute('data-step-state', 'current');
  await expect(checks.locator('button[aria-pressed=true]')).toHaveCount(3);
  while (await checks.locator('button[aria-pressed=false]').count()) await checks.locator('button[aria-pressed=false]').first().click();
  await checks.locator('input[name=drillDate]').fill('2026-08-01');
  await page.locator('[data-region=step-next]').click();
  await expect(review.locator('[data-region=remaining]')).toBeHidden();
  await review.getByRole('button', { name: 'Complete the registration', exact: true }).click();
  await expect(page).toHaveURL(/notice=confirmed/);

  // REGISTERED: the same address is the management page.
  await expect(header).toContainText('Registered');
  await expect(page.locator('[data-region=registered-band]')).toContainText(`Registered. The record ID is ${id}.`);
  await expect(page.locator('[data-region=registered-band] a')).toHaveAttribute('href', `/facilities/${id}/certificate`);
  for (const section of ['status', 'aeds', 'plan', 'incidents', 'requests', 'details']) await expect(page.locator(`[data-region=section-${section}]`)).toBeVisible();
  await expectAbsent(page, { anchor: '[data-region=section-status]', absent: '[data-region=record-stepper]', because: 'a registered facility is managed, not registered again' });
  await expect(page.locator('[data-region=plan-due]')).toContainText('The next readiness confirmation is due by');
  await expect(page.locator('[data-region=plan-confirmation]')).toBeVisible();
  await expect(page.locator('[data-region=report-incident]')).toHaveAttribute('href', `/facilities/${id}/incidents/new`);
  await expect(page.locator('[data-region=no-requests]')).toContainText('No requests from the Ministry.');
  await expect(page.locator('[data-region=contact-summary]')).toContainText('Duty manager');
  await expect(page.locator('[data-region=edit-contact-link]')).toHaveAttribute('href', `/facilities/${id}/profile#contact`);
  // The AEDs are managed here: add, relocate, replace and update status are the registry's purposes.
  await page.locator('#aeds [data-region=registry-table] button').first().click();
  for (const purpose of ['Relocation', 'Replacement', 'Operational-status change']) await expect(page.locator('#aeds').getByRole('button', { name: purpose, exact: true })).toBeVisible();

  // THE OLD SUB-ROUTES LAND ON THE RECORD.
  await page.goto(`/facilities/${id}/devices`);
  await expect(page).toHaveURL(new RegExp(`/facilities/${id}\\?step=aeds#aeds$`));
  await expect(page.locator('[data-region=section-aeds]')).toBeVisible();
  await page.goto(`/facilities/${id}/submit`);
  await expect(page).toHaveURL(new RegExp(`/facilities/${id}\\?step=plan#plan$`));
  await page.goto(`/facilities/${id}/incidents`);
  await expect(page).toHaveURL(new RegExp(`/facilities/${id}#incidents$`));
  await expect(page.locator('[data-region=section-incidents]')).toBeVisible();
});

test('the step path reads in Arabic and fits a phone', async ({ page, context }) => {
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 375, height: 800 });
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);
  await useLanguage(context, 'ar');
  await page.goto(`/facilities/${id}`);
  // The phone shows the current step in a bar that opens the list.
  const toggle = page.locator('.step-nav-toggle');
  await expect(toggle).toContainText('أجهزة إزالة الرجفان');
  await toggle.click();
  await expect(page.locator('[data-step-item=review]')).toContainText('المراجعة والتسجيل');
  await expect(page.locator('[data-region=step-next]')).toContainText('التالي');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
});
