/**
 * EVENTS AT A SITE, HIGH LEVEL ONLY (owner, 10 October 2026): the site owner reads each event's
 * name, dates and record id, and whether it is planned or scheduled -- never the organizer's
 * steps or level. Once the Ministry has completed its review the event is scheduled, with a
 * receipt the site owner can open and print. Event outcome wording never reaches the facility side.
 */
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { expectAbsent } from '../helpers/absence';

test('a scheduled event at the site shows its receipt; a planned one shows no steps', async ({ page }) => {
  page.setDefaultTimeout(15000);
  const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  db.function('now_stamp', () => '2026-08-13 12:00:00');
  let site = '';
  try {
    site = (db.prepare(`SELECT site_id FROM facilities WHERE id = 'FC-0014'`).get() as { site_id: string }).site_id;
    const other = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer_pending'`).get() as { id: number }).id;
    db.prepare(`INSERT OR IGNORE INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id, filed, moph_reference) VALUES ('EV-9821', ?, 'Harbour concert', 'حفل المرفأ', '2026-10-03', '2026-10-03', 1, ?, 1, 'MOPH-EV-2026-9821')`).run(other, site);
    db.prepare(`INSERT OR IGNORE INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9822', ?, 'Autumn fun run', 'جري الخريف', '2026-10-10', '2026-10-10', 1, ?)`).run(other, site);
    if (!db.prepare(`SELECT 1 FROM determinations WHERE event_id = 'EV-9821'`).get()) {
      db.prepare(`INSERT INTO determinations (event_id, outcome, note, recorded_by, recorded_at) VALUES ('EV-9821', 'satisfied', '', 'R. Haddad', '2026-08-12 10:00:00')`).run();
    }
  } finally { db.close(); }

  await signInAs(page, 'test_organizer');
  await page.goto('/facilities/FC-0014?tab=events');
  const scheduled = page.locator('[data-event-row=EV-9821]');
  await expect(scheduled).toHaveAttribute('data-stage', 'scheduled');
  await expect(scheduled.locator('[data-region=site-event-stage]')).toContainText('Scheduled — Ministry review complete');
  const planned = page.locator('[data-event-row=EV-9822]');
  await expect(planned.locator('[data-region=site-event-stage]')).toContainText('Planned at your site');
  await expectAbsent(page, { anchor: '[data-region=site-events]', absent: page.locator('[data-region=site-events]').getByText(/Level \d/), because: 'the site owner reads where an event stands for the site, not its level' });
  await expectAbsent(page, { anchor: '[data-region=site-events]', absent: page.locator('[data-region=site-events]').getByText('requirements satisfied'), because: 'event outcome wording never reaches the facility side' });

  // THE RECEIPT.
  await scheduled.locator('[data-region=site-event-receipt-link]').click();
  await expect(page).toHaveURL(/\/facilities\/FC-0014\/events\/EV-9821$/);
  const receipt = page.locator('[data-region=site-event-receipt]');
  await expect(receipt).toContainText('Harbour concert');
  await expect(receipt).toContainText('MOPH-EV-2026-9821');
  await expect(receipt).toContainText('2026-08-12');
  await expect(receipt).toContainText('The Ministry has completed its review');
  await expectAbsent(page, { anchor: receipt, absent: receipt.getByText('requirements satisfied'), because: 'event outcome wording never reaches the facility side' });

  // A planned event has no receipt.
  const res = await page.goto('/facilities/FC-0014/events/EV-9822');
  expect(res?.status()).toBe(404);

  // The dashboard's section reads the same.
  await page.goto('/dashboard');
  const row = page.locator(`[data-region="events-at-your-sites"] [data-site-id="${site}"] li[data-event-id="EV-9821"]`);
  await expect(row).toContainText('Scheduled — Ministry review complete');
  await expect(row.locator('[data-region=site-event-receipt-link]')).toHaveAttribute('href', '/facilities/FC-0014/events/EV-9821');
});
