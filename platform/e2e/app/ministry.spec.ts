/**
 * The Ministry console's behavioural rules (Slice 6), as mechanical facts:
 *
 *  - the satisfied outcome is disabled WITH THE BLOCKER NAMED while a blocking
 *    inspection lacks recorded findings, and the other two outcomes stay
 *    enabled;
 *  - internal workflow states render grey and are not determinations;
 *  - a cardiac value's unset state is first-class, and set-and-publish records
 *    it with an effective date;
 *  - the Order reviewer shows suspended while the lane is off.
 */
import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`form:has(input[value="${login}"]) button`).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/signin') || url.search.includes('notice='));
}

test.describe('the outcome gate', () => {
  // One serial flow: the same record is asserted gated, then unblocked by the
  // inspector, then asserted open -- two tests on one mutating record would
  // race across parallel workers.
  test('satisfied is gated with the blocker named, and opens when findings are recorded', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await page.goto('/ministry/submissions/EV-0362');
    const outcome = page.locator('[data-region="outcome"]');
    await expect(outcome).toContainText('Record the outcome');
    // The blocking inspection is named against the gated outcome.
    await expect(outcome).toContainText('Blocking inspection without recorded findings');
    const radios = outcome.locator('input[type="radio"]');
    await expect(radios.nth(0)).toBeEnabled(); // incomplete
    await expect(radios.nth(1)).toBeEnabled(); // revision
    await expect(radios.nth(2)).toBeDisabled(); // satisfied -- gated
    // The two limit sentences ride wherever an outcome is recorded.
    await expect(page.locator('[data-region="limits"]')).toContainText(
      'Authorization of the event remains with the legally competent authority',
    );

    // The inspector records the findings -- an inspector act, not an outcome.
    await signInAs(page, 'test_inspector');
    await page.goto('/ministry/submissions/EV-0362');
    const blocking = page.locator('[data-region="inspections"] > div').first();
    await blocking.locator('input[name="findings"]').fill('Treatment post and deployment verified as planned.');
    await blocking.locator('button:has-text("Save")').click();
    await page.waitForURL('**/ministry/submissions/EV-0362');

    // The gate opens for the reviewer.
    await signInAs(page, 'test_moph');
    await page.goto('/ministry/submissions/EV-0362');
    // Generous under full-suite dev-compile load; the state itself is instant.
    await expect(page.locator('[data-region="outcome"] input[type="radio"]').nth(2)).toBeEnabled({ timeout: 15_000 });
  });
});

test.describe('internal states and determinations', () => {
  test('the queue distinguishes grey workflow states from recorded outcomes', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await page.goto('/ministry/queue');
    const queue = page.locator('[data-region="queue"]');
    // EV-0362 carries a recorded revision outcome; EV-0244 has no determination
    // and shows the grey in-queue state.
    await expect(queue).toContainText('Additional information or revision required');
    await expect(queue).toContainText('In queue');
    // Never approved, never rejected.
    await expect(queue).not.toContainText(/approved|rejected/i);
  });
});

