import Link from 'next/link';
import { ServiceSearch } from '../../../../components/ServiceSearch';
import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { daysBetween } from '../../../../lib/queries';
import { beirutToday } from '../../../../lib/clock';
import { siteReviewQueue } from '../../../../lib/site-registration';
import { FACILITY_CONTENT } from '../../../../lib/rules';
import { siteStatusLabel, siteStatusTone } from '../../../../lib/rules/site';

/**
 * THE FACILITY/SITE REVIEW QUEUE (latest revision, 9 October 2026, section 9), in the event
 * review queue's look (owner: "the same queue look as the event review queue"): one row per
 * site -- one consolidated record, never separate venue and facility applications. Internal
 * workflow states render GREY, as on the event queue; the PAD statuses keep their own words.
 * Demonstration sites never reach a real queue. No level column: a site carries none.
 */
export default async function SiteReviewQueuePage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const account = await requireMinistryPage('viewFacilityLane');
  const { q = '', error } = await searchParams;
  const today = beirutToday();
  const short = (key: string) => FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortEn?: string; shortAr?: string } | undefined;
  const rows = siteReviewQueue(account.isDemo).filter((r) => Object.values(r).join(' ').toLowerCase().includes(q.trim().toLowerCase()));
  const cell: React.CSSProperties = { background: 'var(--bg)', padding: '14px 16px', fontSize: 14, lineHeight: 1.4, minWidth: 0 };

  return (
    <MinistryShell account={account} back={{ href: '/ministry/facilities', en: 'Facility oversight', ar: 'الرقابة على المرافق' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Facility/site review queue" ar="قائمة مراجعة المنشآت/المواقع" />
      </h1>
      <ServiceSearch value={q} />
      {error === 'unknown' ? <p role="alert"><L en="There is no site with that reference in this console." ar="لا موقع بهذا المرجع في هذه اللوحة." /></p> : null}
      <div data-region="site-queue" data-stack="" data-xscroll="" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.1fr 1.1fr .9fr 1.1fr 1.2fr .9fr .7fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { en: 'Facility/site', ar: 'المنشأة/الموقع' },
          { en: 'Operator', ar: 'الجهة المشغّلة' },
          { en: 'Category', ar: 'الفئة' },
          { en: 'Municipality', ar: 'البلدية' },
          { en: 'Filing date', ar: 'تاريخ التقديم' },
          { en: 'Status', ar: 'الحالة' },
          { en: 'Reviewer', ar: 'المراجع' },
          { en: 'Days', ar: 'أيام' },
        ].map((h) => (
          <div key={h.en} data-th="" style={{ background: 'var(--surface2)', padding: '11px 16px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={h.en} ar={h.ar} />
          </div>
        ))}
        {rows.map((r) => {
          const label = siteStatusLabel(r.status);
          const tone = siteStatusTone(r.status);
          const c = short(r.categoryKey);
          const filed = r.submittedAt.slice(0, 10);
          return [
            <Link key={`${r.facilityId}-a`} href={`/ministry/facilities/${r.facilityId}`} data-queue-row={r.facilityId} style={{ ...cell, borderInlineStart: `3px solid ${tone === 'brand' ? 'var(--brand)' : tone === 'bad' ? 'var(--bad)' : tone === 'accent' ? 'var(--accent)' : 'var(--line)'}`, color: 'var(--ink)' }}>
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}><L en={r.nameEn} ar={r.nameAr} /></div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>{r.siteId ?? r.facilityId}{r.version > 1 ? ` · v${r.version}` : ''}</div>
            </Link>,
            <div key={`${r.facilityId}-org`} style={cell}>{r.operator || '—'}</div>,
            <div key={`${r.facilityId}-cat`} style={cell}><L en={c?.shortEn ?? r.categoryKey} ar={c?.shortAr ?? r.categoryKey} /></div>,
            <div key={`${r.facilityId}-mun`} style={{ ...cell, color: 'var(--muted)' }}>{r.municipality || '—'}</div>,
            <div key={`${r.facilityId}-at`} style={{ ...cell, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{filed}</div>,
            <div key={`${r.facilityId}-st`} style={{ ...cell, fontSize: '12.5px' }}>
              {/* Internal workflow state: grey, quiet, not an outcome. */}
              <span data-status={r.status} style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 13, lineHeight: 1.4, background: tone === 'brand' ? 'var(--brand-soft)' : tone === 'bad' ? 'var(--bad-soft)' : tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface2)', color: tone === 'brand' ? 'var(--brand)' : tone === 'bad' ? 'var(--bad)' : tone === 'accent' ? 'var(--accent-ink)' : 'var(--muted)' }}>
                <L en={label.en} ar={label.ar} />
              </span>
            </div>,
            <div key={`${r.facilityId}-rv`} style={{ ...cell, color: 'var(--muted)' }}>{r.reviewer || '—'}</div>,
            <div key={`${r.facilityId}-d`} style={{ ...cell, fontSize: '13.5px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{daysBetween(filed, today)}</div>,
          ];
        })}
        {rows.length === 0 ? (
          <div data-region="site-queue-empty" style={{ background: 'var(--bg)', padding: '18px 16px', gridColumn: '1 / -1', fontSize: 14, color: 'var(--muted)' }}>
            <L en="Nothing is in the queue." ar="لا شيء في القائمة." />
          </div>
        ) : null}
      </div>
    </MinistryShell>
  );
}
