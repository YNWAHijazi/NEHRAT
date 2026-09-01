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
import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { expectAbsent } from '../helpers/absence';
import { signInAs } from '../helpers/signin';


test.describe('the outcome gate', () => {
  // One serial flow: the same record is asserted gated, then unblocked step by
  // step, then asserted open -- separate tests on one mutating record would race
  // across parallel workers. The gate has TWO classes of blocker on this record:
  // three pending attestations and a blocking inspection. Clearing one class must
  // NOT open the gate; that partial state is asserted deliberately, because the
  // attestation class previously existed only in a docstring and a green suite
  // proved nothing about it.
  test('satisfied is gated on attestations and findings together, and opens only when both clear', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');

    // THE PLAN IS READABLE ON THE REVIEW SCREEN. For a slice it was not: the reviewer
    // recorded outcomes about a document this screen never showed, and the recorded
    // revision note even cited plan content the reviewer could not see. The panel is
    // read-only -- the sixteen sections with their states, the eleven major-incident
    // items, and the attached file where the organizer attached one.
    const plan = page.locator('[data-region="review-plan"]');
    await expect(plan).toContainText('Event health and medical plan');
    await expect(plan).toContainText('Major-incident and mass-casualty plan — eleven items');
    // EV-0362's seeded plan addresses all sixteen and confirms all eleven.
    await expect(plan.locator('text=Not addressed')).toHaveCount(0);
    // Read-only: no form, no input, nothing the Ministry can edit.
    await expect(plan.locator('form, input, textarea, button')).toHaveCount(0);

    // The panel, with the reference's own summary line.
    const att = page.locator('[data-region="attestations"]');
    await expect(att).toContainText('3 of 6 pending · 2 held by the Ministry, 1 by the Order of Physicians');
    // A complete row's title and byline, verbatim -- the string half of the att-row
    // region, whose pixel compare is held for geometry only.
    await expect(att).toContainText('Major-incident and mass-casualty plan reviewed');
    await expect(att).toContainText('Attested by L. Nassar · 2026-08-11');
    // A deficiency renders as the reason an item is pending -- not a third state.
    await expect(att).toContainText('Pending because');
    await expect(att).toContainText('the deployment map has not been attached');
    // The Order-assigned pending item carries the lane fallback, and is therefore
    // attestable by the reviewer while the lane is off (open decision 19).
    await expect(att).toContainText('Assigned to the Order of Physicians, whose lane is off');

    // EV-0362 carries a determination, so the FIRST-recording panel is not offered
    // here -- recording is once. The same three options, gated by the same blockers,
    // are in the revision panel, and the blockers are named there for the same
    // reason (non-negotiable 10).
    const revise = page.locator('[data-region="revise-determination"]');
    await revise.locator('summary').click();
    await expect(revise).toContainText('Blocking inspection without recorded findings');
    await expect(revise).toContainText('Attestation pending');
    const radios = page.locator('[data-region="outcome-options"] input[type="radio"]');
    await expect(radios.nth(0)).toBeEnabled(); // incomplete
    await expect(radios.nth(1)).toBeEnabled(); // revision
    await expect(radios.nth(2)).toBeDisabled(); // satisfied -- gated
    // The two limit sentences ride wherever an outcome is recorded.
    await expect(page.locator('[data-region="limits"]')).toContainText(
      'Authorization of the event remains with the legally competent authority',
    );

    // The reviewer attests the three pending items, the Order-assigned one last.
    for (const item of ['deploymentMap', 'emsDeclarations', 'clinicalContent']) {
      const form = att.locator(`form:has(input[name="itemKey"][value="${item}"]):has(input[value="attest"])`);
      await form.locator('button').click();
      await page.waitForURL('**/ministry/submissions/EV-0362');
    }
    await expect(att).toContainText('All six attestations complete — a clearance may be recorded.');

    // Attestations clear, inspection still open: the gate must STILL be shut.
    const revise2 = page.locator('[data-region="revise-determination"]');
    await revise2.locator('summary').click();
    await expect(revise2).toContainText('Blocking inspection without recorded findings');
    await expect(revise2).not.toContainText('Attestation pending');
    await expect(page.locator('[data-region="outcome-options"] input[type="radio"]').nth(2)).toBeDisabled();

    // The reviewer records the findings -- corrective actions and findings are
    // reviewer acts since the merge (partner review, 2026-09-01), and still not an
    // outcome. The submission stays open under the same account.
    const blocking = page.locator('[data-region="inspections"] > div').first();
    await blocking.locator('input[name="findings"]').fill('Treatment post and deployment verified as planned.');
    await blocking.locator('button:has-text("Save")').click();
    await page.waitForURL('**/ministry/submissions/EV-0362');

    // Both classes clear: the gate opens for the reviewer.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    // Generous under full-suite dev-compile load; the state itself is instant. The
    // review screen now compiles the plan and attestation panels too, and 15s was
    // measured too tight on the full run.
    await expect(page.locator('[data-region="outcome-options"] input[type="radio"]').nth(2)).toBeEnabled({ timeout: 30_000 });

    // COMPLETION IS CORRECTABLE. A deficiency recorded against a complete item
    // returns it to pending and shuts the gate again -- an attestation recorded in
    // error must not stand forever because it was recorded.
    const attNow = page.locator('[data-region="attestations"]');
    const reopen = attNow.locator('form:has(input[name="itemKey"][value="deploymentMap"]):has(input[value="deficiency"])');
    await reopen.locator('input[name="reason"]').fill('The attached map omits the second treatment post.');
    await reopen.locator('button').click();
    await page.waitForURL('**/ministry/submissions/EV-0362');
    await expect(attNow).toContainText('1 of 6 pending');
    await expect(attNow).toContainText('The attached map omits the second treatment post.');
    await expect(page.locator('[data-region="outcome-options"] input[type="radio"]').nth(2)).toBeDisabled();

    // And re-attesting reopens the gate, leaving the record clean for later tests.
    const reattest = attNow.locator('form:has(input[name="itemKey"][value="deploymentMap"]):has(input[value="attest"])');
    await reattest.locator('button').click();
    await page.waitForURL('**/ministry/submissions/EV-0362');
    await expect(page.locator('[data-region="outcome-options"] input[type="radio"]').nth(2)).toBeEnabled({ timeout: 15_000 });
  });

  test('below Level 3 the attestation panel is the explicit empty state, not nothing', async ({ page }) => {
    await signInAs(page, 'test_moph');
    // EV-0455, the Level 2 filed-and-unreviewed submission.
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0455');
    const empty = page.locator('[data-region="attestations-empty"]');
    await expect(empty).toContainText('No attestation items apply to this submission.');
    await expect(empty).toContainText('Level 2');
    await expectAbsent(page, {
      absent: '[data-region="attestations"]',
      anchor: '[data-region="attestations-empty"]',
      because: 'no attestation item applies at Level 2, so the row set is absent entirely',
    });
  });
});

