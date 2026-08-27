import Link from 'next/link';
import { L } from '../../components/L';
import { MinistryFooter, MinistryShell } from '../../components/MinistryShell';
import { requireMinistryPage } from '../../lib/ministry-auth';
import { beirutToday } from '../../lib/clock';
import {
  arrestLocations,
  changesForReview,
  correctiveActions,
  enquiriesForReview,
  facilitiesForOversight,
  organizationsForReview,
  reviewQueue,
} from '../../lib/queries';
import { FACILITY_CONTENT, MINISTRY_CONTENT, addDaysIso } from '../../lib/rules';

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
  const orgs = organizationsForReview(account.isDemo);
  const changes = changesForReview(account.isDemo);
  const enquiries = enquiriesForReview(account.isDemo);
  const facilities = facilitiesForOversight(account.isDemo);
  const arrests = arrestLocations(account.isDemo);
  const corrective = correctiveActions(account.isDemo);

  const open = queue.filter((q) => q.outcome !== 'satisfied');
  const upcomingL3 = queue.filter((q) => q.level === 3 && (q.eventDate ?? '') >= today);
  const within30 = upcomingL3.filter((q) => (q.eventDate ?? '') <= addDaysIso(today, 30));
  const pendingOrgs = orgs.filter((o) => o.status === 'pending');
  const openCorrective = corrective.filter((c) => c.status === 'open');
  const repeatArrests = arrests.filter((a) => a.count >= 2);
  const openEnquiries = enquiries.filter((e) => e.repliedAt === null);

  const counters: { n: number; en: string; ar: string; color: string; href: string }[] = [
    { n: open.length, en: 'In the review queue', ar: 'في قائمة المراجعة', color: 'var(--ink)', href: '/ministry/queue' },
    { n: within30.length, en: 'Level 3 events within 30 days', ar: 'فعاليات المستوى 3 خلال 30 يوماً', color: 'var(--accent-ink)', href: '/ministry/queue' },
    { n: changes.length, en: 'Changes and notifications', ar: 'التغييرات والإشعارات', color: 'var(--accent-ink)', href: '/ministry/changes' },
    { n: pendingOrgs.length, en: 'Organizations awaiting recording', ar: 'مؤسسات بانتظار التسجيل', color: 'var(--ink)', href: '/ministry/organizations' },
    { n: openEnquiries.length, en: 'Enquiries awaiting a response', ar: 'استفسارات بانتظار الرد', color: 'var(--accent-ink)', href: '/ministry/enquiries' },
    { n: openCorrective.length, en: 'Outstanding corrective actions', ar: 'إجراءات تصحيحية قائمة', color: 'var(--accent-ink)', href: '/ministry/facilities' },
    { n: repeatArrests.length, en: 'Places with repeat reported arrests', ar: 'أماكن تكررت فيها حوادث مبلَّغة', color: 'var(--bad)', href: '/ministry/facilities/arrests' },
  ];

  const levels = [1, 2, 3].map((level) => ({
    level,
    queue: queue.filter((q) => q.level === level && q.outcome === null).length,
    info: queue.filter((q) => q.level === level && (q.outcome === 'revision' || q.outcome === 'incomplete')).length,
    done: queue.filter((q) => q.level === level && q.outcome === 'satisfied').length,
  }));

  const shortEn = (key: string): string =>
    (FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortEn?: string } | undefined)?.shortEn ?? key;
  const shortAr = (key: string): string =>
    (FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortAr?: string } | undefined)?.shortAr ?? key;

  return (
    <MinistryShell account={account}>
      <h1 data-sec-h1="" style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Operational dashboard" ar="اللوحة التشغيلية" />
      </h1>

      <div data-region="counters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 32 }}>
        {counters.map((c) => (
          <Link key={c.en} href={c.href} style={{ background: 'var(--bg)', padding: '18px 20px', color: 'var(--ink)' }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', color: c.color }}>{c.n}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.4 }}>
              <L en={c.en} ar={c.ar} />
            </div>
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

          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Outstanding corrective actions" ar="الإجراءات التصحيحية القائمة" />
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {openCorrective.slice(0, 4).map((c) => (
              <Link key={c.id} href="/ministry/facilities" style={{ background: 'var(--bg)', padding: '13px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)' }}>
                <span style={{ lineHeight: 1.45 }}>
                  <L en={`${c.facilityEn} — ${c.bodyEn}`} ar={`${c.facilityAr} — ${c.bodyAr}`} />
                </span>
                <span style={{ flex: 'none', fontSize: '12.5px', color: 'var(--muted)' }}>
                  <L en="Open the lane" ar="فتح المسار" />
                </span>
              </Link>
            ))}
            {openCorrective.length === 0 ? (
              <div style={{ background: 'var(--bg)', padding: '13px 16px', fontSize: 14, color: 'var(--muted)' }}>
                <L en="None open." ar="لا شيء مفتوحاً." />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div data-region="facility-band" style={{ marginBlockStart: 36, paddingBlockStart: 28, borderBlockStart: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Cardiac-arrest instrument" ar="إطار الجاهزية لتوقف القلب" />
          </h2>
          <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12 }}>
            <L en="Separate lane" ar="مسار منفصل" />
          </span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '82ch' }}>
          <L
            en="Covered facilities carry no event outcome. The counts below are readiness and reporting states, and the wording is provisional pending Ministry approval."
            ar="لا تحمل المرافق المشمولة نتيجة فعالية. والأعداد أدناه حالات جاهزية وإبلاغ، والصياغة مؤقتة بانتظار موافقة الوزارة."
          />
        </p>

        {/* One coherent band: two EQUAL columns, each a self-contained card with its
            own heading, its rows filling the card, and its link in the card foot --
            matched heights, no orphaned buttons, no ocean of white beside one card. */}
        <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          <div style={{ background: 'var(--surface2)', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, letterSpacing: '-.015em' }}>
              <L en={`Covered facilities — ${facilities.length}`} ar={`المرافق المشمولة — ${facilities.length}`} />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {facilities.map((f) => (
                <div key={f.id} style={{ paddingBlock: '13px', paddingInlineStart: '15px', paddingInlineEnd: '16px', background: 'var(--bg)', borderInlineStart: `3px solid ${f.standingKind === 'met' ? 'var(--brand)' : f.standingKind === 'lapsing' ? 'var(--accent)' : 'var(--bad)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span>
                    <L en={`${f.nameEn} · ${shortEn(f.categoryKey)} · ${f.municipality}`} ar={`${f.nameAr} · ${shortAr(f.categoryKey)} · ${f.municipality}`} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <L en={`${f.devices} devices`} ar={`${f.devices} أجهزة`} />
                  </span>
                </div>
              ))}
              {facilities.length === 0 ? (
                <div style={{ padding: '13px 16px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en="No covered facilities registered." ar="لا مرافق مشمولة مسجَّلة." />
                </div>
              ) : null}
            </div>
            <div style={{ marginBlockStart: 14 }}>
              <Link href="/ministry/facilities" style={{ height: 36, paddingInline: 15, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                <L en="Open facility oversight" ar="فتح الرقابة على المرافق" />
              </Link>
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, letterSpacing: '-.015em' }}>
              <L en={`Places with repeat reported arrests — ${repeatArrests.length}`} ar={`أماكن تكررت فيها حوادث مبلَّغة — ${repeatArrests.length}`} />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {repeatArrests.map((a) => (
                <div key={a.placeEn} style={{ paddingBlock: '13px', paddingInlineStart: '15px', paddingInlineEnd: '16px', background: 'var(--bg)', borderInlineStart: `3px solid ${a.count >= 3 ? 'var(--bad)' : 'var(--accent-ink)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', lineHeight: 1.45 }}>
                    <L en={a.placeEn} ar={a.placeAr} />
                  </span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: a.count >= 3 ? 'var(--bad)' : 'var(--accent-ink)' }}>{a.count}</span>
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: a.designated ? 'var(--brand-soft)' : 'var(--bg)', color: a.designated ? 'var(--brand)' : 'var(--muted)', fontSize: '11.5px' }}>
                      {a.designated ? <L en="Already a covered facility" ar="مرفق مشمول أصلاً" /> : <L en="Not currently covered" ar="غير مشمول حالياً" />}
                    </span>
                  </span>
                </div>
              ))}
              {repeatArrests.length === 0 ? (
                <div style={{ padding: '13px 16px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en="No place shows a repeat pattern." ar="لا مكان يُظهر نمطاً متكرراً." />
                </div>
              ) : null}
            </div>
            <div style={{ marginBlockStart: 14 }}>
              <Link href="/ministry/facilities/arrests" style={{ height: 36, paddingInline: 15, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                <L en="Open reported arrest locations" ar="فتح مواقع الحوادث المبلَّغة" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <MinistryFooter
        steps={[
          { href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'Filed submissions, their workflow state and their determinations.', descAr: 'التقديمات المقدَّمة وحالاتها الداخلية ونتائجها.' },
          { href: '/ministry/organizations', en: 'Organizations', ar: 'المؤسسات', descEn: 'Recording opens filing for the organizer.', descAr: 'التسجيل يفتح التقديم للمنظّم.' },
          { href: '/ministry/enquiries', en: 'Enquiries', ar: 'الاستفسارات', descEn: 'Questions against a determination. The outcome does not change here.', descAr: 'أسئلة على نتيجة. ولا تتغير النتيجة هنا.' },
          { href: '/ministry/applicability', en: 'Applicability and referrals', ar: 'الانطباق والإحالات', descEn: 'Events referred from outside, determined in or out of scope with reasons.', descAr: 'فعاليات محالة من الخارج، تُحسم ضمن النطاق أو خارجه مع الأسباب.' },
        ]}
      />
    </MinistryShell>
  );
}
