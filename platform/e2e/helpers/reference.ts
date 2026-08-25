/**
 * Drives the handoff reference prototypes.
 *
 * The pages are self-contained: component state, inline styles, support.js runtime. Tabs
 * are the data-prototype-nav pills; language is the header toggle, which sets lang and
 * dir on documentElement and mirrors the layout.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { HANDOFF_PACK } from '../../lib/handoff-pack';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
import type { Page } from '@playwright/test';

export const PAGES_DIR = join(HERE, '..', '..', '..', HANDOFF_PACK, 'pages');

export type ReferenceFile =
  | 'Event Health Readiness.dc.html'
  | 'Organizer Journey.dc.html'
  | 'EMS Agency.dc.html'
  | 'Medical Director.dc.html'
  | 'Ministry Review.dc.html'
  | 'Facility Cardiac Readiness.dc.html';

export type Lang = 'en' | 'ar';

export async function openReference(page: Page, file: ReferenceFile): Promise<void> {
  const url = pathToFileURL(join(PAGES_DIR, file)).href;
  await page.goto(url);
  // The runtime renders into the document; the nav strip appearing means it is up.
  await page.waitForSelector('[data-prototype-nav]', { timeout: 15_000 });
}

/** Clicks a pill on the reviewer's index strip. Exact match first, prefix as fallback. */
export async function selectTab(page: Page, tab: string): Promise<void> {
  const nav = page.locator('[data-prototype-nav]');
  const exact = nav.getByText(tab, { exact: true });
  if (await exact.count()) {
    await exact.first().click();
  } else {
    await nav.getByText(tab).first().click();
  }
  await page.waitForTimeout(250); // state re-render
}

/**
 * Switches the prototype's language.
 *
 * The toggle shows the language it would switch TO, so it reads "العربية" while English
 * is active and "English" while Arabic is. Asserts the switch landed by reading
 * documentElement, which also proves dir flipped -- mirroring, not just translation.
 */
export async function setLanguage(page: Page, lang: Lang): Promise<void> {
  const current = await page.evaluate(() => document.documentElement.lang);
  if (current !== lang) {
    const label = lang === 'ar' ? 'العربية' : 'English';
    await page.getByRole('button', { name: label }).first().click();
    await page.waitForTimeout(250);
  }
  const landed = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  if (landed.lang !== lang) {
    throw new Error(`Language switch failed: wanted ${lang}, got ${landed.lang}`);
  }
  const wantDir = lang === 'ar' ? 'rtl' : 'ltr';
  if (landed.dir !== wantDir) {
    throw new Error(`dir did not follow language: lang=${lang} but dir=${landed.dir}`);
  }
}

/**
 * Screenshot with the reviewer chrome hidden.
 *
 * The tab strip and the control dock are prototype furniture, not product. Hiding them
 * before capture means the comparison measures the screen, not the harness.
 */
export async function screenshotScreen(page: Page): Promise<Buffer> {
  await page.addStyleTag({
    content: '[data-prototype-nav],[data-dock]{display:none !important}',
  });
  await page.waitForTimeout(100);
  return page.screenshot({ fullPage: true });
}
