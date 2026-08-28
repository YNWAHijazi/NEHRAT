import Link from 'next/link';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import { PUBLIC_LANDING } from '../../lib/rules';

/**
 * ASK THE MINISTRY — where a question this platform does not answer goes.
 *
 * THIS SCREEN CARRIES NO TELEPHONE NUMBER AND NO ADDRESS, and that is not an
 * oversight. The Ministry's published contact channels are a real-world fact this
 * build does not hold, and inventing a plausible one would be worse than saying so:
 * somebody would use it.
 *
 * It is not a dead end either, which is the distinction that matters. It names WHO
 * answers, WHAT they answer, and what this platform does and does not carry. A person
 * leaves knowing where the question goes, rather than looking at a form that quietly
 * goes nowhere — and a message box that stored a question nobody reads would be the
 * worse failure of the two.
 */
export default async function ContactPage() {
  const account = await currentAccount();
  const P = PUBLIC_LANDING;

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Overview" ar="نظرة عامة" />
      </Link>
      <h1 data-sec-h1="" style={{ margin: '10px 0 14px', fontSize: 32, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={P.contactEn} ar={P.contactAr} />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '16px', lineHeight: 1.7, maxWidth: '72ch' }}>
        <L en={P.contactBodyEn} ar={P.contactBodyAr} />
      </p>

      <div data-region="contact-scope" style={{ padding: '22px 26px', background: 'var(--surface2)', borderRadius: 14, maxWidth: '80ch', marginBlockEnd: 20 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="What the Ministry answers" ar="ما تجيب عنه الوزارة" />
        </div>
        <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: '14.5px', lineHeight: 1.9 }}>
          {[
            ['Whether an event, venue or facility falls within either instrument', 'ما إذا كانت فعالية أو موقع أو منشأة تقع ضمن أي من الصكّين'],
            ['Whether the Ministry has designated a particular event', 'ما إذا كانت الوزارة قد حددت فعالية بعينها'],
            ['A determination already recorded on a submission', 'نتيجة سبق تسجيلها على تقديم'],
            ['A value the Ministry has not yet published', 'قيمة لم تنشرها الوزارة بعد'],
          ].map(([en, ar]) => (
            <li key={en}>
              <L en={en!} ar={ar!} />
            </li>
          ))}
        </ul>
      </div>

      <div data-region="contact-channel" style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 14, maxWidth: '80ch' }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en="How to reach them" ar="كيفية التواصل معهم" />
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.7 }}>
          <L
            en="Use the Ministry of Public Health's own published contact channels. This platform does not carry messages to the Ministry, and it does not publish contact details of its own — a number shown here that turned out to be wrong would be worse than none."
            ar="استخدموا قنوات التواصل التي تنشرها وزارة الصحة العامة نفسها. فهذه المنصة لا تنقل الرسائل إلى الوزارة، ولا تنشر بيانات اتصال خاصة بها — إذ إن رقماً يظهر هنا ويتبيّن أنه خاطئ أسوأ من عدم وجود رقم."
          />
        </p>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
          <L
            en="If you already hold a Ministry reference number, the record itself answers most questions and can be checked without an account."
            ar="إذا كنتم تحملون رقماً مرجعياً من الوزارة، فالسجل نفسه يجيب عن معظم الأسئلة ويمكن التحقق منه من دون حساب."
          />
        </p>
        <Link href="/lookup" style={{ display: 'inline-flex', alignItems: 'center', height: 40, paddingInline: 18, marginBlockStart: 14, border: '1px solid var(--line)', borderRadius: 20, fontSize: '13.5px', color: 'var(--ink)' }}>
          <L en="Verify a reference number" ar="التحقق من رقم مرجعي" />
        </Link>
      </div>
    </PublicShell>
  );
}
