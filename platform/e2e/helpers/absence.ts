import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Asserting that something is ABSENT, without the assertion passing on the wrong page.
 *
 * THE FAILURE THIS PREVENTS. `await expect(page.locator('[data-region="outcome"]'))
 * .toHaveCount(0)` is true when the outcome block is correctly absent for this role.
 * It is ALSO true when the page 404'd, when the selector was renamed, when the sign-in
 * silently didn't take, or when the route was never reached at all. Every one of those
 * is a broken test reporting success, and the report reads identically to the case the
 * test was written for.
 *
 * That is the same family as three other defects this build has found: rules with
 * passing tests and no caller; a visual exception whose claim nothing checked; a
 * sign-in helper that returned success without signing in -- where the resulting 404
 * was the CORRECT refusal for the wrong role, so the failure disguised itself as right
 * behaviour. Absence assertions are the most common place that disguise is available.
 *
 * So an absence is never asserted alone. The anchor is something that MUST be on the
 * page if the test got where it meant to go; it is checked first, and it fails loudly
 * if the page is not the page. Only then is the absence meaningful.
 *
 * The anchor must be positive -- visible content, not another absence. Two absences
 * do not anchor each other.
 */
export async function expectAbsent(
  page: Page,
  options: {
    /** What must NOT be there: a selector, or a locator already built. */
    absent: string | Locator;
    /** What MUST be there if this is the right page. Checked first. */
    anchor: string | Locator | RegExp;
    /** Why this thing is absent, in the reviewer's terms. Shown when it is not. */
    because: string;
  },
): Promise<void> {
  const { absent, anchor, because } = options;

  if (anchor instanceof RegExp) {
    await expect(page.locator('body'), `anchor: the page does not match ${anchor}`).toContainText(anchor);
  } else {
    const located = typeof anchor === 'string' ? page.locator(anchor) : anchor;
    await expect(located.first(), 'anchor: this is not the page the test meant to reach').toBeVisible();
  }

  const target = typeof absent === 'string' ? page.locator(absent) : absent;
  await expect(target, because).toHaveCount(0);
}