test.describe('internal states and determinations', () => {
  test('the queue distinguishes grey workflow states from recorded outcomes', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/queue');
    const queue = page.locator('[data-region="queue"]');
    // All three seeded filings now carry recorded determinations, matching the
    // reference: EV-0362 revision, EV-0244 satisfied, EV-0301 incomplete.
    await expect(queue).toContainText('Additional information or revision required');
    await expect(queue).toContainText('Health and medical preparedness requirements satisfied');
    await expect(queue).toContainText('Submission received but incomplete');
    // Never approved, never rejected.
    await expect(queue).not.toContainText(/approved|rejected/i);

    // And the grey internal state, in the queue, on the one filed submission with no
    // determination against it (EV-0455). It is demonstration data rather than a
    // prototype match: the reference's in-progress row is Beirut Coastal 12K, and the
    // two prototype files disagree about that event -- the Ministry file has it FILED
    // and in progress, the Organizer Journey has it at stage 3 with no reference number
    // -- so EV-0418 stays unfiled and this fifth event carries the state instead.
    await expect(queue).toContainText('In queue');

    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const state = page.locator('[data-region="review-state"]');
    await expect(state).toBeVisible();
    await expect(state).not.toContainText(/approved|rejected/i);
  });
});

test.describe('the pinned vocabulary', () => {
  // The reviewer's ratchet on the two panels that carry the vocabulary and the
  // unset state: exact strings, both languages. The EN limits are ALSO
  // pixel-compared (visual manifest, ministry-review.outcome-limits); the Arabic
  // rides here until the prototype's glossary defect is corrected in Pass C.
  test('the outcome card and the limit sentences read verbatim, in both languages', async ({ page }) => {
    await signInAs(page, 'test_moph');
    // EV-0455 is filed with NOTHING recorded, so the recording panel and its copy are
    // on screen. EV-0362 already carries a determination and offers the revision.
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0455');
    const outcome = page.locator('[data-region="outcome"]');
    await expect(outcome).toContainText('Record an outcome');
    await expect(outcome).toContainText('Three outcomes exist. Nothing else is a determination.');
    const limits = page.locator('[data-region="limits"]');
    await expect(limits).toContainText('The Ministry reviews health and medical preparedness only. Authorization of the event remains with the legally competent authority.');
    await expect(limits).toContainText('This status does not replace any other permit or authorization required under Lebanese law.');
    // Arabic, verbatim -- التأهب per the glossary, never الجاهزية on the event side.
    await expect(outcome).toContainText('تسجيل نتيجة');
    await expect(outcome).toContainText('توجد ثلاث نتائج فقط. ما عداها ليس قراراً.');
    await expect(limits).toContainText('تراجع الوزارة التأهب الصحي والطبي فقط. يبقى ترخيص الفعالية من صلاحية السلطة المختصة قانوناً.');
    await expect(limits).toContainText('لا تحل هذه الحالة محل أي ترخيص أو إذن آخر مطلوب بموجب القانون اللبناني.');
  });

  test('the cardiac unset state reads verbatim, in both languages', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/cardiac');
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
    await gotoRidingRestarts(page, '/dashboard');
    const body = page.locator('body');
    // EV-0362 carries a recorded revision; the seeded 'Information required' must not show.
    await expect(body).toContainText('Additional information or revision required');
    // The awaiting-your-response panel shows the RECORDED note verbatim -- it used to
    // hard-code a demonstration demand regardless of what the reviewer wrote.
    await expect(body).toContainText('The medical deployment map has not been attached');
    // EV-0244 (Tripoli Marathon) carries a recorded satisfied outcome; EV-0301
    // (Saida Night Run) carries incomplete. Both are the organizer's own records.
    await expect(body).toContainText('Health and medical preparedness requirements satisfied');
    await gotoRidingRestarts(page, '/events/EV-0362');
    // Stage 5 of the rail is the outcome, done, in the compliance form's wording.
    await expect(page.locator('body')).toContainText('Additional information or revision required');
  });
});

