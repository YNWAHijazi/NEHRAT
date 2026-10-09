/**
 * EVENTS LINK TO SITES (owner, 9 October 2026: "Link between event and facility, no longer
 * venue"; latest revision, sections 16 and 17). Typing in "Venue, route, or location" suggests
 * registered Facility/Sites; "Show all registered sites" opens the full list. Either choice
 * links the event by Site ID. The record page then shows what the site offers, used only once
 * the organizer confirms it applies; the CPR and AED step asks whether the site's AEDs remain
 * accessible and operational throughout the event. The site's operator reads the event -- as
 * text -- on their dashboard. The fixed-venue tick no longer opens a venue selector.
 */

import { expect, test, type Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';
import { expectAbsent } from '../helpers/absence';
import { card, openDetails } from '../helpers/record';

async function fillLabelled(page: Page, en: string, value: string): Promise<void> {
  await page.locator('label', { hasText: en }).first().locator('input, textarea').first().fill(value);
}

function db<T>(fn: (d: DatabaseSync) => T): T {
  const d = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  try { return fn(d); } finally { d.close(); }
}
const siteOf = (facilityId: string): string =>
  db((d) => (d.prepare('SELECT site_id FROM facilities WHERE id = ?').get(facilityId) as { site_id: string }).site_id);
const stored = (eventId: string) =>
  db((d) => d.prepare('SELECT site_id, venue_facility_id FROM events WHERE id = ?').get(eventId) as { site_id: string | null; venue_facility_id: string | null });

test('the location field links a registered site; the record reuses it on the organizer’s word; the operator sees the event', async ({ page }) => {
  test.setTimeout(300_000);
  const beirut = siteOf('FC-0014');
  const jounieh = siteOf('FC-0021');
  // The event is organized by an account that does not hold the Beirut Sports Complex registration.
  await signInAs(page, 'test_organizer_pending');
  await gotoRidingRestarts(page, '/events/new');
  const stamp = Date.now().toString(36);
  const name = `At the complex ${stamp}`;
  await fillLabelled(page, 'Event name (English)', name);
  await fillLabelled(page, 'Event name (Arabic)', `فعالية في المجمّع ${stamp}`);
  await fillLabelled(page, 'Start date', '2026-12-12');
  await fillLabelled(page, 'End date', '2026-12-13');
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');

  const field = page.locator('input[data-field="venueRoute"]');
  const suggestions = page.locator('[data-region="site-suggestions"]');
  const linkLine = page.locator('[data-region="linked-site"]');
  await expect(field).toHaveAttribute('role', 'combobox');

  // 1. Typing suggests the site by name, municipality and Site ID -- never its contacts; a click chooses it.
  await field.click();
  await field.pressSequentially('beirut sp');
  const option = suggestions.locator(`[role="option"][data-site-id="${beirut}"]`);
  await expect(option).toContainText('Beirut Sports Complex');
  await expect(option).toContainText(beirut);
  await expectAbsent(page, { anchor: option, absent: suggestions.getByText('beirutsports.example'), because: 'a suggestion carries no contact details' });
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await option.click();
  await expect(field).toHaveValue('Beirut Sports Complex');
  await expect(linkLine).toContainText(`Registered site: Beirut Sports Complex · ${beirut}`);

  // 2. Remove unlinks and keeps the text; editing the text away from the name unlinks too.
  await linkLine.locator('button[data-action="unlink-site"]').click();
  await expectAbsent(page, { anchor: field, absent: '[data-region="linked-site"]', because: 'Remove unlinks the site' });
  await field.fill('');
  await field.pressSequentially('Corniche run route');
  await expectAbsent(page, { anchor: field, absent: '[data-region="site-suggestions"]', because: 'a route matches no registered site' });

  // 3. Show all registered sites: a modal list searchable by municipality.
  await page.locator('button[data-action="show-all-sites"]').click();
  const dialog = page.locator('dialog[data-region="all-sites-dialog"]');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(true);
  await dialog.locator('input[data-field="allSitesSearch"]').fill('Jounieh');
  await expect(dialog.locator(`button[data-site-id="${jounieh}"]`)).toBeVisible();
  await expectAbsent(page, { anchor: dialog.locator(`button[data-site-id="${jounieh}"]`), absent: dialog.locator(`button[data-site-id="${beirut}"]`), because: 'the search narrows the list by municipality' });
  await dialog.locator('input[data-field="allSitesSearch"]').fill('');
  await dialog.locator(`button[data-site-id="${beirut}"]`).click();
  await expect(dialog).toBeHidden();
  await expect(linkLine).toContainText(beirut);

  // The fixed-venue tick is a description of the event, and opens no venue selector.
  const tick = page.locator('button[aria-pressed]', { hasText: 'It is at a fixed venue that hosts events repeatedly' });
  await tick.click();
  await expectAbsent(page, { anchor: tick, absent: 'select[data-field="hostingVenueId"], [data-region="hosting-venue"]', because: 'the venue selector left with the venue service' });
  await tick.click();

  await fillLabelled(page, 'Municipality or municipalities', 'Beirut');
  await fillLabelled(page, 'Expected participants', '30');
  await fillLabelled(page, 'Expected spectators', '150');
  await fillLabelled(page, 'Expected staff and volunteers', '10');
  const zeros = page.locator('button[aria-pressed]:has(span:text-is("0"))');
  const zeroCount = await zeros.count();
  for (let i = 0; i < zeroCount; i += 1) await zeros.nth(i).click();
  await fillLabelled(page, 'Authorized representative', 'S. Khoury');
  await fillLabelled(page, 'Position', 'Secretary');
  await page.locator('button:has-text("Continue to requirements")').first().click();
  await page.waitForURL(/\/events\/EV-\d+$/);
  const eventId = new URL(page.url()).pathname.split('/')[2]!;

  // Stored by Site ID; the facility on the site is the event's facility reference.
  expect(stored(eventId)).toEqual({ site_id: beirut, venue_facility_id: 'FC-0014' });
  await expect(page.locator('[data-region="details-assessment"] [data-region="event-site"]')).toContainText(`Site: Beirut Sports Complex · ${beirut}`);

  // SITE INFORMATION: read from the site record, not used until confirmed.
  const block = page.locator('[data-region="site-information"]');
  await expect(block).toHaveAttribute('data-confirmed', 'no');
  await expect(block.locator('[data-region="site-information-list"]')).toContainText('Avenue du Parc');
  await expect(block.locator('[data-region="site-aeds"] li')).toHaveCount(3);
  await expect(block.locator('[data-region="site-confirmation-state"]')).toContainText('Not confirmed for this event');
  await block.locator('input[name="applies"]').check();
  await block.locator('textarea[name="differences"]').fill('A temporary stage on the north lawn.');
  await block.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/saved=site/);
  await expect(page.locator('[data-region="site-information"]')).toHaveAttribute('data-confirmed', 'yes');
  await expect(page.locator('[data-region="site-differences"]')).toContainText('A temporary stage on the north lawn.');

  // THE CPR AND AED STEP: the site's AEDs, and the organizer's one question.
  const b8 = await openDetails(card(page, 'B8'));
  const question = b8.locator('[data-region="site-aeds-question"]');
  await expect(question).toContainText('This site has 3 registered AEDs');
  await expect(question.locator('[data-region="site-aeds"] li')).toHaveCount(3);
  const ask = question.locator('[data-region="site-aed-form"]');
  await expect(ask).toContainText('Will these AEDs remain accessible and operational throughout this event?');
  await ask.locator('[data-choice="yes"]').click();
  await ask.locator('[data-region="save"]').click();
  await expect(ask.locator('[role="status"]')).toContainText('Saved');
  await expect(question).toHaveAttribute('data-answer', 'yes');
  await expect(question.locator('[data-region="site-aeds-reused"]')).toContainText('These AEDs are used for the AED part of this step.');
  // The row's own form still exists below the question; it reads the site's AEDs now.
  await expect(b8.locator('[data-region="requirement-form"][data-key="B8"] [data-choice="yes"]')).toHaveAttribute('aria-pressed', 'true');

  // The edit-details screen opens on the link.
  await gotoRidingRestarts(page, `/events/${eventId}/edit`);
  await expect(page.locator('input[data-field="venueRoute"]')).toHaveValue('Beirut Sports Complex');
  await expect(page.locator('[data-region="linked-site"]')).toContainText(beirut);

  // The site's operator reads the event on their dashboard: text, no link into the record.
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/dashboard');
  const section = page.locator('[data-region="events-at-your-sites"]');
  await expect(section.locator('h2')).toContainText('Events at your sites');
  const row = section.locator(`[data-site-id="${beirut}"] li[data-event-id="${eventId}"]`);
  await expect(row).toContainText(name);
  await expect(row).toContainText(eventId);
  await expect(row).toContainText('2026-12-12 – 2026-12-13');
  await expect(row).toContainText('Level 1');
  await expect(section.locator(`[data-site-id="${beirut}"] h3`)).toContainText(`Beirut Sports Complex · ${beirut}`);
  await expectAbsent(page, { anchor: row, absent: row.locator('a'), because: 'the site operator has no access to the event record' });
  await expectAbsent(page, { anchor: row, absent: row.getByText('S. Khoury'), because: 'the organizer’s details are not the operator’s to read' });
  // No venue is an active entity on the dashboard.
  await expectAbsent(page, { anchor: section, absent: '[data-region="events-at-your-venues"], a[href="/venues/new"]', because: 'hosting venue registration is replaced by facility/site registration' });
});

