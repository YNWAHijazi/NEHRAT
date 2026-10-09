/**
 * THE FACILITY/SITE REGISTRATION, end to end (owner decision, 9 October 2026; latest revision,
 * sections 8-15):
 *
 *  - "Submit Facility/Site registration to MOPH" makes a numbered version, lands on the
 *    acknowledgment of receipt, and the site enters the Facility/Site review queue;
 *  - the Ministry reads one consolidated record and records an outcome with the event's
 *    outcome form: asks for information (the record reopens and the operator submits the
 *    revised registration), accepts it -- Readiness current, and the same address becomes the
 *    site's dashboard -- raises a corrective action and records an inspection;
 *  - the operator answers the corrective action with evidence; the Ministry closes it with
 *    what was verified, and the certificate becomes available;
 *  - the site dashboard's tabs: the overview's figures, the events held at the site (another
 *    organizer's event shows only its name, dates, record id, level and status), the
 *    documents, the Ministry history, and an incident linked to its AED and its event.
 */
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { recordReadiness, registerAed, registerFacility, submitRegistration } from '../helpers/facility-map';
import { expectAbsent } from '../helpers/absence';

const status = (page: Page) => page.locator('[data-region=facility-workspace-header] [data-region=site-status]');
const reviewStatus = (page: Page) => page.locator('[data-region=site-review-header] [data-region=site-status]');
const pdf = { name: 'readiness-letter.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') };

