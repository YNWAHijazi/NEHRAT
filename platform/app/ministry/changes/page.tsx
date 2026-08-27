import Link from 'next/link';
import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { changesForReview } from '../../../lib/queries';

/** Material changes and declined nominations, newest first. */
export default async function ChangesPage() {
  const account = await requireMinistryPage('viewMinistry');
  const rows = changesForReview(account.isDemo);
  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Changes and notifications" ar="التغييرات والإشعارات" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L
          en="A declined nomination is a material change the organizer must report; it appears here the moment the party declines."
          ar="الترشيح المعتذَر عنه تغيير جوهري على المنظّم الإبلاغ عنه؛ ويظهر هنا لحظة اعتذار الطرف."
        />
      </p>
      <div data-region="changes" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((c) => (
          <Link key={`${c.kind}-${c.eventId}-${c.when}`} href={`/ministry/submissions/${c.eventId}`} style={{ paddingBlock: '16px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px solid ${c.kind === 'declined' ? 'var(--bad)' : 'var(--accent)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', color: 'var(--ink)' }}>
          <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}>
            <L en={`${c.eventEn} — ${c.detailEn}`} ar={`${c.eventAr} — ${c.detailAr}`} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{c.when}</span>
          </Link>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
            <L en="Nothing reported." ar="لا شيء مبلَّغاً." />
          </div>
        ) : null}
      </div>
      <MinistryFooter steps={[{ href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'The submissions the changes land on.', descAr: 'التقديمات التي تقع عليها التغييرات.' }]} />
    </MinistryShell>
  );
}
