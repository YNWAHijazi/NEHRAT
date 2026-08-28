import type { Page, Response } from '@playwright/test';

/**
 * A page.goto that rides the dev server's memory-watchdog restart.
 *
 * next dev restarts itself as a long run accumulates memory ("Server is
 * approaching the used memory threshold, restarting..." in the webServer log).
 * Whichever navigation is in flight dies with it, and it dies in one of TWO
 * shapes depending on when the socket went:
 *
 *   - CONNECTION-CLASS, if the socket was refused or dropped outright.
 *   - A NAVIGATION TIMEOUT, if the request was accepted and then simply never
 *     answered because the process serving it went away mid-render.
 *
 * The first version of this helper knew only the first shape, so a restart that
 * happened a moment earlier or later produced a 150s timeout that read as a slow
 * screen and failed the run. Both shapes are the same event and both are waited
 * out here.
 *
 * WHAT IS NOT RETRIED, and why this cannot hide a defect: a real refusal answers
 * with a status, a broken route answers with an error page, and a genuinely
 * hanging screen times out again on the retry and fails. Retrying costs a slow
 * screen one extra attempt; it cannot turn a broken one green.
 */
export async function gotoRidingRestarts(page: Page, path: string): Promise<Response | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.goto(path);
    } catch (error) {
      const message = String(error);
      const restartShaped =
        /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_ABORTED|ERR_EMPTY_RESPONSE|ERR_SOCKET_NOT_CONNECTED/.test(
          message,
        ) ||
        // The hang shape. Narrowed to page.goto's own timeout so an assertion
        // timeout bubbling through here is never mistaken for a restart.
        /page\.goto:.*Timeout .* exceeded/s.test(message);
      // Two attempts for the hang shape: each already cost a full navigation
      // budget, and a third would only lengthen a failure nobody is waiting for.
      const cap = /page\.goto:.*Timeout/s.test(message) ? 1 : 5;
      if (!restartShaped || attempt >= cap) throw error;
      // The observed restart takes a few seconds plus a first recompile.
      await page.waitForTimeout(6_000);
    }
  }
}
