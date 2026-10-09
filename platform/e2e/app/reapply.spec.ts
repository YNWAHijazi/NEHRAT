/**
 * Reapply (partner ruling, 2026-09-02): inside a concluded event, one action that
 * starts a NEW event prefilled from the old one — everything except the dates.
 *
 * The load-bearing assertions: nothing carries over as approved (the screen says
 * so in the partner's words), the level derives from the copied answers rather
 * than being inherited, the new record has its own identifier and names its
 * source, the old record stays untouched, and a live event offers no Reapply.
 */

import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

test.describe('reapply from a concluded event', () => {
  test('a live event offers no Reapply', async ({ page }) => {
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0418');
    await expect(page.locator('h1')).toContainText('Beirut Coastal 12K');
    await expect(page.locator('[data-region="reapply"]')).toHaveCount(0);
  });

  test('the copy starts new, says so in the ruled words, and leaves the source alone', async ({ page }) => {
    // EV-0244 (Tripoli Marathon) is concluded at the review clock: ended, satisfied,
    // Level 3, one confirmed Director nomination.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0244');
    const reapply = page.locator('[data-region="reapply"]');
    await expect(reapply).toBeVisible();
    await expect(reapply).toContainText('Enter new dates and review the requirements before submitting.');
    await reapply.locator('button:has-text("Duplicate event")').click();
    await page.waitForURL(/\/events\/EV-\d+\/prepare/);

    // A NEW record with its own identifier, naming its source.
    const newId = new URL(page.url()).pathname.split('/')[2]!;
    expect(newId).not.toBe('EV-0244');
    const modal = page.locator('dialog[open]');
    if (await modal.count()) await modal.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Event name (English)', exact: true })).toHaveValue('Tripoli Marathon');
    await expect(page.locator('input[type="date"]').first()).toHaveValue('');
    // The organizer's own requirement answers carry -- text and choices, never a confirmation
    // and never another party's answer (owner, 9 October 2026).
    {
      const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
      try {
        const rows = (id: string) => db.prepare(`SELECT key, answers, author_role FROM requirement_answers WHERE record_kind = 'event' AND record_id = ? ORDER BY key`).all(id) as { key: string; answers: string; author_role: string }[];
        const copied = rows(newId);
        expect(copied.every((r) => r.author_role === 'organizer')).toBe(true);
        expect(copied.every((r) => !Object.values(JSON.parse(r.answers) as Record<string, unknown>).includes(true))).toBe(true);
        const source = new Map(rows('EV-0244').filter((r) => r.author_role === 'organizer').map((r) => [r.key, JSON.parse(r.answers) as Record<string, unknown>]));
        for (const r of copied) {
          const was = source.get(r.key);
          expect(was, r.key).toBeTruthy();
          for (const [k, v] of Object.entries(JSON.parse(r.answers) as Record<string, unknown>)) expect(was![k], `${r.key}.${k}`).toEqual(v);
        }
      } finally {
        db.close();
      }
    }
    await gotoRidingRestarts(page, `/events/${newId}`);
    await expect(page.locator('body')).toContainText('Dr. N. Salameh');
    await expect(page.locator('body')).not.toContainText('Confirmed —');

    // THE SECOND RUNNING READS AS ONE AT A GLANCE (partner instruction,
    // 2026-09-03): the new card carries the previous edition's date beside its
    // identity, from copied_from. Display, not lineage merging -- the records
    // stay separate, one per authorisation.
    await gotoRidingRestarts(page, '/dashboard');
    const newCard = page.locator(`a[href="/events/${newId}"]`);
    await expect(newCard.locator('[data-region="previous-edition"]')).toContainText(/Previous edition \d{4}-\d{2}-\d{2}/);

    // THE SOURCE IS UNTOUCHED: same determination, no copied-from line, still
    // offering Reapply for the next time.
    await gotoRidingRestarts(page, '/events/EV-0244');
    await expect(page.locator('body')).toContainText('Health and medical preparedness requirements satisfied');
    await expect(page.locator('[data-region="copied-from"]')).toHaveCount(0);
    await expect(page.locator('[data-region="reapply"]')).toBeVisible();

    // A FINISHED EVENT GOES TO THE ARCHIVE (owner, 9 October 2026), and its row there offers
    // Duplicate. The copy is given dates long past the archive window to put it there.
    {
      const db = new DatabaseSync(process.env['E2E_DATABASE_PATH']!);
      try {
        db.prepare(`UPDATE events SET start_date = '2026-05-02', end_date = '2026-05-02' WHERE id = ?`).run(newId);
      } finally {
        db.close();
      }
    }
    await gotoRidingRestarts(page, '/dashboard');
    await expect(page.locator(`a[href="/events/${newId}"]:not([data-past-event] a)`)).toHaveCount(0);
    const archive = page.locator('[data-region="previous-services"]');
    await archive.locator('summary').click();
    await expect(archive).toContainText('Past events');
    const row = archive.locator(`[data-past-event="${newId}"]`);
    await expect(row).toContainText('2026-05-02');
    await row.locator('[data-action="duplicate-event"]').click();
    await page.waitForURL(/\/events\/EV-\d+\/prepare/);
    expect(new URL(page.url()).pathname.split('/')[2]).not.toBe(newId);
  });
});