test('“Create event at this site” opens the form linked to the site; an unlistable site opens unlinked', async ({ page }) => {
  const beirut = siteOf('FC-0014');
  await signInAs(page, 'test_organizer_pending');
  await gotoRidingRestarts(page, `/events/new?site=${beirut}`);
  await expect(page.locator('input[data-field="venueRoute"]')).toHaveValue('Beirut Sports Complex');
  await expect(page.locator('[data-region="linked-site"]')).toContainText(beirut);
  await gotoRidingRestarts(page, '/events/new?site=SITE-999999');
  await expect(page.locator('input[data-field="venueRoute"]')).toHaveValue('');
  await expectAbsent(page, { anchor: 'input[data-field="venueRoute"]', absent: '[data-region="linked-site"]', because: 'a site that is not listable is not linked' });
});

test('the Ministry’s review shows the site information the event relied on when it was filed', async ({ page }) => {
  // A frozen snapshot on a filed demonstration submission: what the reviewer reads is the
  // snapshot, not the live site record.
  const snapshot = {
    takenAt: '2026-08-20 10:00:00', submissionVersion: 1, siteId: 'SITE-000999', facilityId: 'FC-0999', facilityRevision: 2,
    information: {
      siteId: 'SITE-000999', facilityId: 'FC-0999', nameEn: 'Snapshot Arena', nameAr: 'حلبة النسخة', address: 'Harbour road', municipalityEn: 'Byblos', municipalityAr: 'جبيل',
      point: { lat: 34.12, lng: 35.65 }, licensedCapacity: 4000, accessPoint: 'Gate A', emergencyAccess: 'From the harbour road', ambulanceWaiting: '', patientAccess: 'Ramp to gate A', stretcherRoutes: '',
      layoutMap: { fileName: 'arena-layout.pdf', uploadedAt: '2026-08-01' },
      aeds: [{ label: 'AED-001', locationEn: 'Main entrance', locationAr: 'المدخل الرئيسي', publiclyAccessible: true, statusEn: 'Operational', statusAr: 'صالح للتشغيل', statusKey: 'operational' }],
      anyPediatric: false, facilityRevision: 2, infrastructureUpdatedAt: '2026-08-01',
    },
    confirmation: { confirmed: true, differences: 'Temporary stage on the quay.', confirmedAt: '2026-08-19 09:00:00', confirmedByName: 'R. Haddad' },
    aedReuse: 'yes',
  };
  const sub = db((d) => d.prepare(`SELECT version FROM submissions WHERE event_id = 'EV-0362'`).get() as { version: number });
  db((d) => d.prepare(`INSERT OR REPLACE INTO event_site_snapshots (event_id, submission_version, site_id, facility_id, snapshot, taken_at) VALUES ('EV-0362', ?, (SELECT id FROM sites LIMIT 1), 'FC-0999', ?, '2026-08-20 10:00:00')`).run(sub.version, JSON.stringify(snapshot)));
  try {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const panel = page.locator('[data-region="review-site-snapshot"]');
    await expect(panel).toContainText('Site information relied on');
    await expect(panel).toContainText('Snapshot Arena · SITE-000999');
    await expect(panel).toContainText('Ramp to gate A');
    await expect(panel).toContainText('AED-001');
    await expect(panel).toContainText('Temporary stage on the quay.');
    await expect(panel).toContainText('site record revision 2');
  } finally {
    db((d) => d.prepare(`DELETE FROM event_site_snapshots WHERE event_id = 'EV-0362' AND facility_id = 'FC-0999'`).run());
  }
});
