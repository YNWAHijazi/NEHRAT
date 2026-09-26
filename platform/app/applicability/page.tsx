import Link from 'next/link';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import { PUBLIC_LANDING, RECURRING_VENUE_MIN_CAPACITY, eventApplicability, facilityApplicability, venueApplicability } from '../../lib/rules';

export default async function ApplicabilityPage({ searchParams }: {
  searchParams: Promise<{ subject?: string; c?: string | string[]; checked?: string; eligible?: string; hosts?: string; cap?: string; cat?: string }>;
}) {
  const account = await currentAccount();
  const q = await searchParams;
  const P = PUBLIC_LANDING;
  const subject = ['event', 'venue', 'facility'].includes(q.subject ?? '') ? q.subject : null;
  const selected = (Array.isArray(q.c) ? q.c : q.c ? [q.c] : []).map(Number);
  const answer = subject === 'event' && (q.checked === '1' || q.c !== undefined)
    ? eventApplicability(selected)
    : subject === 'venue' && (q.eligible !== undefined || q.hosts !== undefined)
      ? venueApplicability(q.eligible === 'yes' || q.hosts === '1', q.eligible === 'yes' || q.cap === '1')
      : subject === 'facility' && q.cat !== undefined ? facilityApplicability(Number(q.cat)) : null;
  const box: React.CSSProperties = { padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 12 };
  const button: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 22, marginBlockStart: 16, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, cursor: 'pointer' };
  return <PublicShell signedIn={account !== null}>
    <h1 style={{ margin: '0 0 24px', fontSize: 32 }}><L en="Which service do you need?" ar="ما الخدمة التي تحتاجون إليها؟" /></h1>
    <div data-region="subject-choice" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBlockEnd: 28 }}>
      {[['event', 'An event', 'فعالية'], ['venue', 'A hosting venue', 'موقع مستضيف للفعاليات'], ['facility', 'A facility', 'منشأة']].map(([key, en, ar]) =>
        <Link key={key} href={`/applicability?subject=${key}`} aria-current={subject === key ? 'page' : undefined} style={{ ...box, background: subject === key ? 'var(--brand-soft)' : 'var(--bg)' }}><L en={en!} ar={ar!} /></Link>)}
    </div>
    {subject === 'event' ? <>
      <section data-region="not-routinely-subject" style={{ ...box, background: 'var(--surface2)', marginBlockEnd: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}><L en="Events that do not need certification" ar="فعاليات لا تحتاج إلى اعتماد" /></h2>
        {P.notRoutinelyEn.map((en, i) => <p key={en} style={{ margin: '8px 0', lineHeight: 1.6 }}><L en={en} ar={P.notRoutinelyAr[i]!} /></p>)}
      </section>
      <form method="get" data-region="event-branch">
        <input type="hidden" name="subject" value="event" /><input type="hidden" name="checked" value="1" />
        <h2 style={{ fontSize: 22 }}><L en="Does any of this apply to your event?" ar="هل ينطبق أي مما يلي على فعاليتكم؟" /></h2>
        <p><L en="Select all that apply." ar="اختاروا كل ما ينطبق." /></p>
        {P.criteria.map((c, i) => <label key={i} style={{ ...box, display: 'flex', gap: 12, marginBlockEnd: 8, lineHeight: 1.6, cursor: 'pointer' }}>
          <input type="checkbox" name="c" value={i} defaultChecked={selected.includes(i)} style={{ width: 18, height: 18, flex: 'none', marginBlockStart: 4 }} /><span><L en={c.en} ar={c.ar} /></span>
        </label>)}
        <button type="submit" style={button}><L en="Continue" ar="متابعة" /></button>
      </form>
    </> : null}
    {subject === 'venue' ? <form method="get" data-region="venue-branch">
      <input type="hidden" name="subject" value="venue" />
      <p style={{ fontSize: 18, lineHeight: 1.65, maxWidth: '65ch' }}><L en={`A hosting venue regularly holds organized events and is licensed for at least ${RECURRING_VENUE_MIN_CAPACITY.toLocaleString('en-US')} people. Does this describe your venue?`} ar={`الموقع المستضيف ينظّم فعاليات بانتظام وتبلغ سعته المرخّصة ${RECURRING_VENUE_MIN_CAPACITY.toLocaleString('en-US')} شخص على الأقل. هل ينطبق ذلك على موقعكم؟`} /></p>
      <div style={{ display: 'flex', gap: 12 }}><button name="eligible" value="yes" style={button}><L en="Yes" ar="نعم" /></button><button name="eligible" value="no" style={{ ...button, background: 'var(--surface2)', color: 'var(--ink)' }}><L en="No" ar="لا" /></button></div>
    </form> : null}
    {subject === 'facility' ? <section data-region="facility-branch">
      <h2 style={{ fontSize: 22 }}><L en="Select the type of facility" ar="اختاروا نوع المنشأة" /></h2>
      <div style={{ display: 'grid', gap: 8 }}>{P.facilityCategories.map((c, i) => <Link key={i} href={`/applicability?subject=facility&cat=${i}`} style={{ ...box, background: q.cat === String(i) ? 'var(--brand-soft)' : 'var(--bg)' }}><L en={c.en} ar={c.ar} /></Link>)}</div>
    </section> : null}
    {answer ? <section data-region="applicability-answer" aria-live="polite" style={{ ...box, borderColor: 'var(--brand)', marginBlockStart: 24 }}>
      <h2 style={{ margin: 0, fontSize: 22 }}><L en={answer.en} ar={answer.ar} /></h2>
      {answer.route ? <Link href={answer.route} style={button}><L en="Next" ar="التالي" /></Link> : null}
    </section> : null}
  </PublicShell>;
}
