import Link from 'next/link';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import { resolvePublicLookup } from '../../lib/rules';
import { findSubmissionByReference } from '../../lib/queries';

/**
 * VERIFY A REFERENCE NUMBER — Slice 0, the screen in front of an endpoint that
 * already worked.
 *
 * The projection has existed since Slice 1 and returns exactly four fields. What did
 * not exist was a page: a member of the public holding a Ministry reference number had
 * no way to check it without calling an API by hand.
 *
 * IT ASKS FOR TWO THINGS, and that is the point rather than friction. References are
 * sequential, so a reference alone plus an unauthenticated lookup would let anyone walk
 * the national register by counting upwards (non-negotiable 5b). The event's start date
 * is the second factor: somebody holding a real reference knows it, and somebody
 * guessing does not.
 *
 * FOUR FIELDS AND NO MORE: existence, event name, level, current status. Never contact
 * details, never documents, never answers. The projection enforces that on the server;
 * this screen renders what it returns and cannot widen it.
 */
export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; eventStartDate?: string }>;
}) {
  const account = await currentAccount();
  const { reference, eventStartDate } = await searchParams;
  const asked = (reference ?? '').trim() !== '' && (eventStartDate ?? '').trim() !== '';

  // THE SAME RESOLVER AND THE SAME FINDER THE ENDPOINT USES. Not a second query of
  // the register: two readings of one register is how a page and an API end up
  // disagreeing about the same event.
  const result = asked
    ? resolvePublicLookup(
        { referenceNumber: (reference ?? '').trim(), eventStartDate: (eventStartDate ?? '').trim() },
        findSubmissionByReference,
      )
    : null;

  const field: React.CSSProperties = {
    height: 46,
    paddingInline: 14,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 15,
  };

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Overview" ar="نظرة عامة" />
      </Link>
      <h1 data-sec-h1="" style={{ margin: '10px 0 10px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Verify a reference number" ar="التحقق من رقم مرجعي" />
      </h1>
      <p style={{ margin: '0 0 8px', fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
        <L
          en="Confirm that a Ministry reference exists, and what it says. No account, and using this creates no obligation."
          ar="تأكدوا من وجود رقم مرجعي لدى الوزارة وممّا يفيده. من دون حساب، ولا ينشئ استخدام هذا أي موجب."
        />
      </p>
      <p style={{ margin: '0 0 28px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
        <L
          en="The event's start date is asked for as well as the reference. Somebody holding a genuine reference knows it, and asking for it is what stops the register being read by counting upwards."
          ar="يُطلب تاريخ بدء الفعالية إلى جانب الرقم المرجعي. فمن يحمل رقماً حقيقياً يعرفه، وطلبه هو ما يمنع قراءة السجل بالعد التصاعدي."
        />
      </p>

      <form method="get" data-region="lookup-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, alignItems: 'end', maxWidth: 700, marginBlockEnd: 28 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="Ministry reference number" ar="الرقم المرجعي لدى الوزارة" />
          </span>
          <input name="reference" defaultValue={reference ?? ''} placeholder="MOPH-EV-2026-0000" required style={field} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="Event start date" ar="تاريخ بدء الفعالية" />
          </span>
          <input name="eventStartDate" type="date" defaultValue={eventStartDate ?? ''} required style={field} />
        </label>
        <button type="submit" style={{ height: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          <L en="Verify" ar="تحقق" />
        </button>
      </form>

      {result ? (
        <div data-region="lookup-result" style={{ padding: '24px 26px', border: '2px solid var(--line)', borderRadius: 14, maxWidth: '70ch' }}>
          {!result.exists ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, marginBlockEnd: 8 }}>
                <L en="No record answers that" ar="لا سجل يطابق ذلك" />
              </div>
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
                <L
                  en="Either no filed submission carries that reference, or the start date does not match it. Both answer the same way, so nothing here reveals which."
                  ar="إما أنه لا تقديم مقدَّم يحمل ذلك الرقم، أو أن تاريخ البدء لا يطابقه. ويُجاب على الحالتين بالطريقة نفسها، فلا يكشف شيء هنا أيهما."
                />
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="On the register" ar="في السجل" />
              </div>
              {[
                { en: 'Event', ar: 'الفعالية', v: result.eventName },
                { en: 'Level', ar: 'المستوى', v: result.level === null ? '—' : String(result.level) },
                { en: 'Current status', ar: 'الحالة الراهنة', v: result.status },
              ].map((r) => (
                <div key={r.en} style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingBlock: 10, borderBlockEnd: '1px solid var(--line)' }}>
                  <span style={{ flex: '0 0 160px', fontSize: '12.5px', color: 'var(--muted)' }}>
                    <L en={r.en} ar={r.ar} />
                  </span>
                  <span style={{ flex: 1, minWidth: 180, fontSize: '15px' }}>{r.v}</span>
                </div>
              ))}
              <p style={{ margin: '16px 0 0', fontSize: '13px', lineHeight: 1.7, color: 'var(--muted)' }}>
                <L
                  en="These four facts are all the register discloses publicly. Contact details, documents and assessment answers are never returned."
                  ar="هذه الوقائع الأربع هي كل ما يفصح عنه السجل علناً. أما بيانات الاتصال والمستندات وإجابات التقييم فلا تُعاد أبداً."
                />
              </p>
            </>
          )}
        </div>
      ) : null}
    </PublicShell>
  );
}
