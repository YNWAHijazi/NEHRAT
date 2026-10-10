import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { L } from '../../../../components/L';
import { FacilityWorkspace } from '../../../../components/FacilityWorkspace';
import { SiteChangeForm } from './SiteChangeForm';
import { currentAccount } from '../../../../lib/auth';
import { facilityDetail } from '../../../../lib/queries';
import { facilityRegistrationFacts } from '../../../../lib/facility-registration';
import { siteChangeRequests } from '../../../../lib/site-registration';
import { facilityRecordMode } from '../../../../lib/rules/facility-workflow';
import { SITE_CHANGE_ASPECTS, siteChangeHref, siteChangeMode, siteChangeRequestLabel } from '../../../../lib/rules/site-changes';

/**
 * CHANGING THE SITE RECORD (owner, 10 October 2026). One address, three answers by where the
 * registration stands (lib/rules/site-changes.ts):
 *  - with the Ministry: the record is read-only, so the operator asks for the change -- what
 *    and why -- and the Ministry reopens the registration for it or answers;
 *  - in preparation, returned for information, or accepted: the change is made directly, and
 *    this page says where each one is made;
 *  - archived: nothing changes.
 * Every request and its answer stays listed under the form.
 */
export default async function SiteChangePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const q = await searchParams;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const facts = facilityRegistrationFacts(id);
  const mode = siteChangeMode(facts);
  const managing = facilityRecordMode(facts) === 'manage';
  const requests = siteChangeRequests(id);
  const aspectByKey = Object.fromEntries(SITE_CHANGE_ASPECTS.map((a) => [a.key, a]));
  const band: React.CSSProperties = { padding: '16px 20px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.6 };

  return (
    <FacilityWorkspace account={account} facility={facility} active="record">
      <section data-region="site-change" data-mode={mode} style={{ maxWidth: 860 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>
          {mode === 'request'
            ? <L en="Ask to change the registration" ar="طلب تغيير التسجيل" />
            : <L en="Change the site record" ar="تغيير سجل الموقع" />}
        </h2>
        {q.notice === 'requested' ? (
          <div role="status" data-region="change-requested" style={band}>
            <L en="Your request has been sent to the Ministry. You are notified on this platform when it reopens the registration for the change or answers you." ar="أُرسل طلبكم إلى الوزارة. يصلكم إشعار على هذه المنصة عندما تعيد فتح التسجيل لإجراء التغيير أو تجيبكم." />
          </div>
        ) : null}

        {mode === 'request' ? (
          <>
            <p style={{ margin: '0 0 22px', fontSize: '15px', lineHeight: 1.65, maxWidth: '72ch' }}>
              <L
                en="The registration is with the Ministry and is read-only while it is reviewed. Say what needs to change and why. The Ministry reopens the registration so you can make the change and submit it again, or answers you."
                ar="التسجيل لدى الوزارة وهو للقراءة فقط أثناء مراجعته. اذكروا ما يلزم تغييره وسببه. تعيد الوزارة فتح التسجيل لتجروا التغيير وتقدّموه مجدداً، أو تجيبكم."
              />
            </p>
            {q.error === 'aspect' || q.error === 'description' ? (
              <p role="alert" style={{ color: 'var(--bad)' }}><L en="Not sent: choose what needs to change and describe it." ar="لم يُرسل: اختاروا ما يلزم تغييره وصفوه." /></p>
            ) : null}
            <SiteChangeForm facilityId={id} />
            <p style={{ margin: '0 0 28px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="A cardiac-arrest incident is reported at any time, without a request." ar="يُبلَّغ عن حادثة توقف القلب في أي وقت، من دون طلب." />{' '}
              <Link href={`/facilities/${id}/incidents/new`}><L en="Report a cardiac-arrest incident" ar="الإبلاغ عن حادثة توقف قلب" /></Link>
            </p>
          </>
        ) : mode === 'direct' ? (
          <>
            <p style={{ margin: '0 0 18px', fontSize: '15px', lineHeight: 1.65, maxWidth: '72ch' }}>
              {managing
                ? <L en="The site is maintained, not registered again: make the change on the record. Each change is kept in the site’s history, which the Ministry sees." ar="يُحافَظ على الموقع ولا يُعاد تسجيله: أجروا التغيير على السجل. يُحفظ كل تغيير في سجل الموقع الذي تطّلع عليه الوزارة." />
                : <L en="The registration is open: make the change on the record, then submit the registration." ar="التسجيل مفتوح: أجروا التغيير على السجل ثم قدّموا التسجيل." />}
            </p>
            <ul data-region="direct-changes" style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 8 }}>
              {SITE_CHANGE_ASPECTS.filter((a) => a.key !== 'other').map((a) => (
                <li key={a.key}>
                  <Link href={siteChangeHref(a.key, id, managing)} data-change={a.key} style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--ink)', background: 'var(--bg)' }}>
                    <L en={a.en} ar={a.ar} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p><L en="Archived record · Read-only" ar="سجل مؤرشف · للقراءة فقط" /></p>
        )}

        {requests.length > 0 ? (
          <div data-region="change-requests">
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}><L en="Change requests on this registration" ar="طلبات التغيير على هذا التسجيل" /></h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {requests.map((r) => {
                const label = siteChangeRequestLabel(r.status);
                return (
                  <li key={r.id} data-change-request={r.id} data-status={r.status} style={{ background: 'var(--bg)', padding: '14px 18px', fontSize: '14.5px', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>
                        {r.aspects.map((k, i) => <span key={k}>{i > 0 ? ' · ' : ''}<L en={aspectByKey[k]!.en} ar={aspectByKey[k]!.ar} /></span>)}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en={`${label.en} · ${r.requestedAt}`} ar={`${label.ar} · ⁦${r.requestedAt}⁩`} /></span>
                    </div>
                    <div>{r.description}</div>
                    {r.answer ? <div data-region="change-answer" style={{ marginBlockStart: 6, color: 'var(--muted)' }}><L en={`The Ministry: ${r.answer}`} ar={`الوزارة: ${r.answer}`} /></div> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>
    </FacilityWorkspace>
  );
}
