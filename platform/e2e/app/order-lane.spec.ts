import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { openDetails } from '../helpers/record';

/**
 * The Order of Physicians lane (partner review, 2026-10-07): off by default; when the
 * platform owner turns it on, the Order sees the filed Level 3 submissions with the
 * Director's credential information, records its verification with an audit line, and
 * the organizer's Director row reports the result. The outcome stays the Ministry's.
 */
test('the Order reviews a Level 3 Director once the lane is on; the organizer sees the verification state', async ({ page }) => {
  const db = () => new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  try {
    // Off by default: the off state is the whole screen, and the organizer's row names the Ministry as the recorder.
    await signInAs(page, 'test_order');
    await expect(page.locator('[data-region="lane-off"]')).toBeVisible();
    await expect(page.locator('[data-region="order-submission"]')).toHaveCount(0);
    await signInAs(page, 'test_organizer');
    await page.goto('/events/EV-0362#req-B3');
    const director = await openDetails(page.locator('[data-requirement="B3"]'));
    await expect(director.locator('[data-region="director-verification"]')).toContainText('Verification is recorded by the Ministry of Public Health');

    // The owner turns the lane on; the Order's landing page lists the Level 3 filing with the Director's credential information.
    await signInAs(page, 'test_owner');
    await page.getByRole('button', { name: 'Turn the lane on', exact: true }).click();
    await expect(page).toHaveURL(/notice=lane/);
    await signInAs(page, 'test_order');
    const filing = page.locator('[data-region="order-submission"][data-event="EV-0362"]');
    await expect(filing).toBeVisible();
    await expect(filing.locator('[data-region="order-director"]')).toContainText('Dr. N. Salameh');
    await expect(filing.locator('[data-att-item="directorCredential"]')).toHaveAttribute('data-att-state', 'pending');
    await expect(filing.locator('[data-att-item="clinicalContent"]')).toBeVisible();
    await expect(filing.locator('[data-att-item="insuranceEvidenced"]')).toHaveCount(0);
    await filing.locator('[data-region="order-plan"] > summary').click();
    await expect(filing.locator('[data-region="order-plan"]')).toContainText('3.');
    // The Order records the credential verification; the audit line names who and when.
    await filing.locator('[data-att-item="directorCredential"] form:has(input[name="kind"][value="attest"]) button').click();
    await expect(page).toHaveURL(/\/ministry\/order#event-EV-0362$/);
    await expect(filing.locator('[data-att-item="directorCredential"]')).toHaveAttribute('data-att-state', 'complete');
    await expect(filing.locator('[data-att-item="directorCredential"]')).toContainText('Reviewed by');
    // The organizer's Director row reports the result, distinct from any outcome.
    await signInAs(page, 'test_organizer');
    await page.goto('/events/EV-0362#req-B3');
    const verified = await openDetails(page.locator('[data-requirement="B3"]'));
    await expect(verified.locator('[data-region="director-verification"]')).toContainText('Credential verified by the Lebanese Order of Physicians');
  } finally {
    // The lane and the attestation are shared state: put both back for the other journeys.
    const d = db();
    d.prepare("DELETE FROM ministry_config WHERE key = 'orderLane'").run();
    d.prepare("DELETE FROM attestations WHERE event_id = 'EV-0362' AND item_key = 'directorCredential'").run();
    d.close();
  }
});
