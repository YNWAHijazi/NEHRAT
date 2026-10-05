import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { RegisterVenueForm } from '../../new/RegisterVenueForm';
import { reopenVenueSectionAction } from '../../actions';
import { L } from '../../../../components/L';
import { pageTitle, secondaryButton, noticeBand, alertBand } from '../../../../components/workspace-styles';
import { venueTypeLabel } from '../../../../lib/rules/venue-intake';
import { venueDistrictLabel } from '../../../../lib/rules/venue-intake';
import type { VenueWorkspaceData } from '../../../../components/VenueWorkspace';

export default async function VenueDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const { error } = await searchParams;
  const locked = !w.editable || !w.detailsEditing;
  return (
    <VenueWorkspace account={account} w={w} active="details">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', justifyContent: 'space-between', marginBlockEnd: 24 }}>
        <h2 data-sec-h1="" style={{ ...pageTitle, marginBlock: 0 }}><L en="Venue details" ar="تفاصيل الموقع" /></h2>
        {w.editable && !w.detailsEditing ? (
          <form action={reopenVenueSectionAction.bind(null, id, 'details')}>
            <button type="submit" style={secondaryButton}><L en="Edit details" ar="تعديل التفاصيل" /></button>
          </form>
        ) : null}
      </div>
      {error ? (
        <div role="alert" style={alertBand}>
          <L en="Complete the required details and confirm the map pin." ar="أكملوا البيانات المطلوبة وأكّدوا الموقع على الخريطة." />
        </div>
      ) : null}
      {w.editable && !w.detailsDone && !w.detailsEditing ? (
        <div role="status" style={noticeBand}>
          <L en="Some details are missing. Choose Edit details to complete them." ar="بعض البيانات ناقصة. اختاروا تعديل التفاصيل لاستكمالها." />
          {w.detailsMissing.length ? (
            <div data-region="details-missing" style={{ marginBlockStart: 6, color: 'var(--accent-ink)' }}>
              <L en={`Missing: ${w.detailsMissing.map((m) => m.en).join(', ')}`} ar={`الناقص: ${w.detailsMissing.map((m) => m.ar).join('، ')}`} />
            </div>
          ) : null}
        </div>
      ) : null}
      {locked ? <VenueDetailsReadOnly w={w} /> : <RegisterVenueForm initial={w.venue} point={w.point} district={w.district} locked={false} />}
    </VenueWorkspace>
  );
}

/** The saved details as text, every value whole; a missing one says so instead of an empty box. */
function VenueDetailsReadOnly({ w }: { w: VenueWorkspaceData }) {
  const v = w.venue;
  const type = venueTypeLabel(v.category);
  const yesNo = (b: boolean | null | undefined) => (b === null || b === undefined ? null : <L en={b ? 'Yes' : 'No'} ar={b ? 'نعم' : 'لا'} />);
  const rows: { en: string; ar: string; value: React.ReactNode }[] = [
    { en: 'Venue name (English)', ar: 'اسم الموقع (بالإنكليزية)', value: v.nameEn ? <bdi lang="en">{v.nameEn}</bdi> : null },
    { en: 'Venue name (Arabic)', ar: 'اسم الموقع (بالعربية)', value: v.nameAr ? <bdi lang="ar">{v.nameAr}</bdi> : null },
    { en: 'Venue type', ar: 'نوع الموقع', value: v.category ? <L en={type.en} ar={type.ar} /> : null },
    { en: 'District', ar: 'القضاء', value: w.district ? <L en={venueDistrictLabel(w.district).en} ar={venueDistrictLabel(w.district).ar} /> : null },
    { en: 'Town and street address', ar: 'البلدة وعنوان الشارع', value: v.addressMunicipalityEn || null },
    { en: 'Address (Arabic)', ar: 'العنوان (بالعربية)', value: v.addressMunicipalityAr ? <bdi lang="ar">{v.addressMunicipalityAr}</bdi> : null },
    { en: 'Responsible person', ar: 'الشخص المسؤول', value: v.responsibleName || null },
    { en: 'Phone number', ar: 'رقم الهاتف', value: v.responsiblePhone ? <bdi>{v.responsiblePhone}</bdi> : null },
    { en: 'Approved or licensed capacity', ar: 'السعة المعتمدة أو المرخّصة', value: v.licensedCapacity || null },
    { en: 'Regularly hosts organized events', ar: 'يستضيف فعاليات منظّمة بانتظام', value: yesNo(v.regularlyHosts) },
    { en: 'Nightclub or dance venue', ar: 'ملهى ليلي أو مكان للرقص', value: yesNo(v.isNightclub) },
    { en: 'Map pin', ar: 'علامة الخريطة', value: w.point ? <a href={`https://www.openstreetmap.org/?mlat=${w.point.lat}&mlon=${w.point.lng}#map=17/${w.point.lat}/${w.point.lng}`} target="_blank" rel="noreferrer"><L en="View map" ar="عرض الخريطة" /></a> : null },
  ];
  return (
    <dl data-region="venue-details-read-only" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', margin: 0 }}>
      {rows.map((r) => (
        <div key={r.en} style={{ background: 'var(--bg)', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <dt style={{ flex: '0 0 240px', fontSize: 13, color: 'var(--muted)' }}><L en={r.en} ar={r.ar} /></dt>
          <dd style={{ flex: '1 1 240px', margin: 0, fontSize: '14.5px', overflowWrap: 'anywhere', color: r.value === null ? 'var(--accent-ink)' : 'var(--ink)' }}>
            {r.value ?? <L en="Missing" ar="ناقص" />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
