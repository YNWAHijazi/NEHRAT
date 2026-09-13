import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';

test('service choices fit a phone in both languages and support keyboard dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/dashboard');
  const trigger = page.getByRole('button', { name: /Start a service/ });
  await trigger.click();
  const menu = page.locator('[data-svc-menu]');
  await expect(menu.locator('a').first()).toBeVisible();
  await expect(menu.locator('a')).toHaveCount(3);
  await expect(menu.locator('input')).toHaveCount(0);
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press('Tab');
  await expect(menu.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeVisible();
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await page.getByRole('button', { name: /بدء خدمة/ }).click();
  await expect(menu.getByRole('link', { name: 'بدء فعالية', exact: true })).toBeVisible();
  const arabicBox = await menu.boundingBox();
  expect(arabicBox!.x).toBeGreaterThanOrEqual(0);
  expect(arabicBox!.x + arabicBox!.width).toBeLessThanOrEqual(375);
  await menu.getByRole('link', { name: 'بدء فعالية', exact: true }).click();
  await page.waitForURL('**/events/new');
});

test('an administrator downloads the filtered register and an organizer is refused', async ({ page }) => {
  await signInAs(page, 'test_moph_admin');
  await gotoRidingRestarts(page, '/ministry/admin/records?q=Baalbeck');
  const link = page.getByRole('link', { name: 'Export these records (CSV)', exact: true });
  const href = await link.getAttribute('href');
  expect(href).toContain('q=Baalbeck');
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-disposition']).toContain('attachment');
  const csv = await response.text();
  expect(csv).toContain('Baalbeck');
  expect(csv).not.toContain('Byblos Harbour Swim');
  await signInAs(page, 'test_organizer');
  expect((await page.request.get(href!)).status()).toBe(404);
});
