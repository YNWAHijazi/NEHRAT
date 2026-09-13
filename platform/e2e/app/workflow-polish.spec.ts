import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';

test('organizer prepares one document at a time', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418/requirements');
  const plan = page.locator('[data-document="plan"]');
  const map = page.locator('[data-document="siteMap"]');
  await expect(plan).toHaveAttribute('open');
  await map.locator(':scope > summary').click();
  await expect(map).toHaveAttribute('open');
  await expect(plan).not.toHaveAttribute('open');
});

test('the second report signature submits it and the Ministry accepts it', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0244/post-event');
  await page.getByRole('button', { name: 'Sign and submit', exact: true }).click();
  await expect(page.locator('main')).toContainText('Your signature is recorded');
  await signInAs(page, 'test_director');
  await gotoRidingRestarts(page, '/events/EV-0244/report');
  await page.getByRole('button', { name: 'Review complete — sign the report', exact: true }).click();
  await page.waitForURL('**/report?notice=signed');
  await signInAs(page, 'test_moph_admin');
  await gotoRidingRestarts(page, '/ministry/reports');
  const report = page.locator('details', { hasText: 'Tripoli Marathon' });
  await expect(report.locator('summary')).toBeVisible();
  await report.locator('summary').click();
  await report.getByRole('button', { name: 'Accept report', exact: true }).click();
  await expect(report.locator('summary')).toContainText('Accepted');
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0244/post-event');
  await expect(page.getByRole('status')).toContainText('The Ministry has accepted your post-event report.');
  expect((await page.request.get('/ministry/reports')).status()).toBe(404);
});

test('certificate access precedes the progress timeline and owner gets an overview', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0244');
  const certificate = page.locator('[data-region="determination-card"]');
  await expect(certificate.getByRole('link')).toBeVisible();
  expect(await certificate.evaluate((el) => (el.compareDocumentPosition(document.querySelector('[data-region="rail"]')!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true);
  await signInAs(page, 'test_owner');
  await gotoRidingRestarts(page, '/platform/admin');
  await expect(page.locator('[data-region="owner-overview"]')).toBeVisible();
  await expect(page.locator('[data-region="email-status"]')).toContainText('Sender not configured yet');
});