test('a site is submitted, reviewed by the Ministry, corrected and accepted', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);
  await registerAed(page, 'REVIEW-SERIAL-1', 'Main entrance');
  await recordReadiness(page);
  await submitRegistration(page);
  await expect(page.locator('[data-region=status-chip]')).toHaveAttribute('data-status', 'submitted');
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'submitted');

  // THE QUEUE AND THE CONSOLIDATED RECORD.
  await signInAs(page, 'test_moph');
  await page.goto('/ministry/facilities');
  await page.locator('[data-region=site-queue-link]').click();
  const row = page.locator(`[data-queue-row=${id}]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/ministry/facilities/${id}$`));
  for (const section of ['site', 'readiness', 'aeds', 'evidence', 'history']) await expect(page.locator(`[data-region=review-${section}]`)).toBeVisible();
  await expect(page.locator('[data-region=review-applicability]')).toHaveAttribute('data-applicability', 'covered');
  await expect(page.locator('[data-region=review-aed-list]')).toContainText('REVIEW-SERIAL-1');
  await expect(page.locator('[data-region=evidence-statement]')).toBeVisible();
  await expect(page.locator('[data-region=submission-versions]')).toContainText('Version 1');
  // No event outcome is offered here.
  await expectAbsent(page, { anchor: '[data-region=review-actions]', absent: page.getByText('Health and medical preparedness requirements satisfied'), because: 'site statuses are product-defined, never the event outcomes' });

  await page.locator('[data-act=start]').click();
  await expect(page).toHaveURL(/notice=started/);
  await expect(reviewStatus(page)).toHaveAttribute('data-status', 'underReview');
  // The outcome form, as on an event submission: a request carries its note to the operator.
  await page.locator('input[data-outcome=information]').check();
  await page.locator('[data-region=outcome] textarea[name=note]').fill('Attach the licence that states the opening hours.');
  await page.locator('[data-act=outcome]').click();
  await expect(page).toHaveURL(/notice=information/);
  await expect(reviewStatus(page)).toHaveAttribute('data-status', 'informationRequired');

  // RETURNED: THE RECORD REOPENS FOR REVISION, as a returned event's does, and is submitted again.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'informationRequired');
  await expect(page.locator('[data-region=determination-card]')).toHaveAttribute('data-outcome', 'infoRequested');
  await expect(page.locator('[data-region=determination-note]')).toContainText('Attach the licence that states the opening hours.');
  await expect(page.locator('[data-region=next-action]')).toHaveAttribute('data-next-action', 'information');
  await page.goto(`/facilities/${id}?step=review`);
  await expect(page.locator('[data-region=revision-band]')).toBeVisible();
  await expect(page.locator('[data-region=submit-registration] [data-l=en]')).toContainText('Submit the revised registration to MOPH');
  await submitRegistration(page);
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'submitted');

  // ACCEPTED, THEN A CORRECTIVE ACTION AND AN INSPECTION.
  await signInAs(page, 'test_moph');
  await page.goto(`/ministry/facilities/${id}`);
  await expect(page.locator('[data-region=submission-versions]')).toContainText('Version 2');
  await page.locator('input[data-outcome=accept]').check();
  await page.locator('[data-region=outcome] textarea[name=note]').fill('Registration and readiness record complete.');
  await page.locator('[data-act=outcome]').click();
  await expect(page).toHaveURL(/notice=accepted/);
  await expect(reviewStatus(page)).toHaveAttribute('data-status', 'readinessCurrent');
  await expect(page.locator('[data-region=determinations] [data-decision=accepted]')).toContainText('Registration and readiness record complete.');
  await page.locator('[data-region=corrective-panel] summary').click();
  await page.locator('[data-region=corrective-form] input[name=deficiency]').fill('AED inaccessible during operating hours');
  await page.locator('[data-region=corrective-form] input[name=action]').fill('Keep the AED cabinet unlocked during operating hours.');
  await page.locator('[data-act=corrective]').click();
  await expect(page).toHaveURL(/notice=corrective/);
  await expect(reviewStatus(page)).toHaveAttribute('data-status', 'correctiveActionRequired');
  await page.locator('[data-region=inspection-panel] summary').click();
  await page.locator('[data-region=inspection-form] input[name=date]').fill('2026-08-12');
  await page.locator('[data-region=inspection-form] textarea[name=findings]').fill('Cabinet found locked at 18:00.');
  await page.locator('[data-act=inspection]').click();
  await expect(page).toHaveURL(/notice=inspection/);
  await expect(page.locator('[data-region=review-acts]')).toContainText('Cabinet found locked at 18:00.');

  // ACCEPTED, THE SAME ADDRESS IS THE SITE'S DASHBOARD; the operator answers the corrective action with evidence.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'correctiveActionRequired');
  for (const tab of ['overview', 'readiness', 'aeds', 'events', 'incidents', 'documents', 'history']) await expect(page.locator(`[data-region=site-tabs] [data-tab=${tab}]`)).toBeVisible();
  await expectAbsent(page, { anchor: '[data-region=site-tabs]', absent: '[data-region=record-stepper]', because: 'an accepted site is maintained from its dashboard, not re-registered' });
  await page.locator('[data-region=next-action] a').click();
  await expect(page).toHaveURL(/tab=history/);
  const action = page.locator('[data-request][data-kind=corrective]');
  await expect(action).toContainText('AED inaccessible during operating hours');
  await expect(action).toContainText('No due date: the Ministry has not published a corrective-action timeline.');
  await action.locator('textarea[name=note]').fill('The lock is removed; the cabinet carries a breakable seal.');
  await action.locator('input[name=evidence]').setInputFiles(pdf);
  await action.getByRole('button', { name: 'Send the answer to the Ministry', exact: true }).click();
  await expect(page).toHaveURL(/notice=response/);
  await expect(page.locator('[data-request][data-kind=corrective] [data-region=request-status]')).toContainText('Open — answered, awaiting Ministry verification');
  await expect(page.locator('[data-request][data-kind=corrective] [data-region=request-responses]')).toContainText('readiness-letter.pdf');

  // THE MINISTRY CLOSES IT WITH WHAT WAS VERIFIED.
  await signInAs(page, 'test_moph');
  await page.goto(`/ministry/facilities/${id}`);
  const open = page.locator('[data-request][data-kind=corrective]');
  await expect(open.locator('[data-region=request-responses]')).toContainText('breakable seal');
  await open.locator('[data-region=close-corrective] input[name=verified]').fill('Seal fitted; the cabinet opens without a key.');
  await open.getByRole('button', { name: 'Close — record what was verified', exact: true }).click();
  await expect(page).toHaveURL(/notice=closed/);
  await expect(reviewStatus(page)).toHaveAttribute('data-status', 'readinessCurrent');

  // READINESS CURRENT: the operator reads the closure, and the certificate is available.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}?tab=history`);
  await expect(page.locator('[data-request][data-kind=corrective] [data-region=request-verified]')).toContainText('Verified: Seal fitted; the cabinet opens without a key.');
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'readinessCurrent');
  await page.locator('[data-region=registered-band] a').click();
  await expect(page.locator('[data-region=certificate]')).toContainText('Readiness current');
  await expect(page.locator('[data-region=certificate-verification] a')).toHaveAttribute('href', /\/lookup\/facility\/[a-f0-9]{48}$/);
});

