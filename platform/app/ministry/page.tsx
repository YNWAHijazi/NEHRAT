import { ServiceSearch } from '../../components/ServiceSearch';
import Link from 'next/link';
import { L } from '../../components/L';
import { MinistryShell } from '../../components/MinistryShell';
import { requireMinistryPage } from '../../lib/ministry-auth';
import { beirutToday } from '../../lib/clock';
import {
  changesForReview,
  enquiriesForReview,
  reviewQueue,
} from '../../lib/queries';
import { MINISTRY_CONTENT, addDaysIso, can } from '../../lib/rules';

/**
 * The operational dashboard. Every count derives from the records -- never a
 * stored number -- and every counter opens the surface it counts. The facility
 * band is a separate lane: readiness and reporting states, no event outcome,
 * and its status wording is provisional pending Ministry approval.
 */
export default async function MinistryDashboardPage() {
  const account = await requireMinistryPage('viewMinistry');
  const today = beirutToday();
  const queue = reviewQueue(account.isDemo);
  const changes = changesForReview(account.isDemo);
  const enquiries = enquiriesForReview(account.isDemo);

  const open = queue.filter((q) => q.outcome !== 'satisfied');
  const upcomingL3 = queue.filter((q) => q.level === 3 && (q.eventDate ?? '') >= today);
  const within30 = upcomingL3.filter((q) => (q.eventDate ?? '') <= addDaysIso(today, 30));
  const openEnquiries = enquiries.filter((e) => e.repliedAt === null);

  const counters: { n: number; en: string; ar: string; color: string; href: string }[] = [
    { n: open.length, en: 'In the review queue', ar: 'في قائمة المراجعة', color: 'var(--ink)', href: '/ministry/queue' },
    { n: within30.length, en: 'Level 3 events within 30 days', ar: 'فعاليات المستوى 3 خلال 30 يوماً', color: 'var(--accent-ink)', href: '/ministry/queue' },
    { n: changes.length, en: 'Changes and notifications', ar: 'التغييرات والإشعارات', color: 'var(--accent-ink)', href: '/ministry/changes' },
    { n: openEnquiries.length, en: 'Enquiries awaiting a response', ar: 'استفسارات بانتظار الرد', color: 'var(--accent-ink)', href: '/ministry/enquiries' },
  ];

  const levels = [1, 2, 3].map((level) => ({
    level,
    queue: queue.filter((q) => q.level === level && q.outcome === null).length,
    info: queue.filter((q) => q.level === level && (q.outcome === 'revision' || q.outcome === 'incomplete')).length,
    done: queue.filter((q) => q.level === level && q.outcome === 'satisfied').length,
  }));

  return (
    <MinistryShell account={account}>
      <h1 data-sec-h1="" style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Events" ar="الفعاليات" />
      </h1>

      <ServiceSearch action="/ministry/queue" />
      {/* THE OVERSEEING CONSOLE, for the profile that holds it. It had no entry
          point from here at all: its four screens were reachable only by typing the
          URL or by following a footer link on an unrelated page. */}
      {can(account.role, 'viewRegistry') ? (
        <Link
          href="/ministry/admin/records"
          data-region="master-admin-entry"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 40, paddingInline: 18, border: '1px solid var(--line)', borderRadius: 20, fontSize: 14, color: 'var(--ink)', marginBlockEnd: 24 }}
        >
          <L en={MINISTRY_CONTENT.adminConsole.titleEn} ar={MINISTRY_CONTENT.adminConsole.titleAr} />
        </Link>
      ) : null}

      <div data-region="counters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 16 }}>
        {counters.map((c) => (
          <Link key={c.en} href={c.href} style={{ background: 'var(--bg)', padding: '18px 20px', color: 'var(--ink)' }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', color: c.color }}>{c.n}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.4 }}>
              <L en={c.en} ar={c.ar} />
            </div>
          </Link>
        ))}
      </div>

      {/* The dashboard is the console's index: the surfaces without a counter are
          still reachable from it, as plain links. The per-screen sequence footers
          were cut on the partner's second-sweep ruling. */}
      <Link href="/ministry/reports" style={{ display: 'inline-block', marginBlockEnd: 20 }}><L en="Review post-event reports" ar="مراجعة تقارير ما بعد الفعاليات" /></Link>
      <div data-region="console-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 32 }}>
        {[
          { href: '/ministry/applicability', en: 'Applicability and referrals', ar: 'الانطباق والإحالات' },
          { href: '/ministry/incidents', en: 'Incidents and reports', ar: 'الحوادث والتقارير' },
          { href: '/ministry/determinations', en: 'Determinations and designations', ar: 'البت والتحديد' },
          { href: '/ministry/order', en: 'Order of Physicians lane', ar: 'مسار نقابة الأطباء' },
        ].map((s) => (
          <Link key={s.href} href={s.href} style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
            <L en={s.en} ar={s.ar} />
          </Link>
        ))}
      </div>

      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Submissions by level and status" ar="التقديمات بحسب المستوى والحالة" />
          </h2>
          <div data-region="by-level" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {[
              { en: 'Level', ar: 'المستوى' },
              { en: 'In queue', ar: 'في القائمة' },
              { en: 'Information required', ar: 'معلومات مطلوبة' },
              { en: 'Requirements satisfied', ar: 'المتطلبات مستوفاة' },
            ].map((h) => (
              <div key={h.en} data-th="" style={{ background: 'var(--surface2)', padding: '10px 14px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en={h.en} ar={h.ar} />
              </div>
            ))}
            {levels.map((b) => [
              <div key={`${b.level}-l`} style={{ background: 'var(--bg)', padding: '13px 14px', fontSize: 14, borderInlineStart: `3px solid var(--l${b.level})` }}>
                <L en={`Level ${b.level}`} ar={`المستوى ${b.level}`} />
              </div>,
              <div key={`${b.level}-q`} style={{ background: 'var(--bg)', padding: '13px 14px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{b.queue}</div>,
              <div key={`${b.level}-i`} style={{ background: 'var(--bg)', padding: '13px 14px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{b.info}</div>,
              <div key={`${b.level}-d`} style={{ background: 'var(--bg)', padding: '13px 14px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{b.done}</div>,
            ])}
          </div>

          <h2 style={{ margin: '28px 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Upcoming Level 3 events" ar="فعاليات المستوى 3 القادمة" />
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {upcomingL3.length === 0 ? (
              <div style={{ background: 'var(--bg)', padding: '13px 16px', fontSize: 14, color: 'var(--muted)' }}>
                <L en="No Level 3 events ahead." ar="لا فعاليات من المستوى 3 قادمة." />
              </div>
            ) : null}
            {upcomingL3.map((u) => {
              const state = u.outcome
                ? MINISTRY_CONTENT.outcomes.find((o) => o.key === u.outcome)
                : null;
              const internal = MINISTRY_CONTENT.internalStates[u.state];
              return (
                <Link key={u.eventId} href={`/ministry/submissions/${u.eventId}`} style={{ background: 'var(--bg)', padding: '13px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)' }}>
                  <span>
                    <L en={u.nameEn} ar={u.nameAr} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {u.eventDate} · <L en={state?.en ?? internal.en} ar={state?.ar ?? internal.ar} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Changes and notifications" ar="التغييرات والإشعارات" />
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
            {changes.slice(0, 3).map((c) => (
              <div key={`${c.kind}-${c.eventId}-${c.when}`} style={{ paddingBlock: '15px', paddingInlineStart: '16px', paddingInlineEnd: '17px', background: 'var(--surface2)', borderInlineStart: `3px solid ${c.kind === 'declined' ? 'var(--bad)' : 'var(--accent)'}`, borderRadius: 10 }}>
                <div style={{ fontSize: 14, lineHeight: 1.45 }}>
                  <L en={`${c.detailEn} — ${c.eventEn}`} ar={`${c.detailAr} — ${c.eventAr}`} />
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>{c.when}</div>
              </div>
            ))}
            {changes.length === 0 ? (
              <div style={{ padding: '14px 16px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en="Nothing reported." ar="لا شيء مبلَّغاً." />
              </div>
            ) : null}
          </div>


        </div>
      </div>

    </MinistryShell>
  );
}
