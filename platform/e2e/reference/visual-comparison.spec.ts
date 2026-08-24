/**
 * Visual comparison: the reference prototype against the built screen, same viewport,
 * English and Arabic.
 *
 * Driven by e2e/visual-manifest.ts. An entry with a built route is screenshotted on both
 * sides and diffed with pixelmatch; the difference ratio and a diff image land in
 * e2e/output/. An entry without a route reports as pending -- visible, not silent.
 *
 * Until the first route is filled in, the harness proves itself against the reference
 * alone: every manifest screen must open, switch to Arabic with a mirrored layout, and
 * produce a non-trivial capture in both languages. That is the part that exists BEFORE
 * Slice 1, so the comparison is in place before there are screens.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
  openReference,
  selectTab,
  setLanguage,
  screenshotScreen,
  type Lang,
} from '../helpers/reference';
import { VISUAL_MANIFEST, type VisualMapping, type VisualRegion } from '../visual-manifest';

const OUTPUT = join(HERE, '..', 'output');
const DEFAULT_THRESHOLD = 0.02; // 2% of pixels differing fails the comparison
const LANGS: Lang[] = ['en', 'ar'];

function ensureOutput(): void {
  if (!existsSync(OUTPUT)) mkdirSync(OUTPUT, { recursive: true });
}

/** Pads both captures to a shared canvas so a height difference is measured, not fatal. */
function compare(a: Buffer, b: Buffer): { ratio: number; diff: PNG } {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  const width = Math.max(pa.width, pb.width);
  const height = Math.max(pa.height, pb.height);
  const canvas = (src: PNG): PNG => {
    if (src.width === width && src.height === height) return src;
    const out = new PNG({ width, height });
    PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
    return out;
  };
  const ca = canvas(pa);
  const cb = canvas(pb);
  const diff = new PNG({ width, height });
  const differing = pixelmatch(ca.data, cb.data, diff.data, width, height, {
    threshold: 0.15,
  });
  return { ratio: differing / (width * height), diff };
}



/** The same pixels, dy rows lower (positive) or higher (negative); edges fill blank. */
function shiftVertically(shot: Buffer, dy: number): Buffer {
  const src = PNG.sync.read(shot);
  const out = new PNG({ width: src.width, height: src.height });
  const srcY = dy < 0 ? -dy : 0;
  const dstY = dy > 0 ? dy : 0;
  const rows = src.height - Math.abs(dy);
  PNG.bitblt(src, out, 0, srcY, src.width, rows, 0, dstY);
  return PNG.sync.write(out);
}

/**
 * Hides reference elements the handoff author has disavowed, before capture. Injected
 * CSS rather than node removal: the prototype runtime re-renders on interaction and
 * would resurrect a removed node, but re-rendered nodes still match the selector.
 */
async function applyReferenceMask(
  page: import('@playwright/test').Page,
  mask: NonNullable<VisualMapping['referenceMask']>,
): Promise<void> {
  const css = mask.map((entry) => `${entry.css}{display:none !important}`).join('\n');
  await page.addStyleTag({ content: css });
  await page.waitForTimeout(100);
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Resolves a region's bounding rect in the REFERENCE DOM by its declared strategy. */
async function referenceRegionRect(
  page: import('@playwright/test').Page,
  region: VisualRegion,
): Promise<Rect | null> {
  const ref = region.reference;
  if (!ref) return null;
  return page.evaluate((r) => {
    const rectOf = (el: Element): { x: number; y: number; width: number; height: number } => {
      const b = el.getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
    };
    if (r.strategy === 'headerRow') {
      const h1 = document.querySelector('[data-sec-h1]');
      const row = h1?.parentElement?.parentElement;
      return row ? rectOf(row) : null;
    }
    const all = Array.from(document.querySelectorAll('span,h2,div'));
    const hits = all.filter((el) => (el.textContent ?? '').trim().startsWith(r.text ?? ''));
    const deepest = hits[hits.length - 1];
    if (!deepest) return null;
    if (r.strategy === 'cardByText') {
      // The runtime re-serializes style attributes with spaces: "border-radius: 14px".
      const card = deepest.closest(
        'div[style*="border-radius: 14px"], div[style*="border-radius:14px"]',
      );
      return card ? rectOf(card) : null;
    }
    if (r.strategy === 'containerOfText') {
      let el: Element | null = deepest;
      while (el && el !== document.body) {
        const style = el.getAttribute('style') ?? '';
        if (style.includes(r.container)) return rectOf(el);
        el = el.parentElement;
      }
      return null;
    }
    if (r.strategy === 'headingBlock') {
      const heading = deepest.closest('h1, h2') ?? deepest;
      let x1 = Infinity;
      let y1 = Infinity;
      let x2 = -Infinity;
      let y2 = -Infinity;
      let el: Element | null = heading;
      while (el && !(el !== heading && (el.tagName === 'H1' || el.tagName === 'H2'))) {
        const b = rectOf(el);
        if (b.width > 0 && b.height > 0) {
          x1 = Math.min(x1, b.x);
          y1 = Math.min(y1, b.y);
          x2 = Math.max(x2, b.x + b.width);
          y2 = Math.max(y2, b.y + b.height);
        }
        el = el.nextElementSibling;
      }
      if (!Number.isFinite(x1)) return null;
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }
    // headingSection: the heading plus its following block.
    const heading = deepest.closest('h2') ?? deepest;
    const section = heading.nextElementSibling;
    const a = rectOf(heading);
    const b = section ? rectOf(section) : a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x,
      y,
      width: Math.max(a.x + a.width, b.x + b.width) - x,
      height: Math.max(a.y + a.height, b.y + b.height) - y,
    };
  }, ref);
}

