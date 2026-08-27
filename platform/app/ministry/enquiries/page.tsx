import { L } from '../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { enquiriesForReview } from '../../../lib/queries';
import { can } from '../../../lib/rules';
import { respondEnquiryAction } from '../../ministry-actions';

/** Enquiries against a determination. The outcome does not change here. */
export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await requireMinistryPage('viewMinistry');
  const { notice } = await searchParams;
  const rows = enquiriesForReview(account.isDemo);
  const mayRespond = can(account.role, 'respondEnquiry');

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      {notice === 'responded' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The response has been recorded and sent as written." ar="سُجّل الرد وأُرسل كما كُتب." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Enquiries" ar="الاستفسارات" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '80ch', lineHeight: 1.6 }}>
        <L en="A question against a determination. Answering it does not change the outcome; a changed outcome is a new determination on the submission." ar="سؤال على نتيجة. والإجابة عنه لا تغيّر النتيجة؛ والنتيجة المتغيرة قرار جديد على التقديم." />
      </p>
      <div data-region="enquiries" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((e) => (
          <div key={e.id} style={{ paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: `3px solid ${e.repliedAt ? 'var(--brand)' : 'var(--accent)'}`, borderRadius: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                <L en={e.eventEn} ar={e.eventAr} />
                {e.mophReference ? <span style={{ fontWeight: 400, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}> · {e.mophReference}</span> : null}
              </span>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: e.repliedAt ? 'var(--brand-soft)' : 'var(--accent-soft)', color: e.repliedAt ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
                {e.repliedAt ? <L en="Responded" ar="أُجيب عنه" /> : <L en="Awaiting a Ministry response" ar="بانتظار رد الوزارة" />}
              </span>
            </div>
            <div style={{ fontSize: '14.5px', lineHeight: 1.65, marginBlockEnd: 6 }}>{e.question}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: e.repliedAt || mayRespond ? 12 : 0 }}>
              {e.askedBy} · {e.askedAt}
            </div>
            {e.repliedAt ? (
              <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8 }}>
                <div style={{ fontSize: '13.5px', lineHeight: 1.65 }}>{e.reply}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockStart: 6, fontVariantNumeric: 'tabular-nums' }}>
                  {e.repliedBy} · {e.repliedAt}
                </div>
              </div>
            ) : mayRespond ? (
              <form action={respondEnquiryAction.bind(null, e.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 260 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <L en="Response — sent to the organizer as written" ar="الرد — يُرسل إلى المنظّم كما هو مكتوب" />
                  </span>
                  <textarea name="reply" rows={2} required style={{ padding: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
                </label>
                <button type="submit" style={{ height: 38, paddingInline: 16, border: 0, borderRadius: 19, background: 'var(--brand)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  <L en="Send" ar="إرسال" />
                </button>
              </form>
            ) : null}
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
            <L en="No enquiries." ar="لا استفسارات." />
          </div>
        ) : null}
      </div>
      <MinistryFooter steps={[{ href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'The submissions the enquiries concern.', descAr: 'التقديمات التي تخصها الاستفسارات.' }]} />
    </MinistryShell>
  );
}
