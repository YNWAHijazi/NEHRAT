import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { organizationsForReview } from '../../../lib/queries';
import { can } from '../../../lib/rules';
import { recordOrganizationAction } from '../../ministry-actions';

/**
 * Organizations. Recording is the act that opens filing for the organizer --
 * a state change, not a determination on any submission.
 */
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await requireMinistryPage('viewMinistry');
  const { notice } = await searchParams;
  const rows = organizationsForReview(account.isDemo);
  const mayRecord = can(account.role, 'recordOrganization');

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      {notice === 'recorded' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="Recorded. Filing is open for the organizer, and they have been notified." ar="سُجّلت. وفُتح التقديم للمنظّم، وأُبلغ بذلك." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Organizations" ar="المؤسسات" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L
          en="A pending organization can create, assess, gather and draft. Only Submit waits on this screen."
          ar="يمكن للمؤسسة المعلّقة الإنشاء والتقييم والتجميع والمسودات. والتقديم وحده ينتظر هذه الشاشة."
        />
      </p>
      <div data-region="orgs" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((o) => (
          <div key={o.id} style={{ padding: '16px 20px', border: '1px solid var(--line)', borderInlineStart: `3px ${o.status === 'recorded' ? 'solid var(--brand)' : 'dashed var(--accent-ink)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15 }}>
              <L en={o.nameEn} ar={o.nameAr} />
            </span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
              {o.status === 'recorded' ? (
                <span style={{ padding: '3px 9px', borderRadius: 4, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                  <L en={`Recorded${o.recordedAt ? ` ${o.recordedAt.slice(0, 10)}` : ''}`} ar={`مسجَّلة${o.recordedAt ? ` ⁦${o.recordedAt.slice(0, 10)}⁩` : ''}`} />
                </span>
              ) : (
                <span style={{ padding: '3px 9px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: '12.5px' }}>
                  <L en="Awaiting recording" ar="بانتظار التسجيل" />
                </span>
              )}
              {mayRecord && o.status === 'pending' ? (
                <form action={recordOrganizationAction.bind(null, o.id)}>
                  <button type="submit" style={{ height: 34, paddingInline: 14, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    <L en="Record the organization" ar="تسجيل المؤسسة" />
                  </button>
                </form>
              ) : null}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
            <L en="No organizations." ar="لا مؤسسات." />
          </div>
        ) : null}
      </div>
      <MinistryFooter steps={[{ href: '/ministry', en: 'Dashboard', ar: 'اللوحة', descEn: 'Every count, derived from the records.', descAr: 'كل الأعداد مستمدة من السجلات.' }]} />
    </MinistryShell>
  );
}
