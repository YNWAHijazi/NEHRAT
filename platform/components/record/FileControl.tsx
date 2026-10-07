import { L } from '../L';
import { DocumentViewer } from '../DocumentViewer';
import { UploadInput } from '../UploadInput';
import { removeRequirementFileAction, saveRequirementFileAction } from '../../app/record-actions';
import { UPLOADS_CONTENT, acceptAttribute, acceptHint, type RecordService, type RequirementInstance } from '../../lib/rules';
import { EVENT_FILE_KEYS } from '../../lib/requirement-migration';

const REFUSALS: Record<string, { en: string; ar: string }> = {
  tooLarge: { en: UPLOADS_CONTENT.copy.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel), ar: UPLOADS_CONTENT.copy.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel) },
  wrongType: { en: UPLOADS_CONTENT.copy.wrongTypeEn, ar: UPLOADS_CONTENT.copy.wrongTypeAr },
  empty: { en: UPLOADS_CONTENT.copy.emptyEn, ar: UPLOADS_CONTENT.copy.emptyAr },
};

/**
 * The file on a row that takes one. The control says what the file must show (the
 * row's prompt does), the accepted types and the size limit, and reads the stored file
 * back inline. Files are only where the source requires them (brief item 14).
 */
export function FileControl({ kind, id, inst, canEdit, filed, contentType, refusal }: {
  kind: RecordService; id: string; inst: RequirementInstance; canEdit: boolean; filed: boolean; contentType: string | null; refusal?: string | null;
}) {
  if (!inst.file) return null;
  const present = inst.file.present;
  const href = kind === 'event' ? `/api/documents/${id}/${EVENT_FILE_KEYS[inst.key] ?? inst.key}` : `/api/venue-documents/${id}/${inst.key}`;
  const hint = acceptHint();
  return (
    <div data-region="file-control" style={{ marginBlockStart: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '14.5px' }}><L en={inst.file.labelEn} ar={inst.file.labelAr} /></span>
        <span style={{ fontSize: 13, color: present ? 'var(--success)' : 'var(--muted)' }}>
          {present ? <L en={`Uploaded — ${present.fileName}`} ar={`رُفع — ${present.fileName}`} /> : <L en="No file yet" ar="لا ملف بعد" />}
        </span>
      </div>
      {present ? <DocumentViewer href={href} hasFile contentType={contentType} label={inst.labelEn} /> : null}
      {refusal && REFUSALS[refusal] ? (
        <p role="alert" data-region="upload-refused" style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--bad)' }}><L en={REFUSALS[refusal]!.en} ar={REFUSALS[refusal]!.ar} /></p>
      ) : null}
      {canEdit ? (
        <form action={saveRequirementFileAction.bind(null, kind, id, inst.key)} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBlockStart: 10 }}>
          <UploadInput name="file" required accept={acceptAttribute()} aria-label={inst.labelEn} style={{ fontSize: 14, maxWidth: '100%' }} />
          <button type="submit" style={{ minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, cursor: 'pointer' }}>
            {present ? <L en="Replace" ar="استبدال" /> : <L en="Upload" ar="رفع" />}
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en={hint.en} ar={hint.ar} /></span>
        </form>
      ) : null}
      {canEdit && present && !filed ? (
        <form action={removeRequirementFileAction.bind(null, kind, id, inst.key)} style={{ marginBlockStart: 6 }}>
          <button type="submit" style={{ border: 0, background: 'transparent', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0, minHeight: 32 }}><L en="Remove" ar="إزالة" /></button>
        </form>
      ) : null}
    </div>
  );
}
