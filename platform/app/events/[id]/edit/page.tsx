import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { deleteDraftEventAction, editEventDetailsAction } from '../../../actions';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { eventFor, unreadCountFor, venueRouteFor, municipalitiesFor } from '../../../../lib/queries';

/**
 * Edit the descriptive details. Figures the classification depends on are NOT
 * here -- they change through a reassessment, where the level re-derives. The
 * delete control at the foot exists for DRAFTS only: a filed record closes
 * through cancellation, never deletion.
 */
export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  if (event.lifecycle === 'cancelled') redirect(`/events/${id}`);
  const { error } = await searchParams;

  const label: React.CSSProperties = { fontSize: '12.5px', color: 'var(--muted)', display: 'block', marginBlockEnd: 6 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 };

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en={event.id} ar={event.id} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 28px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Edit event details" ar="تعديل تفاصيل الفعالية" />
          </h1>
          {error === 'required' ? (
            <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Both names and both dates are required." ar="الاسمان والتاريخان مطلوبة جميعاً." />
            </div>
          ) : null}
          <p style={{ margin: '0 0 24px', fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
            <L
              en="Names, dates, place and municipalities. Figures the classification depends on change through the assessment, where the level re-derives."
              ar="الأسماء والتواريخ والمكان والبلديات. أما الأرقام التي يعتمد عليها التصنيف فتتغير عبر التقييم، حيث يُستنتج المستوى من جديد."
            />
          </p>
          {event.filed ? (
            <div style={{ padding: '14px 20px', background: 'var(--accent-soft)', borderRadius: 10, marginBlockEnd: 24, fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.6 }}>
              <L
                en="Your submission is filed: a change to the dates or place is a material change — report it after saving."
                ar="ملفكم مقدَّم: تغيير التواريخ أو المكان تغيير جوهري — أبلغوا عنه بعد الحفظ."
              />
            </div>
          ) : null}
          <form action={editEventDetailsAction.bind(null, id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            <label><span style={label}><L en="Event name (English)" ar="اسم الفعالية (بالإنكليزية)" /></span>
              <input name="nameEn" required defaultValue={event.nameEn} style={input} /></label>
            <label><span style={label}><L en="Event name (Arabic)" ar="اسم الفعالية (بالعربية)" /></span>
              <input name="nameAr" required dir="rtl" defaultValue={event.nameAr} style={input} /></label>
            <label><span style={label}><L en="Start date" ar="تاريخ البدء" /></span>
              <input name="startDate" type="date" required defaultValue={event.startDate ?? ''} style={{ ...input, fontVariantNumeric: 'tabular-nums' }} /></label>
            <label><span style={label}><L en="End date" ar="تاريخ الانتهاء" /></span>
              <input name="endDate" type="date" required defaultValue={event.endDate ?? ''} style={{ ...input, fontVariantNumeric: 'tabular-nums' }} /></label>
            <label style={{ gridColumn: '1 / -1' }}><span style={label}><L en="Venue, route, or location" ar="الموقع أو المسار أو المكان" /></span>
              <input name="venueRoute" defaultValue={venueRouteFor(account.id, id)} style={input} /></label>
            <label style={{ gridColumn: '1 / -1' }}><span style={label}><L en="Municipality or municipalities" ar="البلدية أو البلديات" /></span>
              <input name="municipalities" defaultValue={municipalitiesFor(account.id, id)} style={input} /></label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" style={{ height: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Save the details" ar="حفظ التفاصيل" />
              </button>
            </div>
          </form>

          {!event.filed ? (
            <details style={{ marginBlockStart: 48 }}>
              <summary style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--muted)', listStyle: 'none' }}>
                <span style={{ textDecoration: 'underline' }}>
                  <L en="Delete this draft" ar="حذف هذه المسودة" />
                </span>
              </summary>
              <form action={deleteDraftEventAction.bind(null, id)} style={{ marginBlockStart: 12, padding: '16px 20px', background: 'var(--bad-soft)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <span style={{ flex: 1, minWidth: 260, fontSize: '13.5px', color: 'var(--bad)', lineHeight: 1.6 }}>
                  <L
                    en="Nothing is filed, so this record can be deleted entirely — the assessment, attachments and nominations go with it, and any nominated party is told. This cannot be undone."
                    ar="لا شيء مقدَّماً، فيمكن حذف هذا السجل كلياً — يذهب معه التقييم والمرفقات والترشيحات، ويُبلَّغ أي طرف مُرشَّح. ولا يمكن التراجع عن ذلك."
                  />
                </span>
                <button type="submit" style={{ flex: 'none', height: 38, paddingInline: 16, border: '1px solid var(--bad)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', color: 'var(--bad)', cursor: 'pointer' }}>
                  <L en="Delete the draft" ar="حذف المسودة" />
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </main>
    </>
  );
}
