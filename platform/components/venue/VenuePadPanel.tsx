import Link from 'next/link';
import { L } from '../L';
import { linkVenueFacilityAction, unlinkVenueFacilityAction } from '../../app/venues/actions';
import type { SitePadFacility } from '../../lib/sites';
import { fieldInput } from '../workspace-styles';

/**
 * The hosting venue's AEDs (Hosting Venue Registration, 8 October 2026): AEDs are not
 * registered again for the venue. Where the PAD facility registration for the same place
 * exists, its AEDs, their locations and their current registry status show here, read from
 * the facility record. Otherwise the operator links one of its facility registrations,
 * starts one for this place, or records below that there is none.
 */
export function VenuePadPanel({ venueId, pad, linkable, editable, refused }: {
  venueId: string;
  pad: SitePadFacility | null;
  linkable: readonly { id: string; nameEn: string; nameAr: string }[];
  editable: boolean;
  refused: boolean;
}) {
  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 18, border: '1px solid var(--line)', borderRadius: 22, background: 'var(--bg)', color: 'var(--ink)', fontSize: '14.5px', cursor: 'pointer' };
  if (pad) {
    return (
      <div data-region="venue-pad" data-linked="true" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 8 }}>
        <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6 }}>
          <L en={`Facility registration: ${pad.nameEn} · ${pad.facilityId}`} ar={`تسجيل المنشأة: ${pad.nameAr} · ⁦${pad.facilityId}⁩`} />
          {' · '}<Link href={`/facilities/${pad.facilityId}`} style={{ color: 'var(--brand)' }}><L en="Open the facility record" ar="فتح سجل المنشأة" /></Link>
        </p>
        {pad.devices.length > 0 ? (
          <div data-region="venue-pad-devices" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {pad.devices.map((d) => (
              <div key={d.label} data-aed={d.label} style={{ background: 'var(--bg)', padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', fontSize: '14px' }}>
                <span><span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{d.label}</span> · <L en={d.locationEn} ar={d.locationAr} />{d.publiclyAccessible ? <> · <L en="Publicly accessible" ar="متاح للعموم" /></> : null}</span>
                <span style={{ color: d.statusKey === 'operational' ? 'var(--success)' : 'var(--accent-ink)' }}><L en={d.statusEn} ar={d.statusAr} /></span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}><L en="No AED is registered on this facility yet. AEDs are added on the facility record." ar="لم يُسجَّل أي جهاز إزالة رجفان في هذه المنشأة بعد. تُضاف الأجهزة من سجل المنشأة." /></p>
        )}
        {editable ? (
          <form action={unlinkVenueFacilityAction.bind(null, venueId, pad.facilityId)}>
            <button type="submit" data-region="venue-pad-unlink" style={{ border: 0, background: 'transparent', padding: 0, minHeight: 36, color: 'var(--muted)', fontSize: '13px', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
              <L en="This facility is not at this venue" ar="هذه المنشأة ليست في هذا الموقع" />
            </button>
          </form>
        ) : null}
      </div>
    );
  }
  if (!editable) return null;
  return (
    <div data-region="venue-pad" data-linked="false" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', border: '1px dashed var(--line)', borderRadius: 12, marginBlockEnd: 14 }}>
      <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6 }}>
        <L en="No facility registration is linked to this venue." ar="لا يوجد تسجيل منشأة مرتبط بهذا الموقع." />
      </p>
      {refused ? (
        <p role="alert" style={{ margin: 0, fontSize: '13.5px', color: 'var(--bad)' }}>
          <L en="That facility registration cannot be linked to this venue." ar="لا يمكن ربط تسجيل المنشأة هذا بهذا الموقع." />
        </p>
      ) : null}
      {linkable.length > 0 ? (
        <form action={linkVenueFacilityAction.bind(null, venueId)} data-region="venue-pad-link" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 240px' }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Your facility registration at this place" ar="تسجيل منشأتكم في هذا المكان" /></span>
            <select name="facility" required defaultValue="" style={fieldInput}>
              <option value="" disabled></option>
              {linkable.map((f) => <option key={f.id} value={f.id}>{f.nameEn} · {f.id}</option>)}
            </select>
          </label>
          <button type="submit" style={{ ...pill, background: 'var(--brand)', color: 'var(--bg)', border: 0 }}><L en="Link" ar="ربط" /></button>
        </form>
      ) : null}
      <Link href={`/facilities/new?fromVenue=${encodeURIComponent(venueId)}`} data-region="venue-pad-register" style={{ ...pill, alignSelf: 'flex-start' }}>
        <L en="Register this place as a facility" ar="تسجيل هذا المكان كمنشأة" />
      </Link>
    </div>
  );
}
