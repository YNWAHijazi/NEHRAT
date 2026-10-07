import { L } from '../L';
import { UploadInput } from '../UploadInput';
import { signVenueDeclarationAction } from '../../app/venues/actions';
import { acceptAttribute, acceptHint } from '../../lib/rules';
import { primaryButton } from '../workspace-styles';

/**
 * A participating EMS agency's own readiness declaration on a Level 3 venue: the signed
 * document and the agency's confirmation, in one form on the row (catalogue B20). The
 * organizer, another agency and the plan approval cannot sign it.
 */
export function VenueDeclarationForm({ id, signed, fileHref }: { id: string; signed: boolean; fileHref: string | null }) {
  const hint = acceptHint();
  return (
    <div data-region="venue-declaration" style={{ marginBlockStart: 10 }}>
      {signed ? (
        <p style={{ margin: '0 0 10px', fontSize: '14.5px', color: 'var(--success)' }}>
          <L en="Your agency's declaration is signed." ar="إقرار جهتكم موقَّع." />
          {fileHref ? <> · <a href={fileHref} target="_blank" rel="noreferrer"><L en="Open the signed declaration" ar="فتح الإقرار الموقَّع" /></a></> : null}
        </p>
      ) : null}
      <form action={signVenueDeclarationAction.bind(null, id)} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '14.5px', color: 'var(--muted)' }}><L en={signed ? 'Replace the signed declaration' : 'Signed readiness declaration'} ar={signed ? 'استبدال الإقرار الموقَّع' : 'إقرار الجاهزية الموقَّع'} /></span>
          <UploadInput name="file" required accept={acceptAttribute()} style={{ fontSize: 14, maxWidth: '100%' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en={hint.en} ar={hint.ar} /></span>
        </label>
        <label style={{ display: 'flex', gap: 12, alignItems: 'start', fontSize: 15, lineHeight: 1.55, minHeight: 44 }}>
          <input type="checkbox" name="confirm" value="yes" required style={{ flex: 'none', width: 20, height: 20, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
          <span><L en="Our agency confirms its ten readiness items for this venue's routine operation and signs this declaration." ar="تؤكّد جهتنا بنود جاهزيتها العشرة للتشغيل الاعتيادي لهذا الموقع وتوقّع هذا الإقرار." /></span>
        </label>
        <div><button type="submit" style={primaryButton}><L en={signed ? 'Sign again' : 'Sign the declaration'} ar={signed ? 'إعادة التوقيع' : 'توقيع الإقرار'} /></button></div>
      </form>
    </div>
  );
}
