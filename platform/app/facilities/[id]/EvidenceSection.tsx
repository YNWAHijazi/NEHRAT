import { L } from '../../../components/L';
import { OptionText } from '../../../components/OptionText';
import { UploadInput } from '../../../components/UploadInput';
import { addSiteEvidenceAction, removeSiteDocumentAction } from '../../site-actions';
import { FACILITY_CONTENT } from '../../../lib/rules';
import { evidenceTypeLabel, evidenceTypes } from '../../../lib/rules/site';
import { UPLOADS_CONTENT, acceptHint } from '../../../lib/rules/uploads';
import type { SiteDocument } from '../../../lib/site-registration';

const input: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15 };
const card: React.CSSProperties = { padding: '22px 24px', background: 'var(--surface2)', borderRadius: 14, marginBlockEnd: 20 };

/**
 * SUPPORTING EVIDENCE -- OPTIONAL (latest revision, 9 October 2026, sections 7 and 18): a
 * clearly separate section. Readiness documentation from any external assessor, with its type,
 * issuer, issue date and expiry or review date where the document states one, and the AED
 * photographs from the AED records. Evidence only: it never stands in for a requirement and
 * never moves the status. Shared by the site's own record (editable) and the Ministry's
 * review screen (read-only).
 */
export function EvidenceSection({ facilityId, documents, photos, editable, error }: {
  facilityId: string;
  /** The supporting-evidence documents (purpose 'evidence'), newest first. */
  documents: SiteDocument[];
  /** The AEDs with a stored photograph. */
  photos: { label: string; locationEn: string; locationAr: string }[];
  editable: boolean;
  /** The refusal a redirect carried (?error=evidence-...). */
  error?: string | undefined;
}) {
  const content = FACILITY_CONTENT.site.evidence;
  const copy = UPLOADS_CONTENT.copy;
  const hint = acceptHint();
  const message = error === 'evidence-tooLarge' ? { en: copy.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel), ar: copy.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel) }
    : error === 'evidence-wrongType' ? { en: copy.wrongTypeEn, ar: copy.wrongTypeAr }
      : error === 'evidence-empty' || error === 'evidence-file' ? { en: 'Choose the document to upload.', ar: 'اختاروا المستند المراد رفعه.' }
        : error === 'evidence-details' ? { en: 'Choose the document type, and enter dates as calendar dates.', ar: 'اختاروا نوع المستند، وأدخلوا التواريخ بصيغة تاريخ صحيحة.' } : null;

  return (
    <div data-region="supporting-evidence">
      <p data-region="evidence-statement" style={{ margin: '0 0 20px', padding: '14px 18px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.6, maxWidth: '80ch' }}>
        <L en={content.statementEn} ar={content.statementAr} />
      </p>

      <section style={card}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 600 }}><L en={content.titleEn} ar={content.titleAr} /></h3>
        {documents.length === 0 ? (
          <p data-region="no-evidence" style={{ margin: '0 0 16px', fontSize: '14.5px', color: 'var(--muted)' }}><L en="No documents uploaded." ar="لم يُرفع أي مستند." /></p>
        ) : (
          <ul data-region="evidence-list" style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {documents.map((d) => {
              const type = evidenceTypeLabel(d.docType);
              return (
                <li key={d.id} data-document={d.id} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ flex: '1 1 260px', minWidth: 0, fontSize: '14.5px', lineHeight: 1.5 }}>
                    <span style={{ display: 'block', fontWeight: 500 }}><L en={type.en} ar={type.ar} /></span>
                    <a href={`/api/facility-documents/${facilityId}/${d.id}`} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{d.fileName}</a>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      <L
                        en={[d.issuer ? `Issued by ${d.issuer}` : '', d.issueDate ? `issued ${d.issueDate}` : '', d.reviewDate ? `expiry or review ${d.reviewDate}` : '', `uploaded ${d.uploadedAt.slice(0, 10)}`].filter(Boolean).join(' · ')}
                        ar={[d.issuer ? `صادر عن ${d.issuer}` : '', d.issueDate ? `تاريخ الإصدار ⁦${d.issueDate}⁩` : '', d.reviewDate ? `الانتهاء أو المراجعة ⁦${d.reviewDate}⁩` : '', `رُفع في ⁦${d.uploadedAt.slice(0, 10)}⁩`].filter(Boolean).join(' · ')}
                      />
                    </span>
                  </span>
                  {editable ? (
                    <form action={removeSiteDocumentAction.bind(null, facilityId, d.id)}>
                      <button type="submit" style={{ minHeight: 44, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '13.5px', cursor: 'pointer' }}>
                        <L en="Remove" ar="إزالة" />
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {editable ? (
          <form action={addSiteEvidenceAction.bind(null, facilityId)} data-region="evidence-upload" style={{ display: 'grid', gap: 16 }}>
            {message ? <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: '14px' }}><L en={message.en} ar={message.ar} /></p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Document type" ar="نوع المستند" /></span>
                <select name="docType" required defaultValue="" style={{ ...input, paddingInlineEnd: 34 }}>
                  <option value=""></option>
                  {evidenceTypes().map((t) => <option key={t.key} value={t.key}><OptionText en={t.en} ar={t.ar} /></option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Issuer, if stated" ar="الجهة المصدرة، إن ذُكرت" /></span>
                <input name="issuer" style={input} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Issue date, if stated" ar="تاريخ الإصدار، إن ذُكر" /></span>
                <input name="issueDate" type="date" style={{ ...input, fontVariantNumeric: 'tabular-nums' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Expiry or review date, if stated on the document" ar="تاريخ الانتهاء أو المراجعة، إن ذُكر في المستند" /></span>
                <input name="reviewDate" type="date" style={{ ...input, fontVariantNumeric: 'tabular-nums' }} />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Document" ar="المستند" /></span>
              <UploadInput name="document" required />
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={hint.en} ar={hint.ar} /></span>
            </label>
            <button type="submit" style={{ justifySelf: 'start', minHeight: 44, padding: '10px 22px', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
              <L en="Upload the document" ar="رفع المستند" />
            </button>
          </form>
        ) : null}
      </section>

      <section style={card} data-region="aed-photographs">
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}><L en={content.photosTitleEn} ar={content.photosTitleAr} /></h3>
        <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)' }}><L en={content.photosNoteEn} ar={content.photosNoteAr} /></p>
        {photos.length === 0 ? (
          <p style={{ margin: 0, fontSize: '14.5px', color: 'var(--muted)' }}><L en="No AED photographs." ar="لا صور للأجهزة." /></p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
            {photos.map((p) => (
              <figure key={p.label} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/facility-device-photos/${facilityId}/${p.label}`} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)' }} />
                <figcaption style={{ fontSize: 13, marginBlockStart: 6, lineHeight: 1.45 }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.label}</span> · <L en={p.locationEn} ar={p.locationAr} />
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
