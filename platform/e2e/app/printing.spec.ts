/**
 * WHAT REACHES THE PAPER.
 *
 * The determination certificate is the document an organizer hands to the authorising
 * authority, and it would have printed A BLANK PAGE. The print rule made everything
 * invisible except the acknowledgment wall card, and the certificate was not on that
 * list. Nothing on screen showed it: the page looked right, the button worked, and the
 * failure existed only on paper.
 *
 * That is the sharpest kind of gap in this build -- an output nobody looks at, on the
 * one document that leaves the platform. So it is tested the only way it can be:
 * emulate print media and assert the document is actually there.
 *
 * The assertion is deliberately about VISIBILITY AND HEIGHT, not text. `visibility:
 * hidden` leaves text in the DOM and toContainText would pass on a blank page --
 * which is exactly the check-that-passes-without-checking shape this build keeps
 * finding. A printed region has to occupy space.
 */

import { expect, test, type Page } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';

/** Does this region actually render under print media, rather than merely exist? */
async function printsSomething(page: Page, selector: string): Promise<{ visible: boolean; height: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { visible: false, height: 0 };
    const style = window.getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      visible: style.visibility !== 'hidden' && style.display !== 'none',
      height: Math.round(box.height),
    };
  }, selector);
}

const DOCUMENTS: { name: string; login: string; route: string; region: string }[] = [
  {
    name: 'the determination certificate — the document handed to the authorising authority',
    login: 'test_organizer',
    route: '/events/EV-0362/determination',
    region: '[data-region="certificate"]',
  },
  {
    name: 'the filing acknowledgment',
    login: 'test_organizer',
    route: '/events/EV-0362/acknowledgment',
    region: '[data-wallcard]',
  },
  {
    name: "the Ministry's whole-file report",
    login: 'test_moph_admin',
    route: '/ministry/admin/records/EV-0362/report',
    region: '[data-region="certificate"]',
  },
  {
    name: 'the facility cardiac response plan confirmation',
    login: 'test_organizer',
    route: '/facilities/FC-0014/plan',
    region: '[data-wallcard]',
  },
];

test.describe('every printable document reaches the paper', () => {
  for (const doc of DOCUMENTS) {
    test(`${doc.name} is not a blank page`, async ({ page }) => {
      await signInAs(page, doc.login);
      await gotoRidingRestarts(page, doc.route);

      // On screen first, so a routing failure is not mistaken for a print failure.
      await expect(page.locator(doc.region)).toBeVisible();

      await page.emulateMedia({ media: 'print' });
      const printed = await printsSomething(page, doc.region);
      expect(printed.visible, `${doc.region} is hidden under print media — this prints blank`).toBe(true);
      expect(printed.height, `${doc.region} has no height on paper`).toBeGreaterThan(80);
      await page.emulateMedia({ media: 'screen' });
    });
  }

  test('and the controls do not', async ({ page }) => {
    // A print button on the printed page is the other half of getting this right.
    await signInAs(page, 'test_organizer');
    await gotoRidingRestarts(page, '/events/EV-0362/determination');
    await expect(page.locator('[data-region="certificate-controls"]')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const controls = await printsSomething(page, '[data-region="certificate-controls"]');
    expect(controls.visible, 'the print controls print themselves').toBe(false);
    await page.emulateMedia({ media: 'screen' });
  });
});