test('the site dashboard: overview, events at the site, documents, history and a linked incident', async ({ page }) => {
  page.setDefaultTimeout(15000);
  // Two events on the seeded sports complex's site: one of the organizer's own, one of another organizer's.
  const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  // The schema's triggers stamp on the platform's clock; this connection lends them one.
  db.function('now_stamp', () => '2026-08-13 12:00:00');
  let site = '';
  let upcoming = 0;
  try {
    site = (db.prepare(`SELECT site_id FROM facilities WHERE id = 'FC-0014'`).get() as { site_id: string }).site_id;
    const own = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`).get() as { id: number }).id;
    const other = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer_pending'`).get() as { id: number }).id;
    db.prepare(`INSERT OR IGNORE INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9801', ?, 'Another organizer’s gala', 'حفل منظّم آخر', '2026-09-20', '2026-09-20', 1, ?)`).run(other, site);
    db.prepare(`INSERT OR IGNORE INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9802', ?, 'Our open day', 'يومنا المفتوح', '2026-09-27', '2026-09-27', 1, ?)`).run(own, site);
    // Other specs may link events to this shared site too; the overview's count is the database's, on the review clock.
    upcoming = (db.prepare(`SELECT COUNT(*) AS n FROM events WHERE site_id = ? AND is_demo = 1 AND archived_at IS NULL AND lifecycle <> 'cancelled' AND COALESCE(end_date, start_date) >= '2026-08-13'`).get(site) as { n: number }).n;
  } finally { db.close(); }

  await signInAs(page, 'test_organizer');
  await page.goto('/facilities/FC-0014');
  // OVERVIEW: the revision's figures.
  await expect(page.locator('[data-region=facility-workspace-header] [data-region=site-id]')).toHaveText(site);
  await expect(page.locator('[data-overview=site-id]')).toContainText(site);
  await expect(page.locator('[data-overview=readiness]')).toContainText('Corrective action required');
  await expect(page.locator('[data-overview=aeds]')).toContainText('2 operational');
  await expect(page.locator('[data-overview=corrective]')).toContainText('1');
  expect(upcoming).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-overview=events] dd')).toHaveText(String(upcoming));
  await expect(page.locator('[data-region=maintenance]')).toBeVisible();

  // EVENTS: the owner's own event links to its record; another organizer's shows five facts and no link.
  await page.locator('[data-tab=events]').click();
  await expect(page.locator('[data-region=create-event-at-site]')).toHaveAttribute('href', `/events/new?site=${site}`);
  const others = page.locator('[data-event-row=EV-9801]');
  await expect(others).toContainText('Another organizer’s gala');
  await expect(others.locator('a')).toHaveCount(0);
  await expect(page.locator('[data-region=site-events]')).toContainText('EV-9801');
  await expect(page.locator('[data-region=site-events]')).toContainText('2026-09-20');
  await expect(page.locator('[data-event-row=EV-9802] a')).toHaveAttribute('href', '/events/EV-9802');

  // DOCUMENTS: optional evidence, typed, with the third-party statement.
  await page.locator('[data-tab=documents]').click();
  const upload = page.locator('[data-region=evidence-upload]');
  await upload.locator('select[name=docType]').selectOption('thirdPartyCertificate');
  await upload.locator('input[name=issuer]').fill('Independent readiness assessor');
  await upload.locator('input[name=reviewDate]').fill('2027-08-01');
  await upload.locator('input[name=document]').setInputFiles(pdf);
  await upload.getByRole('button', { name: 'Upload the document', exact: true }).click();
  await expect(page).toHaveURL(/tab=documents&notice=evidence/);
  await expect(page.locator('[data-region=evidence-list]')).toContainText('Third-party readiness certificate');
  await expect(page.locator('[data-region=evidence-list]')).toContainText('Issued by Independent readiness assessor');
  await expect(page.locator('[data-region=evidence-statement]')).toContainText('A third-party document is supporting evidence only.');

  // MINISTRY HISTORY: the seeded acceptance and the open poolside request.
  await page.locator('[data-tab=history]').click();
  await expect(page.locator('[data-region=review-acts]')).toContainText('Registration accepted — readiness current');
  await expect(page.locator('[data-region=site-requests]')).toContainText('poolside AED cabinet');

  // AN INCIDENT LINKED TO ITS AED AND TO THE EVENT HELD AT THE SITE.
  await page.locator('[data-tab=incidents]').click();
  await page.locator('[data-region=report-incident]').click();
  await expect(page.locator('[data-region=incident-site]')).toHaveText(site);
  await page.locator('select[name=deviceLabel]').selectOption('AED-001');
  await page.locator('select[name=eventId]').selectOption('EV-9801');
  await page.locator('input[name=date]').fill('2026-08-12');
  await page.locator('input[name=time]').fill('19:30');
  await page.locator('input[name=location]').fill('Main entrance lobby');
  for (const region of ['immediate-response', 'ems-attendance', 'post-incident']) for (const b of await page.locator(`[data-region=${region}]`).getByRole('button', { name: 'Yes', exact: true }).all()) await b.click();
  await page.getByRole('button', { name: 'EMS ambulance', exact: true }).click();
  await page.locator('textarea[name=corrective]').fill('Restock the pads used.');
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(page).toHaveURL(/tab=incidents&notice=incident/);
  const report = page.locator('[data-region=incidents] details').first();
  await report.locator('summary').click();
  await expect(report.locator('[data-region=incident-links]')).toContainText('AED: AED-001');
  await expect(report.locator('[data-region=incident-links]')).toContainText('Event: EV-9801');
});