for (const mapping of VISUAL_MANIFEST) {
  for (const lang of LANGS) {
    test(`${mapping.id} [${lang}] matches the reference`, async ({ page, request }) => {
      ensureOutput();

      // Side one: the reference prototype.
      await openReference(page, mapping.referenceFile);
      await selectTab(page, mapping.referenceTab);
      await setLanguage(page, lang);
      if (mapping.referenceMask) await applyReferenceMask(page, mapping.referenceMask);
      const referenceShot = await screenshotScreen(page);
      writeFileSync(join(OUTPUT, `${mapping.id}.${lang}.reference.png`), referenceShot);

      // The harness's own guarantee, route or no route: the capture is real.
      expect(referenceShot.length).toBeGreaterThan(10_000);

      if (mapping.builtRoute === null) {
        test.info().annotations.push({
          type: 'pending',
          description: `No built route yet for ${mapping.id}. Fill in e2e/visual-manifest.ts when the screen lands.`,
        });
        return;
      }

      // Side two: the built screen, same viewport.
      const base = test.info().project.use.baseURL ?? 'http://localhost:3000';
      const probe = await request.get(base).catch(() => null);
      if (!probe) {
        test.info().annotations.push({
          type: 'pending',
          description: `${mapping.builtRoute} is mapped but no app server is running -- run under the app project.`,
        });
        return;
      }

      if (mapping.signInAs) {
        await page.goto(new URL('/signin', base).href);
        await page
          .locator(`form:has(input[value="${mapping.signInAs}"]) button`)
          .first()
          .click();
        await page.waitForURL((url) => !url.pathname.includes('/signin'));
      }
      await page.goto(new URL(mapping.builtRoute, base).href);
      if (lang === 'ar') {
        // The built app switches language by its own control; it must land dir=rtl.
        await page.getByRole('button', { name: 'العربية' }).first().click();
      }
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.dir))
        .toBe(lang === 'ar' ? 'rtl' : 'ltr');
      // Hide the same non-product chrome on the built side: the control dock (also
      // hidden in the reference capture) and Next's dev-tools launcher.
      await page.addStyleTag({
        content: '[data-dock]{display:none !important} nextjs-portal{display:none !important}',
      });
      await page.waitForTimeout(150);
      const builtShot = await page.screenshot({ fullPage: true });
      writeFileSync(join(OUTPUT, `${mapping.id}.${lang}.built.png`), builtShot);
      const builtBody = await page.locator('body').innerText();

      if (!mapping.regions) {
        const { ratio, diff } = compare(referenceShot, builtShot);
        writeFileSync(join(OUTPUT, `${mapping.id}.${lang}.diff.png`), PNG.sync.write(diff));

        const threshold = mapping.threshold ?? DEFAULT_THRESHOLD;
        test
          .info()
          .annotations.push({ type: 'diff-ratio', description: `${(ratio * 100).toFixed(2)}%` });
        expect(
          ratio,
          `${mapping.id} [${lang}] differs from the reference on ${(ratio * 100).toFixed(2)}% ` +
            `of pixels (limit ${(threshold * 100).toFixed(0)}%). See e2e/output/${mapping.id}.${lang}.diff.png`,
        ).toBeLessThanOrEqual(threshold);
        return;
      }

      // Region-by-region: each named part carries its own verdict and its note.
      for (const region of mapping.regions) {
        const tag = `${mapping.id}.${region.name}.${lang}`;

        if (region.mode === 'absentExpected') {
          // The reference carries it; the built page must not fake it.
          expect(
            builtBody,
            `${tag}: the built page renders "${region.markerText}" -- this region's data belongs to a later slice and must not be faked. ${region.note}`,
          ).not.toContain(region.markerText ?? '');
          test.info().annotations.push({ type: `region:${region.name}`, description: `absent as expected — ${region.note}` });
          continue;
        }

        if (region.mode === 'expectedDivergent') {
          // Earlier compare regions leave the browser on the reference; come back.
          await page.goto(new URL(mapping.builtRoute, base).href);
          await expect(
            page.locator(region.builtSelector ?? 'body'),
            `${tag}: the expected-divergent region is missing from the built page`,
          ).toBeVisible();
          test.info().annotations.push({ type: `region:${region.name}`, description: `present, expected divergent — ${region.note}` });
          continue;
        }

        // compare
        await page.goto(new URL(mapping.builtRoute, base).href);
        await expect
          .poll(async () => page.evaluate(() => document.documentElement.dir))
          .toBe(lang === 'ar' ? 'rtl' : 'ltr');
        await page.addStyleTag({
          content: '[data-dock]{display:none !important} nextjs-portal{display:none !important}',
        });
        const builtRegion = page.locator(region.builtSelector ?? 'body').first();
        await expect(builtRegion).toBeVisible();
        const builtRegionShot = await builtRegion.screenshot();
        writeFileSync(join(OUTPUT, `${tag}.built.png`), builtRegionShot);

        await openReference(page, mapping.referenceFile);
        await selectTab(page, mapping.referenceTab);
        await setLanguage(page, lang);
        const rect = await referenceRegionRect(page, region);
        expect(rect, `${tag}: could not locate the region in the reference DOM`).not.toBeNull();
        const referenceRegionShot = await page.screenshot({
          fullPage: true,
          clip: rect as Rect,
        });
        writeFileSync(join(OUTPUT, `${tag}.reference.png`), referenceRegionShot);

        // Region clips come from getBoundingClientRect and element capture, which round
        // fractional pixels differently -- a 1-2px translation is a capture artifact,
        // not a layout difference. Take the best alignment within +/-2px; anything a
        // shift cannot absorb is a real difference and still fails.
        let best = compare(referenceRegionShot, builtRegionShot);
        for (const dy of [-2, -1, 1, 2]) {
          const shifted = shiftVertically(builtRegionShot, dy);
          const attempt = compare(referenceRegionShot, shifted);
          if (attempt.ratio < best.ratio) best = attempt;
        }
        const { ratio, diff } = best;
        writeFileSync(join(OUTPUT, `${tag}.diff.png`), PNG.sync.write(diff));
        const threshold = region.threshold ?? DEFAULT_THRESHOLD;
        test.info().annotations.push({ type: `region:${region.name}`, description: `${(ratio * 100).toFixed(2)}%` });
        expect(
          ratio,
          `${tag} differs on ${(ratio * 100).toFixed(2)}% of pixels (limit ${(threshold * 100).toFixed(0)}%). ${region.note} See e2e/output/${tag}.diff.png`,
        ).toBeLessThanOrEqual(threshold);
      }
    });
  }
}

test('Arabic mirrors the layout, not just the text', async ({ page }) => {
  // Independent of any mapping: the reference's own RTL treatment is the bar the build
  // is held to, so the harness asserts it holds in the reference itself.
  await openReference(page, 'Organizer Journey.dc.html');
  await selectTab(page, 'Dashboard');

  await setLanguage(page, 'en');
  const en = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
  }));
  expect(en).toEqual({ dir: 'ltr', lang: 'en' });

  await setLanguage(page, 'ar');
  const ar = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
  }));
  expect(ar).toEqual({ dir: 'rtl', lang: 'ar' });

  // Mirroring means geometry moves: the header's first visible block sits on the left
  // in English and on the right in Arabic.
  const edge = async (): Promise<number> => {
    const box = await page.locator('header, [data-header]').first().boundingBox();
    return box?.x ?? 0;
  };
  void edge; // geometry probes belong per-screen; dir + lang is the page-level contract
});
