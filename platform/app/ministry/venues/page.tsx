import Link from 'next/link';
import { ServiceSearch } from '../../../components/ServiceSearch';
import { MinistryShell } from '../../../components/MinistryShell';
import { L } from '../../../components/L';
import { chip } from '../../../components/workspace-styles';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { getDb } from '../../../lib/db';
import { beirutToday } from '../../../lib/clock';
import { venueRegisterState, type VenuePackageStatus } from '../../../lib/rules/venue-workflow';
import { VenueRetiredMinistryNotice } from '../../../components/venue/VenueRetiredNotice';

const EDGE = { pending: 'var(--accent)', done: 'var(--brand)', bad: 'var(--bad)', muted: 'var(--line)' } as const;

/**
 * The Ministry's register of hosting venues, kept as a read-only historical list: hosting venue
 * registration is replaced by Facility/Site registration (owner, 9 October 2026). Nothing is
 * deleted; no venue is an active regulatory entity, so nothing here asks for a review.
 */
export default async function MinistryVenues({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const account = await requireMinistryPage('viewMinistry');
  const { q = '' } = await searchParams;
  const rows = getDb()
    .prepare(
      `SELECT v.id, v.name_en, v.name_ar, v.level, v.valid_until, p.status, p.submitted_at
       FROM venues v LEFT JOIN venue_packages p ON p.venue_id = v.id
       WHERE v.is_demo = ?
       ORDER BY CASE WHEN p.status = 'submitted' THEN 0 ELSE 1 END, p.submitted_at DESC, v.valid_until ASC`,
    )
    .all(Number(account.isDemo)) as unknown as { id: string; name_en: string; name_ar: string; level: number | null; valid_until: string | null; status: VenuePackageStatus | null; submitted_at: string | null }[];
  const today = beirutToday();
  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((v) => [v.id, v.name_en, v.name_ar].join(' ').toLowerCase().includes(needle));
  const waiting = rows.filter((v) => v.status === 'submitted').length;
  const expired = rows.filter((v) => v.valid_until && v.valid_until < today).length;

  return (
    <MinistryShell account={account}>
      <h1 style={{ margin: '0 0 8px', fontSize: 28 }}><L en="Hosting venues (historical)" ar="المواقع المستضيفة (سجل سابق)" /></h1>
      <VenueRetiredMinistryNotice />
      <p style={{ margin: '0 0 20px', color: 'var(--muted)' }}>
        <L
          en={`${rows.length} ${rows.length === 1 ? 'venue' : 'venues'} · ${waiting} submitted before the change`}
          ar={`المواقع: ${rows.length} · مقدّمة قبل التغيير: ${waiting}`}
        />
      </p>
      <ServiceSearch value={q} en="Search hosting venues" ar="البحث عن مواقع استضافة الفعاليات" />
      {filtered.length === 0 ? (
        <p style={{ padding: '16px 22px', background: 'var(--surface2)', borderRadius: 12 }}>
          <L en="No matching hosting venues." ar="لا توجد مواقع مطابقة." />
        </p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockStart: 16 }}>
        {filtered.map((v) => {
          const state = venueRegisterState({ status: v.status, validUntil: v.valid_until, today });
          return (
            <article key={v.id} data-venue={v.id} style={{ paddingBlock: '18px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px solid ${EDGE[state.tone]}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}><L en={v.name_en} ar={v.name_ar} /></div>
                <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {v.id}{v.level ? <> · <L en={`Level ${v.level}`} ar={`المستوى ${v.level}`} /></> : null}{v.submitted_at ? <> · <L en={`Submitted ${v.submitted_at.slice(0, 10)}`} ar={`قُدّم في ⁦${v.submitted_at.slice(0, 10)}⁩`} /></> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: '0 1 auto', minWidth: 0 }}>
                <span style={chip(state.tone)}><L en={state.en} ar={state.ar} /></span>
                {v.submitted_at ? (
                  <Link href={`/ministry/venues/${v.id}`} style={{ minHeight: 44, paddingInline: 16, borderRadius: 22, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                    <L en="Open file" ar="فتح الملف" />
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </MinistryShell>
  );
}
