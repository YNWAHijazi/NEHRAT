/**
 * THE FACILITY/SITE RECORD (owner decision, 9 October 2026; latest revision, sections 1-14):
 *
 *  - a one-page intake lands on the record, its step path open at the basic site infrastructure;
 *  - the steps run infrastructure, AEDs, the response plan, the readiness confirmation,
 *    supporting evidence, review and submit -- the optional ones never block;
 *  - the review lists the revision's lines and keeps "Submit Facility/Site registration to MOPH"
 *    disabled, with the reason, until every required line is complete;
 *  - submitted, it is the event's journey: the acknowledgment of receipt, the receipt band,
 *    the under-review card and a read-only record until the Ministry accepts it or asks for
 *    more (the dashboard tabs are walked in e2e/app/site-registration.spec.ts).
 */
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { CONTINUE, recordReadiness, registerAed, registerFacility, submitRegistration } from '../helpers/facility-map';
import { expectAbsent } from '../helpers/absence';
import { useLanguage } from '../helpers/language';

const stepState = (page: import('@playwright/test').Page, key: string) => page.locator(`[data-step-item=${key}]`);

test('a new site walks the step path, submits, and is managed from its dashboard', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);

  // THE RECORD WHILE IN PREPARATION: the Site ID leads, the FC number is the registration reference.
  const header = page.locator('[data-region=facility-workspace-header]');
  await expect(header.locator('[data-region=site-id]')).toHaveText(/^SITE-\d{6}$/);
  await expect(header.locator('[data-region=registration-reference]')).toHaveText(id);
  await expect(header.locator('[data-region=site-status] [data-l=en]')).toHaveText('In preparation');
  await expect(page.locator('[data-region=applicability]')).toHaveAttribute('data-applicability', 'covered');
  const nav = page.locator('[data-region=step-nav]');
  for (const label of ['Basic site infrastructure', 'AEDs', 'Cardiac emergency response plan', 'Readiness confirmation', 'Supporting evidence — optional', 'Review and submit']) await expect(nav).toContainText(label);
  await expect(stepState(page, 'infrastructure')).toHaveAttribute('data-step-state', 'current');
  await expect(stepState(page, 'evidence')).toHaveAttribute('data-step-state', 'notProvided');
  await expect(page.locator('#infrastructure [data-region=site-infrastructure]')).toContainText('Nothing here is required.');

  // INFRASTRUCTURE: optional, saved on Next.
  await page.locator('#infrastructure textarea[name=zones]').fill('Main hall and two studios');
  await page.locator('[data-region=step-next]').click();
  await expect(stepState(page, 'aeds')).toHaveAttribute('data-step-state', 'current');
  await expect(stepState(page, 'infrastructure')).toHaveAttribute('data-step-state', 'complete');

  // THE REVIEW NAMES WHAT REMAINS, and the submit button says why it waits.
  await page.locator('[data-step-item=review] a').click();
  const review = page.locator('#final-review');
  await expect(review.locator('[data-summary=aeds]')).toContainText('No AED registered');
  await expect(review.locator('[data-summary=confirmation]')).toContainText('Not recorded');
  await expect(review.locator('[data-summary=evidence]')).toContainText('None — optional');
  await expect(review.locator('[data-region=submit-registration]')).toBeDisabled();
  await expect(review.locator('[data-region=remaining] [data-remaining=aeds]')).toContainText('AED registration');

  // AEDs, the plan, the readiness confirmation.
  await registerAed(page, 'STEP-SERIAL-1', 'Front desk');
  await expect(page.locator('[data-facility-step=aeds]')).toHaveAttribute('data-state', 'complete');
  await expect(stepState(page, 'plan')).toHaveAttribute('data-step-state', 'complete');
  await page.locator('[data-step-item=plan] a').click();
  await expect(page.locator('#plan [data-region=procedure]')).toContainText('Contact EMS immediately');
  await expect(page.locator('#plan [data-region=derived]')).toContainText('Front desk');
  await recordReadiness(page);
  // The confirmation leads on to the evidence step; it submits nothing.
  await expect(page).toHaveURL(/step=evidence/);
  await expect(stepState(page, 'evidence')).toHaveAttribute('data-step-state', 'current');
  await expect(page.locator('#evidence [data-region=evidence-statement]')).toContainText('It does not itself establish MOPH acceptance or replace the regulatory Site requirements.');
  await expect(header.locator('[data-region=site-status] [data-l=en]')).toHaveText('In preparation');

  // REVIEW AND SUBMIT, laid out like the event's: the summary, what remains, the declaration, Submit and Save as draft.
  await page.locator('[data-region=step-next]').click();
  await expect(review.locator('[data-summary=aeds]')).toContainText('1 AED registered');
  await expect(review.locator('[data-summary=infrastructure]')).toContainText('Recorded');
  await expect(review.locator('[data-region=remaining]')).toBeHidden();
  await expect(review.locator('[data-region=save-draft]')).toBeVisible();
  // The declaration counts as remaining until it is signed.
  await expect(review.locator('[data-region=submit-registration]')).toBeDisabled();
  await submitRegistration(page);

  // THE ACKNOWLEDGMENT OF RECEIPT, as an event's: the Site ID as the record ID, the grey status chip.
  await expect(page.locator('[data-region=site-acknowledgment] [data-region=record-id]')).toHaveText(/^SITE-\d{6}$/);
  await expect(page.locator('[data-region=status-chip]')).toHaveAttribute('data-status', 'submitted');
  await expect(page.locator('[data-fact=reference]')).toContainText(id);

  // THE RECORD WITH THE MINISTRY: the receipt band, the under-review card, read-only steps -- as a filed event.
  await page.goto(`/facilities/${id}`);
  await expect(header.locator('[data-region=site-status]')).toHaveAttribute('data-status', 'submitted');
  await expect(page.locator('[data-region=next-action]')).toHaveAttribute('data-next-action', 'underReview');
  await expect(page.locator('[data-region=rail]')).toContainText('Waiting for the Ministry');
  await page.goto(`/facilities/${id}?step=review`);
  await expect(page.locator('[data-region=filed-band]')).toContainText(/Submitted\. The record ID is SITE-\d{6}\./);
  await expect(page.locator('[data-region=filed-band] a')).toHaveAttribute('href', `/facilities/${id}/acknowledgment`);
  await expectAbsent(page, { anchor: '[data-region=filed-band]', absent: '[data-region=submit-registration]', because: 'a submission with the Ministry is not filed again until it is returned' });
  await page.goto(`/facilities/${id}?step=infrastructure`);
  await expectAbsent(page, { anchor: '#infrastructure [data-region=site-infrastructure]', absent: '[data-region=save-infrastructure]', because: 'the record is read-only while the Ministry has it' });
  // Not before the Ministry accepts: no dashboard, no certificate.
  await expectAbsent(page, { anchor: '[data-region=record-stepper]', absent: '[data-region=site-tabs]', because: 'the dashboard follows acceptance' });
  await page.goto(`/facilities/${id}/certificate`);
  await expect(page.locator('[data-region=certificate-pending]')).toContainText('The site’s status is Submitted.');

  // THE OLD SUB-ROUTES LAND ON THE MATCHING STEP.
  await page.goto(`/facilities/${id}/devices`);
  await expect(page).toHaveURL(new RegExp(`/facilities/${id}\\?step=aeds#aeds$`));
  await expect(page.locator('[data-step-item=aeds]')).toHaveAttribute('data-step-state', 'current');
});

