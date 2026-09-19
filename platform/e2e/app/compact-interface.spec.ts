import { expect, test, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { gotoRidingRestarts } from '../helpers/resilient';

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: window.innerWidth,
    elements: [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
    }).slice(0, 12).map((el) => ({ tag: el.tagName, region: el.getAttribute('data-region'), style: el.getAttribute('style'), text: el.textContent?.slice(0, 70) })),
  }));
  expect(overflow.width <= overflow.viewport, `${page.url()} ${JSON.stringify(overflow)}`).toBe(true);
}

test('level help stays still on hover, supports keyboard and never changes the page layout', async ({ page }) => {
  await signInAs(page, 'test_organizer');
  await gotoRidingRestarts(page, '/events/EV-0418');
  const help = page.locator('[data-region="derivation"] .info-note');
  const trigger = help.getByRole('button');
  const before = await trigger.boundingBox();
  const headerBefore = await page.locator('[data-region="record-header"]').boundingBox();
  await trigger.hover();
  await expect(help.getByRole('note')).toBeVisible();
  // Sample successive frames: a hover/reflow loop must fail even if one frame looks correct.
  const frames = await trigger.evaluate(async (button) => {
    const samples = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      const r = button.getBoundingClientRect();
      samples.push({ x: r.x, y: r.y, open: button.getAttribute('aria-expanded') });
    }
    return samples;
  });
  expect(frames.every((f) => f.open === 'true' && Math.abs(f.x - before!.x) < 1 && Math.abs(f.y - before!.y) < 1)).toBe(true);
  expect(await page.locator('[data-region="record-header"]').boundingBox()).toEqual(headerBefore);
  const labelTops = await page.locator('.event-stat-label').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(Math.max(...labelTops) - Math.min(...labelTops)).toBeLessThan(1);
  // The popover remains reachable across the small pointer gap.
  await help.getByRole('note').hover();
  await expect(help.getByRole('note')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(help.getByRole('note')).toBeHidden();
  await trigger.focus();
  await trigger.press('Enter');
  await expect(help.getByRole('note')).toBeVisible();
  await trigger.press('Escape');
  await expect(help.getByRole('note')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.screenshot({ path: '/tmp/moph-compact-event-desktop.png', fullPage: true });
});

test.describe('phone help and navigation', () => {
  test.use({ hasTouch: true, actionTimeout: 15_000 });
  for (const lang of ['en', 'ar']) {
    test(`compact header and independent help at 320px (${lang})`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'lang', value: lang, url: baseURL! }]);
      await page.setViewportSize({ width: 320, height: 780 });
      await signInAs(page, 'test_organizer');
      await gotoRidingRestarts(page, '/events/EV-0418');
      const header = page.locator('.app-header');
      expect((await header.boundingBox())!.height).toBeLessThanOrEqual(100);
      expect(await header.getByText('Beirut Road Runners', { exact: true }).count()).toBe(0);
      const next = page.locator('[data-region="next-action"]');
      const url = page.url();
      const help = next.locator('.info-note');
      await help.getByRole('button').tap();
      await expect(help.getByRole('note')).toBeVisible();
      expect(page.url()).toBe(url);
      const box = (await help.getByRole('note').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      await noOverflow(page);
      await help.getByRole('button').tap();
      await expect(help.getByRole('note')).toBeHidden();
      const account = header.getByRole('button', { name: lang === 'en' ? 'Account menu' : 'قائمة الحساب' });
      await account.tap();
      await expect(header.locator('[data-account-menu]')).toContainText('Beirut Road Runners');
      await page.locator('[data-region="counters"]').tap({ position: { x: 8, y: 8 } });
      await expect(header.locator('[data-account-menu]')).toHaveCount(0);
      const history = page.locator('[data-region="history"]');
      await expect(history).not.toHaveAttribute('open');
      await history.locator('summary').tap();
      await expect(history.locator('summary + div')).toBeVisible();
      await history.locator('summary').tap();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/moph-compact-event-${lang}-320.png`, fullPage: true });
      await next.getByRole('link').tap();
      await expect(page).toHaveURL(/\/events\/EV-0418\/(requirements|plan|submit)|\/organization/);
    });
  }
});

// Read-only coverage of the principal screens for each role. Tests only use the
// disposable E2E database and never send invitations or change live records.
for (const walk of [
  { role: 'test_organizer', routes: ['/events/new', '/events/EV-0418/requirements', '/events/EV-0418/plan', '/events/EV-0418/submit', '/venues/VN-0028/assessment', '/facilities/new', '/facilities/FC-0014/plan', '/organization'] },
  { role: 'test_ems', routes: ['/dashboard', '/profile', '/events/EV-0362/declaration'] },
  { role: 'test_director', routes: ['/dashboard', '/events/EV-0362', '/events/EV-0362/plan', '/credentials'] },
  { role: 'test_moph_admin', routes: ['/ministry/admin/configuration', '/ministry/admin/users', '/ministry/organizations', '/ministry/submissions/EV-0362'] },
  { role: 'test_owner', routes: ['/platform/admin', '/platform/admin/capabilities/vendorDirectory', '/platform/admin/capabilities/applicationFees'] },
]) {
  test(`${walk.role} sees concise help and usable navigation across the main screens`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, walk.role);
    for (const route of walk.routes) {
      await gotoRidingRestarts(page, route);
      await expect(page.locator('main').getByRole('heading').first()).toBeVisible();
      await expect(page.getByText('Something is owed by you', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Nothing further is owed by you', { exact: true })).toHaveCount(0);
      // A help button must never be nested inside a navigation/submit control.
      expect(await page.locator('.info-note-trigger').evaluateAll((buttons) => buttons.filter((button) => button.parentElement?.closest('a, button, label, summary')).length)).toBe(0);
      const note = page.locator('main .info-note').first();
      if (await note.count()) {
        await note.getByRole('button').click();
        await expect(note.getByRole('note')).toBeVisible();
        await noOverflow(page);
        await note.getByRole('button').press('Escape');
      }
      await noOverflow(page);
      if (route.includes('/assessment')) await page.screenshot({ path: '/tmp/moph-compact-venue-mobile.png', fullPage: true });
    }
  });
}