test.describe('cardiac configuration', () => {
  test('an unset value is a first-class answer, and publishing records the effective date', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/cardiac');
    const body = page.locator('body');
    await expect(body).toContainText('Not set — nothing is in force under this value');
    await expect(body).toContainText('provisional figure');

    // Set and publish the corrective-action timeline. Selected by the power's own text,
    // not by row index: the rows are eleven for ten powers (11.3 renders as its two
    // limbs), so an index silently addressed the wrong power the moment that changed.
    const power6 = page
      .locator('[data-region="powers"] > div')
      .filter({ hasText: 'Set corrective-action timelines' });
    await power6.locator('input[name="value"]').fill('30');
    await power6.locator('input[name="effective"]').fill('2026-10-01');
    await power6.locator('button:has-text("Set and publish")').click();
    await page.waitForURL('**/ministry/admin/cardiac?notice=published');
    await expect(power6).toContainText('30 · effective 2026-10-01');

    // The facility lane now computes due dates from the published timeline.
    await gotoRidingRestarts(page, '/ministry/facilities');
    await expect(page.locator('body')).toContainText('Due dates run 30 days');
  });
});

test.describe('the Order lane and its reviewer', () => {
  test('the lane off shows the Order reviewer suspended, not active', async ({ page }) => {
    await signInAs(page, 'test_moph_admin');
    await gotoRidingRestarts(page, '/ministry/admin/users');
    const users = page.locator('[data-region="users"]');
    await expect(users).toContainText('Dr Y. Salameh');
    await expect(users.locator('div', { hasText: 'Dr Y. Salameh' }).last()).toContainText('Suspended — the lane is off');
  });
});

