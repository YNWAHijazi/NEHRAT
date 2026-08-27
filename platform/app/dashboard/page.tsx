import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { StartServiceMenu } from '../../components/StartServiceMenu';
import { SequenceFooter, type SequenceStep } from '../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../lib/auth';
import { RoleDashboard, emsRows, directorRows } from './RoleDashboards';
import { invitationsForAccount, postEventReportFor, governanceFor } from '../../lib/queries';
import { DASHBOARD_URGENCY } from '../../lib/presentation';
import { REASSESSMENT_WINDOW, landingRouteFor, usesOrganizerSurface } from '../../lib/rules';
import {
  beirutToday,
  daysBetween,
  eventsFor,
  facilitiesFor,
  unreadCountFor,
  venuesFor,
  type EventRow,
} from '../../lib/queries';

/** The reference's stage-rail bar colouring, verbatim. */
function barOf(k: string): string {
  return k === 'done' || k === 'issued'
    ? 'var(--brand)'
    : k === 'current' || k === 'returned'
      ? 'var(--accent)'
      : 'var(--line)';
}

function urgencyColor(days: number): string {
  return days <= DASHBOARD_URGENCY.criticalDays
    ? 'var(--bad)'
    : days <= DASHBOARD_URGENCY.warningDays
      ? 'var(--accent-ink)'
      : 'var(--brand)';
}

const secLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBlockEnd: 4,
};

