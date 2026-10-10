/**
 * THE READINESS CONFIRMATION SAVES ON NEXT (owner, 10 October 2026: "Readiness confirmation is
 * not working in facility and not saving"). The step said moving on saves; the confirmation was
 * lost. Now a complete confirmation is recorded on Next, and a started one keeps the person on
 * the step with what is missing.
 */
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { registerAed, registerFacility } from '../helpers/facility-map';
test('moving on from the readiness confirmation records it, or says what is missing', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);
  await registerAed(page, 'U-1', 'Lobby');
  await page.goto(`/facilities/${id}?step=confirmation#confirmation-step`);
  const form = page.locator('[data-region=plan-confirmation]');
  // Started, not complete: Next keeps the person on the step and says what is missing.
  await form.locator('button[aria-pressed=false]').first().click();
  await page.locator('[data-region=step-next]').click();
  await expect(form.locator('[data-region=confirmation-unsaved]')).toBeVisible();
  // Each reason by name (owner, 10 October 2026: "it just restarts").
  await expect(form.locator('[data-region=confirmation-unsaved] [data-why=checks]')).toBeVisible();
  await expect(form.locator('[data-region=confirmation-unsaved] [data-why=drill-missing] [data-l=en]')).toContainText('A date shown in grey is a placeholder');
  await expect(page.locator('[data-step-item=confirmation]')).toHaveAttribute('data-step-state', 'current');
  // The button, refused: the page is not reloaded, the ticks stay, and only the drill date is named.
  while (await form.locator('button[aria-pressed=false]').count()) await form.locator('button[aria-pressed=false]').first().click();
  await form.locator('input[name=drillDate]').evaluate((el) => el.removeAttribute('required'));
  await form.getByRole('button', { name: 'Record the readiness confirmation' }).click();
  await expect(form.locator('[data-region=confirmation-unsaved] [data-why]')).toHaveCount(1);
  await expect(form.locator('[data-region=confirmation-unsaved] [data-why=drill-missing]')).toBeVisible();
  await expect(form.locator('button[aria-pressed=true]')).toHaveCount(6);
  // Complete: Next records it.
  await form.locator('input[name=drillDate]').fill('2026-08-01');
  await page.locator('[data-region=step-next]').click();
  await expect(page.locator('[data-step-item=confirmation]')).toHaveAttribute('data-step-state', 'complete', { timeout: 15000 });
  // The next step after the confirmation is the basic site infrastructure (required steps first).
  await expect(page.locator('[data-step-item=infrastructure]')).toHaveAttribute('data-step-state', 'current');
});