test.describe('platform activity stays counts only', () => {
  test('no organizer, event or facility is named on the activity screen', async ({ page }) => {
    await signInAs(page, 'test_owner');
    await gotoRidingRestarts(page, '/platform/activity');
    const body = page.locator('body');
    await expect(body).toContainText('Counts only');
    // The demonstration records' names must not leak into the counts surface.
    for (const name of ['Beirut Road Runners', 'Baalbeck', 'Beirut Sports Complex', 'Forum de Beyrouth']) {
      await expect(body).not.toContainText(name);
    }
  });
});

test.describe('scheduling an inspection', () => {
  test('is a peer control above Require additional measures, with who conducts it', async ({ page }) => {
    // It used to be a disclosure at the foot of the inspection list with three inputs
    // and no way to say who conducts it. Since the merge (partner review, 2026-09-01)
    // the reviewer flags a submission as needing inspection and can self-assign the
    // visit -- the conductor select is how, and it still names WHO conducts.
    await signInAs(page, 'test_moph');
    // EV-0301 is test_organizer's and none of its routes are pixel-compared, so the
    // organizer half of this can be walked without disturbing a reference comparison.
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0301');
    const form = page.locator('[data-region="schedule-inspection"]');
    await expect(form).toBeVisible();
    await expect(form.locator('select[name="inspector"]')).toBeVisible();
    await expect(form.locator('input[name="date"]')).toBeVisible();
    await expect(form.locator('input[name="blocking"]')).toBeVisible();

    // A unique title: this test SCHEDULES, so a second run against the same database
    // would match two rows and the count assertion would read as a defect.
    const title = `Deployment walk-through ${Date.now().toString(36)}`;
    await form.locator('input[name="titleEn"]').fill(title);
    await form.locator('input[name="titleAr"]').fill('جولة على الانتشار');
    await form.locator('input[name="blocking"]').check();
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/notice=inspection-scheduled/);

    // Asserted by CONTENT, not by a count delta: the region's children include an
    // empty state before the first inspection and an owner note for roles that cannot
    // schedule, so the child count is not the number of inspections.
    const row = page.locator('[data-region="inspections"] > div', { hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Blocking');

    // A BLOCKING INSPECTION WITH NO FINDINGS gates the satisfied outcome and nothing
    // else -- the other two determinations stay available throughout.
    // EV-0301 carries a determination, so the gate shows on the REVISION panel: a
    // blocking inspection with no findings gates the satisfied outcome whether the
    // determination is a first one or a revision.
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0301');
    const gated = page.locator('[data-region="revise-determination"]');
    await gated.locator('summary').click();
    await expect(gated).toContainText(title);
  });

  test('the organizer is told, rather than finding out on the day', async ({ page }) => {
    // An inspection scheduled on a submission and never mentioned to the party being
    // inspected is an outstanding thing with no owner on the side that accommodates it.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/notifications');
    await expect(page.locator('body')).toContainText('An inspection has been scheduled');
  });
});
