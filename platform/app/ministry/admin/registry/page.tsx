import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { getDb } from '../../../../lib/db';
import { beirutToday } from '../../../../lib/clock';
import { archiveVenueRecordAction, archiveFacilityRecordAction } from '../../../ministry-actions';

/**
 * The national registry: record identifiers and reference numbers across all
 * three record kinds. Demonstration rows are excluded from the real registry
 * by the same isolation rule as everywhere else.
 */
export default async function RegistryPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('viewRegistry');
  const { notice, error } = (await searchParams) ?? {};
  const flag = account.isDemo ? 1 : 0;
  const today = beirutToday();
  const db = getDb();
  const events = db
    .prepare(`SELECT e.id, e.name_en, e.name_ar, s.moph_reference FROM events e LEFT JOIN submissions s ON s.event_id = e.id WHERE e.is_demo = ? ORDER BY e.id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; moph_reference: string | null }[];
  const venues = db
    .prepare(`SELECT id, name_en, name_ar, moph_reference, valid_until, archived_at FROM venues WHERE is_demo = ? ORDER BY id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; moph_reference: string | null; valid_until: string | null; archived_at: string | null }[];
  const facilities = db
    .prepare(`SELECT id, name_en, name_ar, archived_at FROM facilities WHERE is_demo = ? ORDER BY id`)
    .all(flag) as unknown as { id: string; name_en: string; name_ar: string; archived_at: string | null }[];

  const section = (
    titleEn: string,
    titleAr: string,
    rows: { id: string; name_en: string; name_ar: string; moph_reference?: string | null; control?: React.ReactNode }[],
  ) => (
    <div style={{ marginBlockEnd: 28 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
        <L en={titleEn} ar={titleAr} />
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((r) => (
          <div key={r.id} style={{ background: 'var(--bg)', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.id}</span> · <L en={r.name_en} ar={r.name_ar} />
            </span>
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{r.moph_reference ?? '—'}</span>
              {r.control ?? null}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ background: 'var(--bg)', padding: '12px 18px', fontSize: 14, color: 'var(--muted)' }}>
            <L en="No records." ar="لا سجلات." />
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="National registry" ar="السجل الوطني" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '82ch', lineHeight: 1.6 }}>
        <L
          en="Record identifier at creation; Ministry reference number at submission."
          ar="معرّف السجل عند الإنشاء؛ والرقم المرجعي للوزارة عند التقديم."
        />
      </p>
      {notice === 'archived' ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="Archived. The record moved to the owner's Previous services and is read-only." ar="أُرشف. انتقل السجل إلى الخدمات السابقة لدى صاحبه وصار للقراءة فقط." />
        </div>
      ) : null}
      {error === 'not-concluded' ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="That venue's classification is still in force; a live obligation is not archived." ar="لا يزال تصنيف هذا الموقع سارياً؛ ولا يُؤرشف موجب قائم." />
        </div>
      ) : null}
      {section('Events', 'الفعاليات', events)}
      {section(
        'Recurring venues',
        'مواقع الفعاليات المتكررة',
        venues.map((v) => ({
          ...v,
          // The control exists only where the venue lane has CONCLUDED -- an expired
          // classification. Absent, not greyed, everywhere else (non-negotiable 10).
          control: v.archived_at ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              <L en={`Archived ${v.archived_at.slice(0, 10)}`} ar={`أُرشف في ⁦${v.archived_at.slice(0, 10)}⁩`} />
            </span>
          ) : v.valid_until && v.valid_until < today ? (
            <form action={archiveVenueRecordAction}>
              <input type="hidden" name="venueId" value={v.id} />
              <button type="submit" style={{ height: 28, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 14, fontSize: 12, cursor: 'pointer' }}>
                <L en="Archive" ar="أرشفة" />
              </button>
            </form>
          ) : null,
        })),
      )}
      {section(
        'Covered facilities',
        'المرافق المشمولة',
        facilities.map((f) => ({
          ...f,
          // No concluded state exists for a facility in the instrument, so this is
          // the administrator's judgment; the consequence is stated on the notice.
          control: f.archived_at ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              <L en={`Archived ${f.archived_at.slice(0, 10)}`} ar={`أُرشف في ⁦${f.archived_at.slice(0, 10)}⁩`} />
            </span>
          ) : (
            <form action={archiveFacilityRecordAction}>
              <input type="hidden" name="facilityId" value={f.id} />
              <button type="submit" style={{ height: 28, paddingInline: 11, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 14, fontSize: 12, cursor: 'pointer' }}>
                <L en="Archive" ar="أرشفة" />
              </button>
            </form>
          ),
        })),
      )}
    </MinistryShell>
  );
}
