/**
 * THE MUNICIPALITY FIELD (owner, 9 October 2026): a searchable list, the option in the page's
 * language, both names stored. The list received is English only and incomplete, so the field
 * suggests and does not restrict: a name that is not on it is kept as typed.
 */
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { useLanguage } from '../helpers/language';
import { mockMapTiles } from '../helpers/facility-map';

test('the site form chooses one municipality from the list, or keeps one that is not on it', async ({ page, context }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  await mockMapTiles(page);
  await page.goto('/facilities/new');
  const field = page.locator('[data-region=facility-registration] [data-region=municipality-field]');
  const box = field.locator('input[role=combobox]');

  // Focusing opens the list; typing narrows it.
  await box.click();
  await expect(field.locator('[data-region=municipality-options] [role=option]').first()).toBeVisible();
  await box.fill('jouni');
  await expect(field.locator('[data-municipality="Jounieh"]')).toBeVisible();
  await field.locator('[data-municipality="Jounieh"]').click();
  await expect(box).toHaveValue('Jounieh');
  await expect(page.locator('input[type=hidden][name=municipality]')).toHaveValue('Jounieh');
  // The Arabic names are pending: the English name stands in, never an empty field.
  await expect(page.locator('input[type=hidden][name=municipalityAr]')).toHaveValue('Jounieh');

  // A name the list does not carry is offered as typed, and kept.
  await box.fill('Kfar Nowhere');
  await expect(field.locator('[data-municipality-typed]')).toContainText('Not on the list: use “Kfar Nowhere”');
  await field.locator('[data-municipality-typed]').click();
  await expect(page.locator('input[type=hidden][name=municipality]')).toHaveValue('Kfar Nowhere');

  // A main town is found by its common name or the source's spelling.
  await box.fill('tyre');
  await expect(field.locator('[data-municipality="Tyre"]')).toBeVisible();
  await box.fill('sour');
  await expect(field.locator('[data-municipality="Tyre"]')).toBeVisible();

  // Two places of the same name are told apart by their district.
  await box.fill('Aaba');
  await expect(field.locator('[data-municipality="Aaba (Koura)"]')).toBeVisible();
  await expect(field.locator('[data-municipality="Aaba (Nabatieh)"]')).toBeVisible();

  // The Arabic page: the field and its foot read in Arabic.
  await useLanguage(context, 'ar');
  await page.goto('/facilities/new');
  const arBox = page.locator('[data-region=facility-registration] [data-region=municipality-field] input[role=combobox]');
  await expect(arBox).toHaveAttribute('placeholder', 'ابحثوا أو اختاروا من القائمة');
  await arBox.fill('Zzz');
  await expect(page.locator('[data-municipality-typed] [data-l=ar]')).toContainText('غير مدرجة في القائمة');
});

test('the event form takes several municipalities as tags', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  await page.goto('/events/new');
  const field = page.locator('[data-region=municipality-field][data-multiple]');
  const box = field.locator('input[role=combobox]');
  await box.fill('jounieh');
  await box.press('Enter');
  await box.fill('tripoli');
  await box.press('Enter');
  const tags = field.locator('[data-municipality-tag]');
  await expect(tags).toHaveCount(2);
  await expect(tags.nth(0)).toContainText('Jounieh');
  await expect(tags.nth(1)).toContainText('Tripoli');
  // A chosen municipality is not offered again.
  await box.fill('jouni');
  await expect(field.locator('[data-municipality="Jounieh"]')).toHaveCount(0);
  await box.fill('');
  await tags.nth(0).getByRole('button').click();
  await expect(tags).toHaveCount(1);
  await expect(tags.nth(0)).toContainText('Tripoli');
});
