import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { mockMapTiles, chooseMapPoint } from '../helpers/facility-map';

/**
 * Partner report, 8 October 2026: the venue registration page cleared on Continue and
 * stayed. A refused form now keeps every value, names the field and takes focus there;
 * Arabic-Indic digits in the telephone number are accepted and stored as Western digits.
 */
test('a refused venue registration keeps what was typed and names the field; the corrected form registers the venue', async ({ page }) => {
  test.setTimeout(180_000);
  await mockMapTiles(page);
  await signInAs(page, 'test_organizer');
  await page.goto('/venues/new');
  // Continue stays active (owner, 8 October 2026): pressed too early, it names every unfilled item and marks it.
  await page.getByRole('button', { name: 'Continue to requirements', exact: true }).click();
  await expect(page.locator('[data-region="please-fill"]')).toContainText('Please fill: the venue name (English)');
  await expect(page.locator('[data-region="please-fill"]')).toContainText('the map pin');
  await expect(page.locator('[data-region="please-fill"]')).toContainText('the position');
  // The signed-in person starts as the representative and the responsible person (owner, 9 October 2026).
  await expect(page.locator('[data-region="please-fill"]')).not.toContainText('the authorized representative');
  await expect(page.getByLabel(/Authorized representative/)).not.toHaveValue('');
  await expect(page.locator('input[name=name]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/venues\/new$/);
  for (const [k, v] of Object.entries({ name: 'Registration refusal test', nameAr: 'اختبار رفض التسجيل', address: 'Tripoli corniche', contactName: 'Venue operator', contactPhoneNumber: '12', capacity: '2500' })) await page.locator(`input[name=${k}]`).fill(v);
  await page.locator('select[name=category]').selectOption('hall');
  await page.locator('select[name=district]').selectOption('Tripoli');
  await page.getByRole('button', { name: 'Yes', exact: true }).first().click();
  await page.getByRole('button', { name: 'No', exact: true }).nth(1).click();
  await chooseMapPoint(page);
  // The assessment on the same page (owner, 8 October 2026).
  await page.getByLabel(/Most people at the same time during a routine operating session/).fill('2500');
  for (const d of await page.locator('[data-domain]').all()) await d.locator('button').first().click();
  await page.getByLabel(/Authorized representative/).fill('Operator');
  await page.getByLabel(/Position/).fill('Manager');
  await page.getByRole('button', { name: 'Continue to requirements', exact: true }).click();
  // Refused: the telephone number is named, the rest of the form is untouched, and focus is on the field.
  await expect(page.locator('[data-region="registration-refused"]')).toContainText('Choose the country code and enter the number in digits');
  await expect(page.locator('input[name=contactPhoneNumber]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[name=contactPhoneNumber]')).toBeFocused();
  await expect(page.locator('input[name=name]')).toHaveValue('Registration refusal test');
  await expect(page.locator('input[name=nameAr]')).toHaveValue('اختبار رفض التسجيل');
  await expect(page.locator('select[name=district]')).toHaveValue('Tripoli');
  await expect(page.locator('input[name=capacity]')).toHaveValue('2500');
  await expect(page.getByRole('button', { name: 'Yes', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-map-picker=map] input[type=checkbox]')).toBeChecked();
  await expect(page.getByLabel(/Authorized representative/)).toHaveValue('Operator');
  // Corrected with Arabic-Indic digits: accepted, stored as Western digits, and the assessment opens.
  await page.locator('input[name=contactPhoneNumber]').fill('+٩٦١ ٣ ١٢٣ ٤٥٦');
  await page.getByRole('button', { name: 'Continue to requirements', exact: true }).click();
  await expect(page).toHaveURL(/\/venues\/VN-\d+$/);
  const id = new URL(page.url()).pathname.split('/')[2]!;
  await page.goto(`/venues/${id}/details`);
  await expect(page.locator('[data-region=venue-details-read-only]')).toContainText('+961 3 123 456');
});
