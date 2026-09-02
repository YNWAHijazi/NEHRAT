import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { applicabilityRecords } from '../../../lib/queries';
import { can } from '../../../lib/rules';
import { determineApplicabilityAction, logReferralAction } from '../../ministry-actions';

/**
 * Applicability (Protocol 3). Referrals arrive from outside the platform -- a
 * municipality, an authority, the Ministry's own knowledge of an unregistered
 * gathering -- and each is DETERMINED in or out of scope with the reasons
 * recorded. An in-scope determination may designate the event. The reasons are
 * the record: a determination without them is refused.
 */
export default async function ApplicabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('viewMinistry');
  const { notice, error } = await searchParams;
  const rows = applicabilityRecords(account.isDemo);
  const mayDetermine = can(account.role, 'recordOutcome');
  const mayLog = can(account.role, 'respondEnquiry');

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      {notice ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {notice === 'logged' ? <L en="Referral logged. It awaits a determination." ar="سُجّلت الإحالة. وتنتظر قراراً." /> : <L en="Determined, with the reasons recorded." ar="حُسمت، مع تسجيل الأسباب." />}
        </div>
      ) : null}
      {error ? (
        <div style={{ padding: '14px 20px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          {error === 'name' ? <L en="The event or gathering must be named." ar="يجب تسمية الفعالية أو التجمع." /> : <L en="A determination requires its reasons, recorded as written." ar="القرار يتطلب أسبابه، مسجَّلة كما كُتبت." />}
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Applicability, referrals and designations" ar="الانطباق والإحالات والتحديدات" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L
          en="Events that reached the Ministry from outside the platform, each determined in or out of scope with the reasons recorded."
          ar="فعاليات وصلت الوزارة من خارج المنصة، يُحسم كل منها ضمن النطاق أو خارجه مع تسجيل الأسباب."
        />
      </p>

      <div data-region="applicability" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px solid ${r.determination === 'undetermined' ? 'var(--accent)' : r.determination === 'in_scope' ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 6 }}>
              <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                {r.eventName}
                {r.source ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · <L en={`referred by ${r.source}`} ar={`أحالها ${r.source}`} /></span> : null}
              </span>
              <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, fontSize: '12.5px', background: r.determination === 'undetermined' ? 'var(--accent-soft)' : r.determination === 'in_scope' ? 'var(--brand-soft)' : 'var(--surface)', color: r.determination === 'undetermined' ? 'var(--accent-ink)' : r.determination === 'in_scope' ? 'var(--brand)' : 'var(--muted)' }}>
                {r.determination === 'undetermined' ? (
                  <L en="Awaiting determination — the reviewer's" ar="بانتظار القرار — للمراجع" />
                ) : r.determination === 'in_scope' ? (
                  <L en={r.designated ? 'In scope — designated' : 'In scope'} ar={r.designated ? 'ضمن النطاق — محدَّدة' : 'ضمن النطاق'} />
                ) : (
                  <L en="Not in scope" ar="خارج النطاق" />
                )}
              </span>
            </div>
            {r.note ? <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>{r.note}</div> : null}
            {r.determination !== 'undetermined' ? (
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.6 }}>
                <L en={`Reasons, as recorded: “${r.reasons}” · ${r.recordedBy} · ${r.determinedAt ?? ''}`} ar={`الأسباب كما سُجّلت: «${r.reasons}» · ${r.recordedBy} · ⁦${r.determinedAt ?? ''}⁩`} />
                {r.designated ? (
                  <span style={{ display: 'block', marginBlockStart: 3 }}>
                    <L en="Designated: the organizer is directed to register the event; its obligations run from the designation." ar="محدَّدة: يُوجَّه المنظّم إلى تسجيل الفعالية؛ وتسري موجباتها من التحديد." />
                  </span>
                ) : null}
              </div>
            ) : null}
            {mayDetermine && r.determination === 'undetermined' ? (
              <form action={determineApplicabilityAction.bind(null, r.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBlockStart: 10 }}>
                <select name="determination" required aria-label="Determination" style={{ height: 32, paddingInline: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }}>
                  <option value="in_scope">In scope</option>
                  <option value="out_of_scope">Not in scope</option>
                </select>
                <input name="reasons" required aria-label="Reasons" style={{ flex: 1, minWidth: 220, height: 32, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }} />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '12.5px' }}>
                  <input type="checkbox" name="designated" value="1" />
                  <L en="Designate" ar="تحديد" />
                </label>
                <button type="submit" style={{ height: 32, paddingInline: 13, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}>
                  <L en="Record the determination" ar="تسجيل القرار" />
                </button>
              </form>
            ) : null}
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
            <L en="No referrals logged." ar="لا إحالات مسجَّلة." />
          </div>
        ) : null}
      </div>

      {mayLog ? (
        <form action={logReferralAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', padding: '16px 20px', background: 'var(--surface2)', borderRadius: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Event or gathering" ar="الفعالية أو التجمع" /></span>
            <input name="eventName" required style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Referred by" ar="الجهة المُحيلة" /></span>
            <input name="source" style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2, minWidth: 220 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}><L en="Note" ar="ملاحظة" /></span>
            <input name="note" style={{ height: 36, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
          </label>
          <button type="submit" style={{ height: 36, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 13, cursor: 'pointer' }}>
            <L en="Log the referral" ar="تسجيل الإحالة" />
          </button>
        </form>
      ) : null}
    </MinistryShell>
  );
}
