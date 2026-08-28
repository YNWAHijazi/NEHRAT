/**
 * A PRINT CONTROL MUST HAVE SOMETHING TO PRINT.
 *
 * The determination certificate would have printed a blank page. The print rule makes
 * everything invisible and then names what comes back -- and the certificate was not
 * on that list. Nothing on screen showed it. The page rendered correctly, the button
 * worked, and the failure existed only on paper, on the one document that leaves the
 * platform for another authority.
 *
 * e2e/app/printing.spec.ts is the direct test: it emulates print media and asserts
 * each document actually occupies space. This is the cheaper half, and it catches a
 * NEW printable page before anyone runs a browser -- a route that offers printing must
 * contain a region the print rule brings back.
 *
 * The check is at ROUTE level, not file level, because the control and the document
 * are often in different files: the facility plan's button is in PlanConfirmation.tsx
 * and its wall card is in page.tsx.
 */

import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { filesUnder, read, relative } from './helpers/files';

/** Offers the reader a print. */
const PRINT_CONTROL = /window\.print\(\)|<PrintButton\b/;

/**
 * The regions the print rule in app/globals.css makes visible again. Read FROM the
 * stylesheet rather than written here, so the two cannot disagree -- a hand-copied
 * list is the blind spot this whole family of defects comes from.
 */
function printableSelectors(): string[] {
  const css = read(filesUnder('app', ['.css']).find((f) => f.endsWith('globals.css'))!);
  const block = /@media print\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const visible = /^(.*)\{visibility:visible\}$/m.exec(block)?.[1] ?? '';
  return visible
    .split(',')
    .map((sel) => sel.trim().replace(/\s+\*$/, ''))
    .filter((sel) => sel.startsWith('['));
}

/** `[data-wallcard]` -> `data-wallcard`, `[data-region="certificate"]` -> the pair. */
function attributeOf(selector: string): string {
  const valued = /^\[([a-z-]+)="([^"]*)"\]$/.exec(selector);
  if (valued) return `${valued[1] as string}="${valued[2] as string}"`;
  return (/^\[([a-z-]+)\]$/.exec(selector)?.[1] as string) ?? selector;
}

describe('everything that offers a print has something to print', () => {
  const printable = printableSelectors();

  it('reads the print rule from the stylesheet (this check is wired to real data)', () => {
    expect(printable.length, 'no printable selectors found -- the CSS matcher is stale').toBeGreaterThanOrEqual(2);
    expect(printable).toContain('[data-wallcard]');
  });

  it('every route offering a print contains a region the print rule brings back', () => {
    const sources = filesUnder('app', ['.tsx']);
    const offering = new Set(sources.filter((f) => PRINT_CONTROL.test(read(f))).map((f) => dirname(f)));
    expect(offering.size, 'no print controls found -- the matcher is stale').toBeGreaterThanOrEqual(3);

    const attributes = printable.map(attributeOf);
    const offenders: string[] = [];
    for (const dir of offering) {
      // The document may be in a sibling file of the same route.
      const inRoute = sources.filter((f) => dirname(f) === dir).map(read).join('\n');
      if (!attributes.some((attr) => inRoute.includes(attr))) offenders.push(relative(dir));
    }
    expect(
      offenders,
      'These routes offer the reader a print and contain nothing the print rule makes ' +
        'visible, so they print a BLANK PAGE. Nothing on screen shows it. Mark the ' +
        'document with one of: ' + printable.join(', '),
    ).toEqual([]);
  });
});
