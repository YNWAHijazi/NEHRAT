/**
 * EXPIRY (owner, 9 October 2026). A site's readiness falls due 12 months after its annual
 * readiness confirmation or annual drill -- the policy's own cadence -- and shows Expiring soon
 * from the Ministry's notice window before that date (60 days unless the Ministry publishes
 * another), then Expired. An event held at the site carries the alert, including when the date
 * falls before or during the event. The review clock is 2026-08-13.
 */
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { recordReadiness, registerAed, registerFacility, submitRegistration } from '../helpers/facility-map';

const status = (page: Page) => page.locator('[data-region=facility-workspace-header] [data-region=site-status]');

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
  // The schema's triggers stamp on the platform's clock; this connection lends them one.
  db.function('now_stamp', () => '2026-08-13 12:00:00');
  try { return fn(db); } finally { db.close(); }
}

test('a site falls due: expiring soon, then expired, and the events held there say so', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  const id = await registerFacility(page);
  await registerAed(page, 'RENEW-SERIAL-1', 'Main entrance');
  // The drill was 2025-09-01: it falls due 2026-09-01, inside 60 days of the review clock.
  await recordReadiness(page, '2025-09-01');
  await submitRegistration(page);

  await signInAs(page, 'test_moph');
  await page.goto(`/ministry/facilities/${id}`);
  await page.locator('input[data-outcome=accept]').check();
  await page.locator('[data-act=outcome]').click();
  await expect(page).toHaveURL(/notice=accepted/);
  // The Ministry reads the same status the operator does.
  await expect(page.locator('[data-region=site-review-header] [data-region=site-status]')).toHaveAttribute('data-status', 'expiringSoon');

  const site = withDb((db) => {
    const siteId = (db.prepare(`SELECT site_id FROM facilities WHERE id = ?`).get(id) as { site_id: string }).site_id;
    const own = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`).get() as { id: number }).id;
    // One event ends before the due date, one after it.
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9811', ?, 'Late summer fair', 'معرض نهاية الصيف', '2026-08-25', '2026-08-25', 1, ?)`).run(own, siteId);
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9812', ?, 'September gala', 'حفل أيلول', '2026-09-10', '2026-09-11', 1, ?)`).run(own, siteId);
    return siteId;
  });

  // EXPIRING SOON on the site's own dashboard: the status, the notice and the certificate still standing.
  await signInAs(page, 'test_organizer');
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'expiringSoon');
  await expect(page.locator('[data-overview=readiness]')).toContainText('Expiring soon');
  const notice = page.locator('[data-region=renewal-notice]');
  await expect(notice).toHaveAttribute('data-renewal', 'expiringSoon');
  await expect(notice).toContainText('The annual practical drill is due by 2026-09-01.');
  await expect(page.locator('[data-region=registered-band]')).toBeVisible();

  // THE EVENTS: one ends before the due date and reads expiring soon; the other ends after it.
  await page.goto('/events/EV-9811');
  await expect(page.locator('[data-region=site-renewal-alert]')).toHaveAttribute('data-alert', 'expiringSoon');
  await expect(page.locator('[data-region=site-renewal-alert]')).toContainText(site);
  await page.goto('/events/EV-9812');
  await expect(page.locator('[data-region=site-renewal-alert]')).toHaveAttribute('data-alert', 'dueBeforeEventEnds');
  await expect(page.locator('[data-region=site-renewal-alert]')).toContainText('due by 2026-09-01, before this event ends');
  await page.goto('/dashboard');
  await expect(page.locator('a[href="/events/EV-9812"] [data-region=site-alert]')).toContainText('Site renewal due before the event ends');

  // EXPIRED: the drill is now more than 12 months old.
  withDb((db) => db.prepare(`UPDATE facility_plan_confirmations SET drill_date = '2025-08-01' WHERE facility_id = ?`).run(id));
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'expired');
  await expect(page.locator('[data-region=renewal-notice]')).toContainText('The annual practical drill was due by 2026-08-01.');
  await expect(page.locator('[data-region=registered-band]')).toHaveCount(0);
  await page.goto('/events/EV-9811');
  await expect(page.locator('[data-region=site-renewal-alert]')).toHaveAttribute('data-alert', 'expired');
  await page.goto('/dashboard');
  await expect(page.locator('a[href="/events/EV-9811"] [data-region=site-alert]')).toContainText('Site expired');

  // RENEWED: a new drill and confirmation make readiness current again.
  withDb((db) => db.prepare(`UPDATE facility_plan_confirmations SET drill_date = '2026-08-10' WHERE facility_id = ?`).run(id));
  await page.goto(`/facilities/${id}`);
  await expect(status(page)).toHaveAttribute('data-status', 'readinessCurrent');
  await expect(page.locator('[data-region=renewal-notice]')).toHaveCount(0);
  await page.goto('/events/EV-9811');
  await expect(page.locator('[data-region=site-renewal-alert]')).toHaveCount(0);

  // Both languages carry the notice (the Arabic span is in the page beside the English one).
  withDb((db) => db.prepare(`UPDATE facility_plan_confirmations SET drill_date = '2025-09-01' WHERE facility_id = ?`).run(id));
  await page.goto(`/facilities/${id}`);
  await expect(page.locator('[data-region=renewal-notice]')).toContainText('يحين موعد تمرين عملي سنوي في');
});
