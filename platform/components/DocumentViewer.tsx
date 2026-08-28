/**
 * Opens a stored document where the reviewer is reading, not in a separate errand.
 *
 * The ruling is that the Ministry must see documents, not names. A link alone
 * satisfies the letter of that and not the point: a reviewer checking a deployment
 * map against a plan section should see both at once. So the file renders inline,
 * in a collapsed disclosure the reviewer opens, with a real link beside it for the
 * full-window read.
 *
 * THE IFRAME IS SANDBOXED HERE AS WELL AS AT THE ROUTE. The route sends a sandbox
 * CSP and nosniff; this adds the element's own `sandbox` attribute with no
 * allowances. Two independent mechanisms, because a stored file rendered on our own
 * origin is the one place in this build where an organizer controls bytes a
 * reviewer's browser parses.
 *
 * A row with no stored file is NOT given a broken control. Every attachment seeded
 * before the storage ruling is a name and a date, and the row says exactly that --
 * which is also why this component takes `hasFile` rather than guessing from a URL.
 */

import { L } from './L';
import { UPLOADS_CONTENT, servedType } from '../lib/rules/uploads';

export function DocumentViewer({
  href,
  hasFile,
  contentType,
  label,
}: {
  href: string;
  hasFile: boolean;
  /** The stored type when known. Null means "ask the route", which frames it. */
  contentType: string | null;
  /** What this document is, for the accessible name on the link. */
  label: string;
}): React.ReactElement {
  const C = UPLOADS_CONTENT.copy;

  if (!hasFile) {
    return (
      <div
        data-region="doc-no-file"
        style={{ marginBlockStart: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '78ch' }}
      >
        <L en={C.noBytesEn} ar={C.noBytesAr} />
      </div>
    );
  }

  const kind = contentType ? (servedType(contentType)?.inline ?? 'frame') : 'frame';

  return (
    <div data-region="doc-viewer" style={{ marginBlockStart: 8 }}>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: 'var(--brand)' }}>
          <L en={C.openEn} ar={C.openAr} />
        </summary>
        <div style={{ marginBlockStart: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en={C.viewerEn} ar={C.viewerAr} />
          </div>
          {kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={href}
              alt={label}
              style={{ maxInlineSize: '100%', blockSize: 'auto', borderRadius: 8, border: '1px solid var(--line)' }}
            />
          ) : (
            <iframe
              src={href}
              title={label}
              sandbox=""
              style={{ inlineSize: '100%', blockSize: 520, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)' }}
            />
          )}
          <div style={{ marginBlockStart: 8 }}>
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12.5px', color: 'var(--brand)' }}>
              <L en="Open in a new tab" ar="فتح في لسان جديد" />
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}
