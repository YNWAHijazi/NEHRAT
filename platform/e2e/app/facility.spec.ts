/**
 * The facility service's behavioural rules (Slice 4), as mechanical facts:
 *
 *  - the category step is a DETERMINATION, and for a category awaiting a Ministry
 *    value the journey ends cleanly -- the missing value named, an interest to
 *    record, a route back, and NO Continue control at all (rule 10: absent, not
 *    greyed);
 *  - the incident narrative blocks submission while a personal name is detected
 *    (non-negotiable 7), and clears when the name is replaced;
 *  - a foreign facility id refuses like a missing one, on every facility route.
 */
import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`form:has(input[value="${login}"]) button`).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/signin') || url.search.includes('notice='));
}

test.describe('the category determination', () => {
  test('a school leaves having done everything available to it', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/new');
    await page.getByRole('button', { name: /Continue to the category/ }).click();
    await page.getByRole('button', { name: /Schools, universities/ }).click();

    // The end-of-journey panel: the missing value is NAMED, nothing is in force,
    // and the two actions are an interest and the way back.
    await expect(page.locator('[data-region="journey-ends"]')).toContainText(
      'The phased implementation schedule',
    );
    await expect(page.locator('[data-region="journey-ends"]')).toContainText(
      'You have done everything available to you',
    );
    await expect(
      page.getByRole('button', { name: /Record an interest and notify us when it activates/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to the dashboard/ })).toBeVisible();

    // No Continue control exists -- not disabled, not greyed: absent.
    await expect(page.getByRole('button', { name: /Continue to the coordinator/ })).toHaveCount(0);
  });

  test('a sports facility proceeds, with the recurring-venue cross-reference beside it', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/new');
    await page.getByRole('button', { name: /Continue to the category/ }).click();
    await page.getByRole('button', { name: /Gyms, fitness centres/ }).click();

    await expect(page.locator('[data-region="determination"]')).toContainText('In force now');
    await expect(page.locator('[data-region="venue-cross"]')).toContainText(
      'Register a recurring venue as well',
    );
    await expect(page.getByRole('button', { name: /Continue to the coordinator/ })).toBeVisible();
  });

  test('a review category proceeds -- the review states what is required', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/new');
    await page.getByRole('button', { name: /Continue to the category/ }).click();
    await page.getByRole('button', { name: /cardiac arrest has previously been reported/ }).click();

    await expect(page.locator('[data-region="determination"]')).toContainText(
      'Determined by Ministry review',
    );
    await expect(page.getByRole('button', { name: /Continue to the coordinator/ })).toBeVisible();
  });
});

test.describe('the incident narrative name check', () => {
  test('a personal name blocks submission, and replacing it clears the block', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/FC-0014/incidents/new');

    const narrative = page.locator('textarea[name="narrative"]');
    await narrative.fill('Mr Haddad collapsed near the pool');
    await expect(page.locator('[data-region="narrative"]')).toContainText(
      'This looks like a personal name',
    );
    await expect(page.getByRole('button', { name: /Submit report/ })).toBeDisabled();

    await narrative.fill('The patient collapsed; staff started CPR and applied the AED.');
    await expect(page.locator('[data-region="narrative"]')).not.toContainText(
      'This looks like a personal name',
    );
    await expect(page.getByRole('button', { name: /Submit report/ })).toBeEnabled();
  });
});

test.describe("an organizer never sees another organizer's facilities", () => {
  test('a foreign facility id refuses like a missing one, on every facility route', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    for (const suffix of ['', '/devices', '/plan', '/incidents/new']) {
      const foreign = await page.goto(`/facilities/FC-0001${suffix}`);
      const foreignStatus = foreign?.status() ?? 0;
      const missing = await page.goto(`/facilities/FC-9999${suffix}`);
      const missingStatus = missing?.status() ?? 0;
      expect(foreignStatus, `status parity for ${suffix || '/'}`).toBe(missingStatus);
      expect([401, 403, 404]).toContain(foreignStatus);
    }
  });
});

test.describe('the validity ledger derives', () => {
  test('the ledger shows the reference dates at the review clock, statuses included', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/FC-0014');
    const ledger = page.locator('[data-region="ledger"]');
    // Stops-counting dates, derived from the seeded record at REVIEW_CLOCK 2026-08-13.
    await expect(ledger).toContainText('2026-10-02'); // earliest pad expiry
    await expect(ledger).toContainText('2027-03-18'); // earliest battery expiry
    await expect(ledger).toContainText('2026-10-26'); // oldest check + cycle (data)
    await expect(ledger).toContainText('2026-11-04'); // drill + 12 months
    await expect(ledger).toContainText('2026-09-12'); // confirmation + 12 months
    await expect(page.locator('[data-region="standing"]')).toContainText(
      'Obligations are being met. 2 items lapse within 60 days.',
    );
    // The provisional-vocabulary note renders wherever status wording appears.
    await expect(page.locator('[data-region="provisional"]')).toContainText('provisional');
  });

  test('the as-of pills preview the same derivation at a future date', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/facilities/FC-0014?asof=60');
    // 60 days past the review clock, the annual confirmation (2026-09-12) has lapsed.
    await expect(page.locator('[data-region="standing"]')).toContainText(
      'Obligations are not being met',
    );
  });
});