function EventCard({ event, today }: { event: EventRow; today: string }) {
  const days = event.due ? daysBetween(today, event.due) : null;
  const color = days === null ? 'var(--line)' : urgencyColor(days);
  const pct =
    days === null ? 4 : Math.max(4, Math.min(100, Math.round((1 - days / event.span) * 100)));
  const level = event.level;
  const stageIcon =
    event.stages[5] === 'current'
      ? ['M12 5l8.5 14.5h-17z', 'M12 10.5v4M12 17h.01']
      : event.stages[3] === 'returned'
        ? ['M19.5 12a7.5 7.5 0 11-2.9-5.9', 'M20 4.5v3.5h-3.5']
        : event.stages[4] === 'done'
          ? ['M5 12.5l4.5 4.5L19.5 7', '']
          : ['M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15z', 'M12 8.5v4l2.5 1.5'];

  return (
    <Link
      data-stack=""
      href={`/events/${event.id}`}
      style={{
        textAlign: 'start',
        paddingBlock: '25px', paddingInlineStart: '26px', paddingInlineEnd: '27px',
        background: 'var(--surface2)',
        borderInlineStart: `3px solid ${color}`,
        borderRadius: 16,
        display: 'grid',
        gridTemplateColumns: 'minmax(200px,2fr) 1fr 1fr auto',
        gap: 20,
        alignItems: 'center',
        color: 'var(--ink)',
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 5 }}>
          <L en={event.nameEn} ar={event.nameAr} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{event.id}</span>
          {event.mophReference ? <span>· {event.mophReference}</span> : null}
        </div>
        {event.stages.length > 0 ? (
          <>
            <div style={{ display: 'flex', gap: 3, marginBlockStart: 11 }}>
              {event.stages.map((k, i) => (
                <span key={i} style={{ display: 'block', width: 24, height: 4, borderRadius: 3, background: barOf(k) }} />
              ))}
            </div>
            {event.stage !== null ? (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.4 }}>
                <L en={`Stage ${event.stage} of 6 — ${event.stageEn}`} ar={`المرحلة ${event.stage} من 6 — ${event.stageAr}`} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div>
        <div style={secLabel}>
          <L en="Level" ar="المستوى" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          {level !== null ? (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                borderInlineStart: `2px solid var(--l${level})`,
                background: `var(--l${level}s)`,
                color: 'var(--ink)',
              }}
            >
              <L en={`Level ${level}`} ar={`المستوى ${level}`} />
            </span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>
              <L en="Not yet derived" ar="لم يُستنتج بعد" />
            </span>
          )}
        </div>
      </div>
      <div>
        <div style={secLabel}>
          <L en="State" ar="الحالة" />
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'start', fontSize: '14.5px' }}>
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d={stageIcon[0]} />
            {stageIcon[1] ? <path d={stageIcon[1]} /> : null}
          </svg>
          <span>
            <L en={event.stateEn} ar={event.stateAr} />
          </span>
        </div>
      </div>
      <div data-due="" style={{ textAlign: 'end', minWidth: 170 }}>
        <div style={secLabel}>
          <L en={event.dueLabelEn} ar={event.dueLabelAr} />
        </div>
        {days !== null ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'end' }}>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.03em', color, fontVariantNumeric: 'tabular-nums' }}>{days}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              <L en="days" ar="يوماً" />
            </span>
          </div>
        ) : null}
        {event.due ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockStart: 2 }}>{event.due}</div>
        ) : null}
        <div style={{ marginBlockStart: 8, height: 2, background: 'var(--line)', position: 'relative' }}>
          <span style={{ position: 'absolute', insetInlineStart: 0, top: 0, height: 2, width: `${pct}%`, background: color }} />
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  // This surface belongs to the organizer, the EMS provider and the Director. Every
  // other role is REFUSED here, the same way every unpermitted surface refuses: a 404,
  // indistinguishable from non-existence, so a role cannot map what sits above its
  // permission. A Ministry reviewer does not organize events, and the Start a service
  // menu below therefore cannot render for one -- it is unreachable rather than hidden.
  //
  // The first-response unit is sent on to its own surface rather than refused -- it has
  // a landing route here, it just is not this one. That redirect comes FIRST, so the
  // refusal below never swallows a role that has somewhere to go.
  if (account.role === 'response') redirect(landingRouteFor(account.role));
  if (!usesOrganizerSurface(account.role)) notFound();
  if (account.role === 'ems' || account.role === 'director') {
    const invitations = invitationsForAccount(account.id);
    const unreadRole = unreadCountFor(account.id);
    const todayRole = beirutToday();
    let rows;
    if (account.role === 'ems') {
      rows = emsRows(invitations);
    } else {
      const reportState = new Map(
        invitations.map((i) => {
          const r = postEventReportFor(i.organizerAccountId, i.eventId);
          return [i.eventId, { organizerSigned: Boolean(r?.organizerSignedAt), directorSigned: Boolean(r?.directorSignedAt) }] as const;
        }),
      );
      const governanceState = new Map(
        invitations.map((i) => {
          const g = governanceFor(i.eventId);
          return [i.eventId, Object.values(g).filter((v) => v.trim() !== '').length] as const;
        }),
      );
      rows = directorRows(invitations, reportState, governanceState, todayRole);
    }
    const owed = rows.filter((r) => !r.done).length;
    return (
      <>
        <GovernmentBand />
        <Header account={account} organization={null} unreadCount={unreadRole} showBack={false} />
        <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
          <RoleDashboard
            rows={rows}
            countEn={`${rows.length} events · ${owed} need a response from you`}
            countAr={`${rows.length} فعالية · ${owed} تحتاج ردّاً منكم`}
          />
          <SequenceFooter
            labelEn="Next in the sequence"
            labelAr="التالي في التسلسل"
            steps={[
              {
                href: '/profile',
                en: account.role === 'ems' ? 'Agency profile' : 'Physician profile',
                ar: account.role === 'ems' ? 'ملف الجهة' : 'الملف الطبي',
                descEn: 'Completed once and reused across every event.',
                descAr: 'يُستكمل مرة واحدة ويُعاد استخدامه في كل فعالية.',
              },
            ]}
          />
        </main>
      </>
    );
  }
  const organization = organizationFor(account.id);
  const events = eventsFor(account.id);
  const venues = venuesFor(account.id);
  const facilities = facilitiesFor(account.id);
  const unread = unreadCountFor(account.id);
  const today = beirutToday();

  const returned = events.find(
    (e) => e.outcome === 'revision' || e.stateEn === 'Information required',
  );
  const empty = events.length === 0 && venues.length === 0 && facilities.length === 0;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 28 }}>
          <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            {organization ? (
              <L en={organization.nameEn} ar={organization.nameAr} />
            ) : (
              <span>{account.displayName}</span>
            )}
          </h1>
          <StartServiceMenu />
        </div>

        {organization && organization.status === 'pending' ? (
          <Link href="/organization" style={{ display: 'block', padding: '24px 28px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 16, marginBlockEnd: 16, color: 'var(--ink)', textDecoration: 'none' }}>
            <div style={{ maxWidth: '70ch' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBlockEnd: 5 }}>
                <L en="Organization registration is with the Ministry" ar="تسجيل المؤسسة لدى الوزارة" />
              </div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
                <L
                  en="Assessments and drafts continue meanwhile; submission opens once the organization is recorded."
                  ar="تستمر التقييمات والمسودات في هذه الأثناء؛ ويُفتح التقديم بعد تسجيل المؤسسة."
                />
              </div>
            </div>
          </Link>
        ) : null}

        {returned ? (
          <div style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--bad)', borderRadius: 12, marginBlockEnd: 44 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Awaiting your response" ar="بانتظار ردكم" />
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.6 }}>
              <L
                en={`${returned.nameEn} — the Ministry requires the medical deployment map and one EMS Readiness Declaration. Respond by ${returned.due ?? ''}.`}
                ar={`${returned.nameAr} — تطلب الوزارة خريطة الانتشار الطبي وإقرار جاهزية واحد. الرد بحلول \u2066${returned.due ?? ''}\u2069.`}
              />
            </div>
          </div>
        ) : null}

        {empty ? (
          <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}>
                <L en="Events" ar="الفعاليات" />
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', flex: 1 }}>
                <L
                  en="Each event you hold is recorded here with its assessment, its level and its submission. Create the event first; the assessment determines the level and the level sets the deadline."
                  ar="تُسجَّل هنا كل فعالية تقيمونها مع تقييمها ومستواها وتقديمها. أنشئوا الفعالية أولاً؛ فالتقييم يحدد المستوى، والمستوى يحدد المهلة."
                />
              </p>
              <Link href="/events/new" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'start', marginBlockStart: 'auto', height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500 }}>
                <L en="Create an event" ar="إنشاء فعالية" />
              </Link>
            </div>
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}>
                <L en="Venues" ar="المواقع" />
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', flex: 1 }}>
                <L
                  en="A venue that regularly hosts organized events and is licensed for 1,000 persons or more is classified annually. Its classification carries a minimum level into every event held there."
                  ar="يُصنَّف سنوياً الموقع الذي يستضيف بانتظام فعاليات منظّمة ويكون مرخصاً لـ 1,000 شخص أو أكثر. ويحمل تصنيفه حداً أدنى للمستوى إلى كل فعالية تُقام فيه."
                />
              </p>
              <Link href="/venues/new" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'start', marginBlockStart: 'auto', height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', color: 'var(--ink)' }}>
                <L en="Register a venue" ar="تسجيل موقع" />
              </Link>
            </div>
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}>
                <L en="Facilities" ar="المنشآت" />
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', flex: 1 }}>
                <L
                  en="A covered facility registers once with its coordinator and each defibrillator, and keeps its response plan current — under cardiac-arrest readiness, separate from events."
                  ar="تُسجَّل المنشأة المشمولة مرة واحدة مع منسّقها وكل جهاز إزالة رجفان، وتُبقي خطة الاستجابة محدّثة — ضمن الجاهزية لتوقف القلب، بمعزل عن الفعاليات."
                />
              </p>
              <Link href="/facilities/new" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'start', marginBlockStart: 'auto', height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', color: 'var(--ink)' }}>
                <L en="Register a facility" ar="تسجيل منشأة" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                <L en="Events" ar="الفعاليات" />
              </h2>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                <L en="One-off. Each counts down to a filing date." ar="مرة واحدة. كل منها يعدّ تنازلياً حتى تاريخ التقديم." />
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 52 }}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} today={today} />
              ))}
            </div>

            {facilities.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                    <L en="Facilities" ar="المرافق" />
                  </h2>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    <L en="Cardiac-arrest instrument. Obligations continue year to year, tied to no event." ar="إطار الجاهزية لتوقف القلب. موجبات مستمرة سنة بعد سنة وغير مرتبطة بأي فعالية." />
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 44 }}>
                  {facilities.map((f) => {
                    const lapseDays = f.nextLapse ? daysBetween(today, f.nextLapse) : null;
                    const window = REASSESSMENT_WINDOW.facilityReadinessOpensDaysBeforeLapse;
                    const color =
                      lapseDays !== null && lapseDays < 0
                        ? 'var(--bad)'
                        : lapseDays !== null && lapseDays <= window
                          ? 'var(--accent-ink)'
                          : 'var(--brand)';
                    return (
                      <Link
                        key={f.id}
                        href={`/facilities/${f.id}`}
                        data-stack=""
                        style={{ textAlign: 'start', paddingBlock: '25px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: `3px solid ${color}`, borderRadius: 16, display: 'grid', gridTemplateColumns: 'minmax(200px,1.7fr) 1fr 1fr auto', gap: 20, alignItems: 'center', color: 'var(--ink)' }}
                      >
                        <div>
                          <div style={{ fontSize: '17.5px', fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 5 }}>
                            <L en={f.nameEn} ar={f.nameAr} />
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                            <L en={f.categoryEn} ar={f.categoryAr} /> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{f.id}</span>
                          </div>
                        </div>
                        <div>
                          <div style={secLabel}>
                            <L en="Devices" ar="الأجهزة" />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{f.devices}</div>
                        </div>
                        <div>
                          <div style={secLabel}>
                            <L en="Standing" ar="الحالة القائمة" />
                          </div>
                          <div style={{ fontSize: '14.5px', lineHeight: 1.45, color }}>
                            <L en={f.stateEn} ar={f.stateAr} />
                          </div>
                        </div>
                        <div data-due="" style={{ textAlign: 'end', minWidth: 170 }}>
                          <div style={secLabel}>
                            <L en="Next lapse" ar="أقرب انتهاء" />
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>{f.nextLapse ?? '—'}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}

            {venues.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                    <L en="Venues" ar="المواقع" />
                  </h2>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    <L en="Recurring. Each holds a dated classification that either stands or lapses." ar="دورية. كل موقع يحمل تصنيفاً مؤرخاً إما أن يبقى قائماً أو ينتهي." />
                  </span>
                </div>
                <div data-stack="" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.1fr 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                  {(
                    [
                      ['Venue', 'الموقع'],
                      ['Classification', 'التصنيف'],
                      ['Valid through', 'صالح حتى'],
                      ['State', 'الحالة'],
                    ] as const
                  ).map(([enH, arH]) => (
                    <div key={enH} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      <L en={enH} ar={arH} />
                    </div>
                  ))}
                  {venues.map((v) => {
                    const dleft = v.validUntil ? daysBetween(today, v.validUntil) : null;
                    const state =
                      dleft !== null && dleft < 0
                        ? { en: 'Reassessment required', ar: 'يلزم إعادة التقييم', color: 'var(--bad)', chipBg: 'var(--bad-soft)' }
                        : dleft !== null && dleft <= REASSESSMENT_WINDOW.opensDaysBeforeExpiry
                          ? { en: 'Lapsing', ar: 'يقترب من الانتهاء', color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' }
                          : { en: 'Classified', ar: 'مصنَّف', color: 'var(--brand)', chipBg: 'var(--brand-soft)' };
                    return (
                      <div key={v.id} style={{ display: 'contents' }}>
                        <Link href={`/venues/${v.id}`} style={{ textAlign: 'start', background: 'var(--bg)', padding: '16px 18px', fontSize: 15, border: 0, borderInlineStart: `3px solid ${state.color}`, color: 'var(--ink)' }}>
                          <span style={{ display: 'block' }}>
                            <L en={v.nameEn} ar={v.nameAr} />
                          </span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockStart: 3 }}>{v.id}</span>
                        </Link>
                        <div style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px', color: 'var(--muted)' }}>
                          <L en={`Level ${v.level} · issued ${v.issued}`} ar={`المستوى ${v.level} · صدر \u2066${v.issued}\u2069`} />
                        </div>
                        <div style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: state.color }}>{v.validUntil}</div>
                        <div style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: '13.5px' }}>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: state.chipBg, color: state.color }}>
                            <L en={state.en} ar={state.ar} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}

        <SequenceFooter
          labelEn="Open a record, or start something new"
          labelAr="افتحوا سجلاً أو ابدأوا شيئاً جديداً"
          steps={dashboardSteps(events)}
        />
      </main>
    </>
  );
}