test('the intake names the covered categories and decides what the applicant cannot', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  await page.goto('/facilities/new');
  await expect(page.locator('[data-region=site-intro] [data-l=en]')).toHaveText('Register this Site if it belongs to a covered cardiac-readiness category. Registered Sites can also be reused when submitting Events held at the same location.');
  await expect(page.locator('[data-region=category-options] button')).toHaveCount(7);
  await expect(page.locator('[data-category=eventVenue]')).toContainText('Event-hosting venues with approved/licensed capacity ≥1,000');
  await expect(page.locator('[data-category=education]')).toContainText('according to the phased implementation schedule established by MOPH');
  // A designated category registers, but the applicant cannot designate itself.
  await page.locator('[data-category=remote]').click();
  await expect(page.locator('[data-region=determination]')).toContainText('Only the Ministry designates a site in this category.');
  await expect(page.getByRole('button', { name: CONTINUE, exact: true })).toBeVisible();
  // An event-hosting venue below the threshold is not covered: no Continue is drawn.
  await page.locator('[data-category=eventVenue]').click();
  await page.locator('input[name=capacity]').fill('400');
  await expect(page.locator('[data-region=capacity-ends]')).toContainText('The recorded capacity is below 1,000 persons');
  await expectAbsent(page, { anchor: '[data-region=capacity-ends]', absent: page.getByRole('button', { name: CONTINUE, exact: true }), because: 'a category that does not reach the site is absent, not greyed (rule 10)' });
  await page.locator('input[name=capacity]').fill('1500');
  await expect(page.getByRole('button', { name: CONTINUE, exact: true })).toBeVisible();
  // The operating organization starts as the account's organization record.
  await expect(page.locator('input[name=operatingOrganization]')).not.toHaveValue('');
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
  await expect(toggle).toContainText('البنية الأساسية للموقع');
  await toggle.click();
  await expect(page.locator('[data-step-item=review]')).toContainText('المراجعة والتقديم');
  await expect(page.locator('[data-region=step-next]')).toContainText('التالي');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
});
