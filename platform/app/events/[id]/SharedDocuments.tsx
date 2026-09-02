import { L } from '../../../components/L';
import { AddDocumentForm } from './documents/AddDocumentForm';
import { sharedDocumentsFor } from '../../../lib/queries';
import { answerDocumentRequestAction } from '../../actions';
import { DocumentViewer } from '../../../components/DocumentViewer';
import { acceptAttribute } from '../../../lib/rules/uploads';
import { ROLES_CONTENT } from '../../../lib/rules';

/**
 * Shared documents, as a SECTION of the provider's one page (partner ruling,
 * counterparty pass 2026-09-02) — answering a document request is part of what the
 * provider supplies, so it sits on the same page as the rest of it, not behind a
 * hop. One list per organizer-provider pair, visible to both sides. Nothing here
 * reaches the Ministry unless the organizer attaches it to the submission.
 */
const STATE_STYLE = {
  organizer: { en: 'Shared with you', ar: 'مشتركة معكم', color: 'var(--brand)', chipBg: 'var(--brand-soft)', edge: 'solid', ctaEn: 'Open', ctaAr: 'فتح' },
  provider: { en: 'Complete', ar: 'مكتملة', color: 'var(--brand)', chipBg: 'var(--brand-soft)', edge: 'solid', ctaEn: 'Open', ctaAr: 'فتح' },
  requested: { en: 'Awaiting you', ar: 'بانتظاركم', color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)', edge: 'solid', ctaEn: 'Add the file', ctaAr: 'إضافة الملف' },
  missing: { en: 'Missing', ar: 'ناقص', color: 'var(--muted)', chipBg: 'var(--surface2)', edge: 'dashed', ctaEn: 'Add the file', ctaAr: 'إضافة الملف' },
} as const;

export function SharedDocuments({ eventId, token }: { eventId: string; token: string }) {
  void eventId;
  const docs = sharedDocumentsFor(token);

  return (
    <div id="documents" data-region="shared-documents" style={{ marginBlockEnd: 28 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Shared documents" ar="المستندات المشتركة" />
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
        <L en={ROLES_CONTENT.ems.docsIntro.en} ar={ROLES_CONTENT.ems.docsIntro.ar} />
      </p>

      <AddDocumentForm token={token} />

      <div data-region="doc-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d) => {
          const s = STATE_STYLE[d.source];
          return (
            <div key={d.id} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px ${s.edge} ${s.color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                  <L en={d.nameEn} ar={d.nameAr} />
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 5, fontVariantNumeric: 'tabular-nums' }}>
                  <L en={d.metaEn} ar={d.metaAr} />
                </div>
                {/* An added document is READABLE by both parties. A shared list
                    where neither side can open what the other supplied shares
                    nothing but a file name. */}
                {d.fileName && d.source !== 'requested' && d.source !== 'missing' ? (
                  <DocumentViewer
                    href={`/api/shared-documents/${d.id}`}
                    hasFile={d.hasFile}
                    contentType={d.contentType}
                    label={d.nameEn}
                  />
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 'none', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: s.chipBg, color: s.color, fontSize: 13 }}>
                  <L en={s.en} ar={s.ar} />
                </span>
                {d.source === 'requested' || d.source === 'missing' ? (
                  <form action={answerDocumentRequestAction.bind(null, token, d.id)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="file" name="file" required accept={acceptAttribute()} aria-label="Add the file" style={{ fontSize: 13, maxWidth: 210 }} />
                    <button type="submit" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', cursor: 'pointer' }}>
                      <L en={s.ctaEn} ar={s.ctaAr} />
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
