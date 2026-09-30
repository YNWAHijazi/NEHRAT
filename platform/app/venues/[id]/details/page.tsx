import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { RegisterVenueForm } from '../../new/RegisterVenueForm';
import { reopenVenueSectionAction } from '../../actions';
import { L } from '../../../../components/L';
import { pageTitle, secondaryButton, noticeBand, alertBand } from '../../../../components/workspace-styles';

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
      <RegisterVenueForm initial={w.venue} point={w.point} district={w.district} locked={locked} />
    </VenueWorkspace>
  );
}
