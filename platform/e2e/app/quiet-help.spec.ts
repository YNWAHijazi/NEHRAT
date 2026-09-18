import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';

for (const mobile of [false, true]) {
  test(`secondary help supports ${mobile ? 'touch and Arabic' : 'hover and keyboard'}`, async ({ page, context }) => {
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
      await context.addCookies([{ name: 'lang', value: 'ar', domain: 'localhost', path: '/' }]);
    }
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/admin/capabilities/vendorDirectory');
    const help = page.locator('[data-region="vendor-manager"] .info-note');
    const button = help.getByRole('button');
    const content = help.locator('.info-note-content');
    await expect(content).toBeHidden();
    if (!mobile) {
      await button.hover();
      await expect(content).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(content).toBeHidden();
      await button.focus();
      await page.keyboard.press('Enter');
    } else await button.click();
    await expect(content).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await button.press('Escape');
    await expect(content).toBeHidden();
    await expect(button).toBeFocused();
    await expect(page.locator('[data-region="capability-checks"]')).toHaveCount(0);
    await expect(page.locator('[data-region="capability-toggle"] button')).toBeVisible();
    await page.screenshot({ path: `/tmp/moph-v1-vendor-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });

    // The venue explanation moved out of the permanent layout in the same
    // simplification pass. It must still be readable, including on a phone.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/venues/new');
    const venueHelp = page.locator('[data-region="exempt-footnote"]');
    await expect(venueHelp.locator('.info-note-content')).toBeHidden();
    await venueHelp.getByRole('button').click();
    await expect(venueHelp.locator('.info-note-content')).toBeVisible();
    await expect(venueHelp.locator('.info-note-content')).toContainText(mobile
      ? 'تسجيل الموقع لا يعفي الفعاليات التي تُقام فيه.'
      : 'Registering a venue does not exempt events held there.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('internal roadmap is owner-only and requirement help remains accessible', async ({ page }) => {
  await signInAs(page, 'test_moph_admin');
  await gotoRidingRestarts(page, '/ministry/admin/configuration');
  await expect(page.locator('[data-region="config-values"]')).toBeVisible();
  await expect(page.locator('[data-region="deferred"]')).toHaveCount(0);
  await expect(page.getByText('The values in force.', { exact: false })).toHaveCount(0);
  await signInAs(page, 'test_owner');
  await gotoRidingRestarts(page, '/platform/admin');
  const roadmap = page.locator('[data-region="deferred"]');
  await expect(roadmap).not.toHaveAttribute('open');
  await roadmap.locator('summary').click();
  await expect(roadmap.getByRole('button').first()).toBeVisible();
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418/requirements');
  const note = page.locator('main .info-note').first();
  await expect(note.locator('.info-note-content')).toBeHidden();
  await note.getByRole('button').click();
  await expect(note.locator('.info-note-content')).toBeVisible();
});


test('recovery names an unavailable sender instead of claiming email delivery', async ({ page }) => {
  await gotoRidingRestarts(page, '/signin?mode=reset');
  await page.locator('input[name="email"]').fill('not-a-real-account@example.test');
  await page.getByRole('button', { name: 'Send the reset link', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Password recovery email is unavailable');
  await expect(page.locator('main').getByRole('alert').getByRole('link')).toHaveAttribute('href', '/help');
});