test.describe('the pinned vocabulary', () => {
  // The reviewer's ratchet on the two panels that carry the vocabulary and the
  // unset state: exact strings, both languages. The EN limits are ALSO
  // pixel-compared (visual manifest, ministry-review.outcome-limits); the Arabic
  // rides here until the prototype's glossary defect is corrected in Pass C.
  test('the outcome card and the limit sentences read verbatim, in both languages', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await page.goto('/ministry/submissions/EV-0362');
    const outcome = page.locator('[data-region="outcome"]');
    await expect(outcome).toContainText('Record an outcome');
    await expect(outcome).toContainText('Three outcomes exist. Nothing else is a determination.');
    await expect(outcome).toContainText('Everything must be complete before a clearance is shown. The other two outcomes stay available.');
    const limits = page.locator('[data-region="limits"]');
    await expect(limits).toContainText('The Ministry reviews health and medical preparedness only. Authorization of the event remains with the legally competent authority.');
    await expect(limits).toContainText('This status does not replace any other permit or authorization required under Lebanese law.');
    // Arabic, verbatim -- التأهب per the glossary, never الجاهزية on the event side.
    await expect(outcome).toContainText('تسجيل نتيجة');
    await expect(outcome).toContainText('توجد ثلاث نتائج فقط. ما عداها ليس قراراً.');
    await expect(limits).toContainText('تراجع الوزارة التأهب الصحي والطبي فقط. ويبقى الترخيص بالفعالية لدى السلطة المختصة قانوناً.');
    await expect(limits).toContainText('لا تحل هذه الحالة محل أي تصريح أو ترخيص آخر مطلوب بموجب القانون اللبناني.');
  });

  test('the cardiac unset state reads verbatim, in both languages', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await page.goto('/ministry/admin/cardiac');
    const powersRegion = page.locator('[data-region="powers"]');
    await expect(powersRegion).toContainText('Not set — nothing is in force under this value');
    await expect(powersRegion).toContainText('غير محددة — لا يسري شيء بموجب هذه القيمة');
    await expect(powersRegion).toContainText('Not set — the provisional figure');
    await expect(powersRegion).toContainText('غير محددة — الرقم المؤقت');
  });
});

test.describe('the organizer reads the same determination', () => {
  // The unification the reviewer ordered: a recorded outcome is what the organizer's
  // dashboard and event screen show -- never a stale seeded presentation string.
  test('the dashboard state and the event rail carry the recorded outcome', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await page.goto('/dashboard');
    const body = page.locator('body');
    // EV-0362 carries a recorded revision; the seeded 'Information required' must not show.
    await expect(body).toContainText('Additional information or revision required');
    // EV-0301 carries a recorded satisfied outcome.
    await expect(body).toContainText('Health and medical preparedness requirements satisfied');
    await page.goto('/events/EV-0362');
    // Stage 5 of the rail is the outcome, done, in the compliance form's wording.
    await expect(page.locator('body')).toContainText('Additional information or revision required');
  });
});

test.describe('cardiac configuration', () => {
  test('an unset value is a first-class answer, and publishing records the effective date', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await page.goto('/ministry/admin/cardiac');
    const body = page.locator('body');
    await expect(body).toContainText('Not set — nothing is in force under this value');
    await expect(body).toContainText('provisional figure');

    // Set and publish the corrective-action timeline.
    const power6 = page.locator('[data-region="powers"] > div').nth(5);
    await power6.locator('input[name="value"]').fill('30');
    await power6.locator('input[name="effective"]').fill('2026-10-01');
    await power6.locator('button:has-text("Set and publish")').click();
    await page.waitForURL('**/ministry/admin/cardiac?notice=published');
    await expect(power6).toContainText('30 · effective 2026-10-01');

    // The facility lane now computes due dates from the published timeline.
    await page.goto('/ministry/facilities');
    await expect(page.locator('body')).toContainText('Due dates run 30 days');
  });
});

test.describe('the Order lane and its reviewer', () => {
  test('the lane off shows the Order reviewer suspended, not active', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await page.goto('/ministry/admin/users');
    const users = page.locator('[data-region="users"]');
    await expect(users).toContainText('Dr Y. Salameh');
    await expect(users.locator('div', { hasText: 'Dr Y. Salameh' }).last()).toContainText('Suspended — the lane is off');
  });
});

test.describe('platform activity stays counts only', () => {
  test('no organizer, event or facility is named on the activity screen', async ({ page }) => {
    await signInAs(page, 'test_owner');
    await page.goto('/platform/activity');
    const body = page.locator('body');
    await expect(body).toContainText('Counts only');
    // The demonstration records' names must not leak into the counts surface.
    for (const name of ['Beirut Road Runners', 'Baalbeck', 'Beirut Sports Complex', 'Forum de Beyrouth']) {
      await expect(body).not.toContainText(name);
    }
  });
});
