import Link from 'next/link';
import { L } from '../../../../components/L';
import { MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { siteReviewQueue } from '../../../../lib/site-registration';
import { FACILITY_CONTENT } from '../../../../lib/rules';
import { siteStatusLabel, siteStatusTone } from '../../../../lib/rules/site';

const TONE = {
  grey: { color: 'var(--muted)', bg: 'var(--surface2)' },
  accent: { color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
  bad: { color: 'var(--bad)', bg: 'var(--bad-soft)' },
  brand: { color: 'var(--brand)', bg: 'var(--brand-soft)' },
} as const;

/**
 * THE FACILITY/SITE REVIEW QUEUE (latest revision, 9 October 2026, section 9): every site
 * submitted to the Ministry at least once, those awaiting the Ministry first. One row per
 * site -- one consolidated record, never separate venue and facility applications.
 * Demonstration sites never reach a real queue.
 */
export default async function SiteReviewQueuePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const account = await requireMinistryPage('viewFacilityLane');
  const { error } = await searchParams;
  const rows = siteReviewQueue(account.isDemo);
  const short = (key: string) => FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortEn?: string; shortAr?: string } | undefined;
  const head: React.CSSProperties = { background: 'var(--surface2)', padding: '10px 14px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' };
  const cell: React.CSSProperties = { background: 'var(--bg)', padding: '12px 14px', fontSize: 14, lineHeight: 1.45, minWidth: 0 };

  return (
    <MinistryShell account={account} back={{ href: '/ministry/facilities', en: 'Facility oversight', ar: 'الرقابة على المرافق' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Facility/site review queue" ar="قائمة مراجعة المنشآت/المواقع" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '14.5px', color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L en="Sites submitted to the Ministry. Each opens one consolidated record: the site, its cardiac readiness, its AEDs, its supporting evidence and its history." ar="المواقع المقدَّمة إلى الوزارة. يفتح كل منها سجلاً موحّداً: الموقع وجاهزيته لتوقف القلب وأجهزته وأدلته الداعمة وسجله." />
      </p>
      {error === 'unknown' ? <p role="alert"><L en="There is no site with that reference in this console." ar="لا موقع بهذا المرجع في هذه اللوحة." /></p> : null}
      {rows.length === 0 ? (
        <p data-region="site-queue-empty" style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
          <L en="No site has been submitted." ar="لم يُقدَّم أي موقع." />
        </p>
      ) : (
        <div data-region="site-queue" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(180px,2fr) 1.4fr 1fr 1fr 1.2fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {([['Site ID', 'معرّف الموقع'], ['Site', 'الموقع'], ['Category', 'الفئة'], ['Version', 'الإصدار'], ['Submitted', 'تاريخ التقديم'], ['Status', 'الحالة']] as const).map(([en, ar]) => (
            <div key={en} data-th="" style={head}><L en={en} ar={ar} /></div>
          ))}
          {rows.map((r) => {
            const label = siteStatusLabel(r.status);
            const tone = TONE[siteStatusTone(r.status)];
            const c = short(r.categoryKey);
            return [
              <div key={`${r.facilityId}-site`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{r.siteId ?? '—'}</div>,
              <div key={`${r.facilityId}-name`} data-queue-row={r.facilityId} style={{ ...cell, fontWeight: 500 }}>
                <Link href={`/ministry/facilities/${r.facilityId}`}><L en={r.nameEn} ar={r.nameAr} /></Link>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 400, color: 'var(--muted)' }}>{r.facilityId}{r.municipality ? ` · ${r.municipality}` : ''}</span>
              </div>,
              <div key={`${r.facilityId}-cat`} style={cell}><L en={c?.shortEn ?? r.categoryKey} ar={c?.shortAr ?? r.categoryKey} /></div>,
              <div key={`${r.facilityId}-v`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{r.version}</div>,
              <div key={`${r.facilityId}-at`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{r.submittedAt.slice(0, 10)}</div>,
              <div key={`${r.facilityId}-st`} style={cell}>
                <span data-status={r.status} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: '12.5px' }}><L en={label.en} ar={label.ar} /></span>
              </div>,
            ];
          })}
        </div>
      )}
    </MinistryShell>
  );
}
