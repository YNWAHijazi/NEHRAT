import type { Page, Response } from '@playwright/test';

/**
 * A page.goto that rides the dev server's memory-watchdog restart.
 *
 * next dev restarts itself once as a long run accumulates memory ("Server is
 * approaching the used memory threshold, restarting..." in the webServer log).
 * The restart window lasts seconds, and whichever navigation is in flight dies
 * on a CONNECTION-CLASS error -- refused, reset, aborted, empty. Those, and
 * ONLY those, are worth waiting out: a real refusal answers with a status or a
 * redirect, a broken route answers with an error page, and neither is retried
 * here. Anything that is not a connection-class failure rethrows immediately.
 */
export async function gotoRidingRestarts(page: Page, path: string): Promise<Response | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.goto(path);
    } catch (error) {
      const message = String(error);
      const connectionClass =
        /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_ABORTED|ERR_EMPTY_RESPONSE|ERR_SOCKET_NOT_CONNECTED/.test(
          message,
        );
      if (!connectionClass || attempt >= 5) throw error;
      // The observed restart takes a few seconds plus a first recompile.
      await page.waitForTimeout(6_000);
    }
  }
}