/** The reference's dashboard footer, driven by the account's actual rows. */
function dashboardSteps(events: EventRow[]): SequenceStep[] {
  const steps: SequenceStep[] = [];
  const first = events.find((e) => !e.filed) ?? events[0];
  if (first) {
    steps.push({
      href: `/events/${first.id}`,
      en: `Event record — ${first.nameEn}`,
      ar: `سجل الفعالية — ${first.nameAr}`,
      descEn: `Level ${first.level ?? '—'}, not yet held. Level, filing date and submission history.`,
      descAr: `المستوى ${first.level ?? '—'}، لم تُقَم بعد. المستوى وتاريخ التقديم وسجل التقديم.`,
    });
  }
  const postOwed = events.find((e) => e.stateEn === 'Post-event report owed');
  if (postOwed) {
    steps.push({
      href: `/events/${postOwed.id}/post-event`,
      en: `Post-event report — ${postOwed.nameEn}`,
      ar: `التقرير اللاحق — ${postOwed.nameAr}`,
      descEn: 'A held Level 3 event. Due within seven calendar days; this one is overdue.',
      descAr: 'فعالية مستوى 3 أُقيمت. مستحق خلال سبعة أيام تقويمية، وهذا متأخر.',
    });
  }
  steps.push(
    {
      href: '/events/new',
      en: 'Applicability and assessment',
      ar: 'الانطباق والتقييم',
      descEn: 'Nine domains. Produces the final level, which sets everything else.',
      descAr: 'تسعة مجالات. تُنتج المستوى النهائي الذي يحدد كل ما عداه.',
    },
    {
      href: '/venues/new',
      en: 'Register a venue',
      ar: 'تسجيل موقع',
      descEn: 'Recurring venues licensed for 1,000 or more.',
      descAr: 'المواقع الدورية المرخّصة لألف شخص أو أكثر.',
    },
    {
      href: '/facilities/new',
      en: 'Register a facility',
      ar: 'تسجيل منشأة',
      descEn: 'The facility, its coordinator and each defibrillator, under cardiac-arrest readiness.',
      descAr: 'المنشأة ومنسّقها وكل جهاز، ضمن الجاهزية لتوقف القلب.',
    },
    {
      href: '/notifications',
      en: 'Notifications',
      ar: 'الإشعارات',
      descEn: 'Everything sent to you. Each opens the record it concerns.',
      descAr: 'كل ما أُرسل إليكم. ويفتح كل منها السجل الذي يخصّه.',
    },
  );
  return steps;
}
