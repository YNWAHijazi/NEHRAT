/**
 * MOBILE IS THE TEST (fields-only ruling, 2026-09-04): an end-user form page
 * carries the fields the user fills and the action they take, and at 375px a
 * person must reach the first control without scrolling past text they did not
 * need. The plan page's four guidance blocks, depth table and fourteen-section
 * template put five screens of reading before the first field; this spec is
 * the ratchet that keeps them from growing back. Budget: the first interactive
 * control within 900px of the top -- roughly one phone screen after the band,
 * the government strip and the page title.
 */

import { expect, test } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

const BUDGET_PX = 900;

const FORM_PAGES: { route: string; label: string; as?: string }[] = [
  { route: '/events/EV-0418/plan', label: 'the plan' },
  { route: '/events/EV-0418/submit', label: 'the submission package' },
  { route: '/events/new', label: 'the assessment' },
  { route: '/events/EV-0418/requirements', label: 'requirements and attachments' },
  // The EMS declaration, signed in as the named provider on its live event.
  { route: '/events/EV-0362/declaration', label: 'the EMS declaration', as: 'test_ems' },
  // The Director's governance page, signed in as the named physician.
  { route: '/events/EV-0362', label: 'the Director governance', as: 'test_director' },
  // The public forms need no session: applicability and the reference lookup.
  { route: '/applicability?subject=event', label: 'the applicability check', as: '' },
  { route: '/lookup', label: 'the reference lookup', as: '' },
];

test.describe('fields come first on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const { route, label, as } of FORM_PAGES) {
    test(`${label} puts its first control within ${BUDGET_PX}px at 375px`, async ({ page }) => {
      if (as === undefined) await signInAs(page, 'test_organizer');
      else if (as !== '') await signInAs(page, as);
      await gotoRidingRestarts(page, route);
      const top = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return Number.MAX_SAFE_INTEGER;
        const control = main.querySelector('button, input, textarea, select, summary, a[href]');
        if (!control) return Number.MAX_SAFE_INTEGER;
        return control.getBoundingClientRect().top + window.scrollY;
      });
      expect(top, `${route}: first control sits ${Math.round(top)}px from the top`).toBeLessThanOrEqual(BUDGET_PX);
    });
  }
});
