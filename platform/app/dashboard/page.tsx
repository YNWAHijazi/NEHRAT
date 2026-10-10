import { OptionText } from '../../components/OptionText';
import { submissionGateFor } from '../../lib/submission-facts';
import { InfoNote } from '../../components/InfoNote';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../components/Header';
import { L } from '../../components/L';
import { StartServiceMenu } from '../../components/StartServiceMenu';
import { reapplyEventAction } from '../actions';
import { currentAccount, organizationFor } from '../../lib/auth';
import { RoleDashboard, emsRows, directorRows } from './RoleDashboards';
import { archivedEventsFor, archivedVenuesFor, archivedFacilitiesFor, invitationsForAccount, postEventReportFor, governanceFor } from '../../lib/queries';
import { DASHBOARD_URGENCY } from '../../lib/presentation';
import { eventSiteAlertFor, eventsAtSitesOf, holdsSites, type EventsAtSite } from '../../lib/event-site';
import { EVENT_SITE_ALERT_SHORT } from '../../lib/rules/site';
import { REASSESSMENT_WINDOW, usesOrganizerSurface } from '../../lib/rules';
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

/**
 * The three service cards on the empty dashboard offer three ways in, and the
 * platform prefers none of them. Events used to carry a filled brand-coloured
 * link while venues and facilities were outlined, which reads as one action
 * chosen for you and two withheld -- a reviewer read it exactly that way. The
 * services are peers: an organizer arrives to discharge whichever obligation
 * they were sent here for. One object, used three times, so they cannot drift
 * apart again the way they did.
 */
const serviceAction: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'start',
  marginBlockStart: 'auto',
  height: 44,
  paddingInline: 22,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 22,
  fontSize: '14.5px',
  fontWeight: 500,
  color: 'var(--ink)',
};

const secLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBlockEnd: 4,
};

function EventCard({ event, today, pending, waiting }: { event: EventRow; today: string; pending: number; waiting: number }) {
  const days = event.due ? daysBetween(today, event.due) : null;
  const isDeadline = event.dueLabelEn !== 'Event date';
  const color = days === null ? 'var(--line)' : days < 0 && !isDeadline ? 'var(--muted)' : urgencyColor(days);
  const pct =
    days === null ? 4 : Math.max(4, Math.min(100, Math.round((1 - days / event.span) * 100)));
  const level = event.level;
  // The site it is held at is expiring soon or expired, or falls due before it ends (owner, 9 October 2026).
  const siteAlert = eventSiteAlertFor(event.id, today);
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
          <span>{event.id}</span><span><L en={`Updated ${(event.updatedAt || event.createdAt).slice(0, 10)}`} ar={`آخر تحديث \u2066${(event.updatedAt || event.createdAt).slice(0, 10)}\u2069`} /></span>{!event.filed && pending > 0 ? <span data-pending={pending}><L en={`${pending} ${pending === 1 ? 'item' : 'items'} remaining${waiting > 0 ? ` · ${waiting} waiting for others` : ''}`} ar={`${pending} متبقٍ${waiting > 0 ? ` · ${waiting} بانتظار الآخرين` : ''}`}/></span> : null}
          {/* A second running reads as one at a glance: the previous edition's
              date beside the new record's identity. The records stay separate --
              one per authorisation, each with its own reference. */}
          {event.copiedFrom && event.previousEditionDate ? (
            <span data-region="previous-edition">
              · <L en={`Previous edition ${event.previousEditionDate}`} ar={`النسخة السابقة ⁦${event.previousEditionDate}⁩`} />
            </span>
          ) : null}
        </div>
        {siteAlert ? (
          <div data-region="site-alert" data-alert={siteAlert.key} style={{ display: 'inline-flex', marginBlockStart: 9, padding: '2px 10px', borderRadius: 999, fontSize: '12.5px', fontWeight: 500, ...(siteAlert.key === 'expired' ? { background: 'var(--bad-soft)', color: 'var(--bad)' } : { background: 'var(--accent-soft)', color: 'var(--accent-ink)' }) }}>
            <L en={EVENT_SITE_ALERT_SHORT[siteAlert.key].en} ar={EVENT_SITE_ALERT_SHORT[siteAlert.key].ar} />
          </div>
        ) : null}
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
          <L en="Status" ar="الحالة" />
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
            {/* A passed deadline reads as days overdue, never as a negative count (owner, 2026-10-07). */}
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.03em', color, fontVariantNumeric: 'tabular-nums' }}>{Math.abs(days)}</span>
            {/* An event date in the past is a fact, not an overdue task (live review, 10 October 2026): it
                reads "days ago". Only a deadline -- File by, Report due -- can be overdue. */}
            <span style={{ fontSize: 13, color: days < 0 && isDeadline ? color : 'var(--muted)' }}>
              <L en={days < 0 ? (isDeadline ? 'days overdue' : 'days ago') : 'days'} ar={days < 0 ? (isDeadline ? 'يوماً من التأخير' : 'يوماً مضت') : 'يوماً'} />
            </span>
          </div>
        ) : null}
        {event.due ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockStart: 2 }}>{event.due}</div>
        ) : null}
        {event.filedOn ? (
          <div style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{event.filedOn}</div>
        ) : (
          <div style={{ marginBlockStart: 8, height: 2, background: 'var(--line)', position: 'relative' }}>
            <span style={{ position: 'absolute', insetInlineStart: 0, top: 0, height: 2, width: `${pct}%`, background: color }} />
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * EVENTS AT YOUR SITES (owner, 9 October 2026: the event links to the Facility/Site): other
 * organizers' events linked to the sites this account's Facility/Site registrations stand on,
 * grouped by site. The site's operator is not a party to these events, so each row is text --
 * name, dates, record id, level, status -- and links to no record the operator cannot open.
 * Absent for an account with no Facility/Site registration; an operator with no linked event
 * reads one line.
 */
function EventsAtYourSites({ groups }: { groups: EventsAtSite[] }) {
  const dates = (start: string | null, end: string | null, lang: 'en' | 'ar') => {
    const span = start && end && end !== start ? `${start} – ${end}` : (start ?? end ?? '—');
    return lang === 'ar' ? `⁦${span}⁩` : span;
  };
  return (
    <section data-region="events-at-your-sites" style={{ marginBlockStart: 44 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Events at your sites" ar="الفعاليات في مواقعكم" />
        <InfoNote labelEn="About events at your sites" labelAr="حول الفعاليات في مواقعكم">
          <L
            en="Events other organizers have linked to your registered sites: the name, dates and record ID, and whether each is planned or scheduled. Once the Ministry completes its review of an event, its receipt is here."
            ar="فعاليات ربطها منظّمون آخرون بمواقعكم المسجّلة: الاسم والتواريخ ومعرّف السجل، وما إذا كانت مُخطَّطاً لها أم مُجدولة. وعندما تُكمل الوزارة مراجعة فعالية، يظهر إيصالها هنا."
          />
        </InfoNote>
      </h2>
      {groups.length === 0 ? (
        <p data-empty="" style={{ marginBlock: '12px 0', padding: '16px 22px', background: 'var(--surface2)', borderRadius: 12, fontSize: '14.5px' }}>
          <L en="No other organizer has linked an event to your sites." ar="لم يربط أي منظّم آخر فعالية بمواقعكم." />
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBlockStart: 12 }}>
          {groups.map((g) => (
            <div key={g.siteId} data-site-id={g.siteId}>
              <h3 style={{ margin: '0 0 8px', fontSize: '11.5px', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <L en={`${g.siteNameEn} · ${g.siteId}`} ar={`${g.siteNameAr} · ⁦${g.siteId}⁩`} />
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.events.map((e) => (
                  <li key={e.id} data-event-id={e.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'baseline', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                      <L en={e.nameEn} ar={e.nameAr} />
                    </span>
                    <span style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                      <L en={`${e.id} · ${dates(e.startDate, e.endDate, 'en')}`} ar={`⁦${e.id}⁩ · ${dates(e.startDate, e.endDate, 'ar')}`} />
                    </span>
                    <span data-status={e.stage} style={{ fontSize: '12.5px', color: e.stage === 'scheduled' ? 'var(--brand)' : 'var(--muted)' }}>
                      <L en={e.statusEn} ar={e.statusAr} />
                    </span>
                    {e.stage === 'scheduled' ? (
                      <a href={`/facilities/${g.facilityId}/events/${e.id}`} data-region="site-event-receipt-link" style={{ fontSize: '12.5px' }}>
                        <L en="View receipt" ar="عرض الإيصال" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; sort?: string; q?: string; service?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const filters = await searchParams;
  const notice = filters?.notice;
  const sort = filters?.sort ?? 'updated';
  const query = filters?.q?.trim().toLowerCase() ?? '';
  // This surface belongs to the organizer, the EMS provider and the Director. Every
  // other role is REFUSED here, the same way every unpermitted surface refuses: a 404,
  // indistinguishable from non-existence, so a role cannot map what sits above its
  // permission. A Ministry reviewer does not organize events, and the Start a service
  // menu below therefore cannot render for one -- it is unreachable rather than hidden.
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
          return [i.eventId, { prepared: Boolean(r), returned: Boolean(r?.directorReturnedAt) && !r?.directorSignedAt, organizerSigned: Boolean(r?.organizerSignedAt), directorSigned: Boolean(r?.directorSignedAt) }] as const;
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
    // Only what the signed-in person can do now is owed; rows waiting on the organizer are listed apart.
    const owed = rows.filter((r) => !r.done && !r.waiting).length;
    return (
      <>
        <GovernmentBand />
        <Header account={account} organization={null} unreadCount={unreadRole} showBack={false} />
        <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
          {notice === 'withdrawn' ? (
            <div data-region="withdrawn-notice" style={{ padding: '18px 24px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.65 }}>
              <L en="You have withdrawn from the event. The organizer has been told." ar="انسحبتم من الفعالية. وأُبلغ المنظّم." />
            </div>
          ) : null}
          {/* A medical partner's hosting-venue list left with the venue medical team (8 October 2026): venues name no EMS agency or Medical Director. */}
          <RoleDashboard
            rows={rows}
            countEn={`${rows.length} events · ${owed} need a response from you`}
            countAr={`${rows.length} فعالية · ${owed} تحتاج ردّاً منكم`}
          />
        </main>
      </>
    );
  }
  const organization = organizationFor(account.id);
  const allEvents = eventsFor(account.id);
  // The same blockers the record page lists and the gate refuses on, split by who can clear them.
  const gateById = new Map(allEvents.map(e => [e.id, e.filed || !e.level ? null : submissionGateFor(account.id, e.id)]));
  const pendingById = new Map(allEvents.map(e => [e.id, gateById.get(e.id)?.blockers.length ?? 0]));
  const othersById = new Map(allEvents.map(e => [e.id, gateById.get(e.id)?.record?.summary.required.others ?? 0]));
  // A cancelled event leaves the live list for its own collapsed section at the foot (owner, 2026-10-07).
  const cancelled = allEvents.filter((e) => e.lifecycle === 'cancelled');
  const events = allEvents.filter(e => e.lifecycle !== 'cancelled' && `${e.id} ${e.nameEn} ${e.nameAr} ${e.mophReference ?? ''}`.toLowerCase().includes(query)).sort((a,b) => {
    if(sort==='pending') return (pendingById.get(b.id)??0)-(pendingById.get(a.id)??0);
    if(sort==='due') return (a.due??'9999').localeCompare(b.due??'9999');
    if(sort==='status') return a.stateEn.localeCompare(b.stateEn);
    if(sort==='date') return (a.startDate??'9999').localeCompare(b.startDate??'9999');
    return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
  });
  const archived = archivedEventsFor(account.id);
  // Hosting venue registration is replaced by Facility/Site registration (owner, 9 October 2026):
  // no venue is an active regulatory entity, so the account's venue records -- kept, never
  // deleted -- are listed in the archive only, each leading to its record and the route onward.
  const replacedVenues = venuesFor(account.id);
  const archivedVenueIds = new Set(replacedVenues.map((v) => v.id));
  const archivedVenues = [...replacedVenues, ...archivedVenuesFor(account.id).filter((v) => !archivedVenueIds.has(v.id))];
  const archivedFacilities = archivedFacilitiesFor(account.id);
  const previousCount = archived.length + archivedVenues.length + archivedFacilities.length;
  // Other organizers' events linked to the sites this account's Facility/Site registrations stand
  // on: name, dates, record id, level and status only, selected so in lib/event-site.
  const eventsAtSites = holdsSites(account.id) ? eventsAtSitesOf(account.id, account.isDemo) : null;
  const facilities = facilitiesFor(account.id);
  const unread = unreadCountFor(account.id);
  const today = beirutToday();

  const empty = allEvents.length === 0 && facilities.length === 0;
  // ONE SERVICE AT A TIME, when the account holds both (live review, 10 October 2026: sixteen
  // event cards stood between a facility operator and their sites). "All" stays the default.
  const view: 'all' | 'events' | 'facilities' = filters?.service === 'events' ? 'events' : filters?.service === 'facilities' ? 'facilities' : 'all';
  const showEvents = view !== 'facilities';
  const showFacilities = view !== 'events';
  const shownFacilities = view === 'facilities' && query ? facilities.filter((f) => `${f.id} ${f.siteId ?? ''} ${f.nameEn} ${f.nameAr}`.toLowerCase().includes(query)) : facilities;
  const liveEventCount = allEvents.length - cancelled.length;

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

        {notice === 'interest' ? (
          <div data-region="interest-notice" style={{ padding: '18px 24px', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
            <L
              en="Your interest was saved. Facility registration is now available from Start a service."
              ar="حُفظ اهتمامكم. يمكنكم الآن تسجيل المنشأة من «بدء خدمة»."
            />
          </div>
        ) : null}
        {notice === 'draft-saved' ? (
          <div role="status" data-region="draft-saved-notice" style={{ padding: '18px 24px', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
            <L en="Saved as a draft. Nothing is sent to the Ministry until you submit." ar="حُفظت كمسودة. لا يُرسل شيء إلى الوزارة قبل أن تقدّموا." />
          </div>
        ) : null}
        {notice === 'draft-deleted' ? (
          <div style={{ padding: '18px 24px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
            <L en="Draft deleted." ar="حُذفت المسودة." />
          </div>
        ) : null}

        {empty ? (
          <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}>
                <L en="Events" ar="الفعاليات" />
              </div>
              <InfoNote>
                <L
                  en="Each event you hold is recorded here with its assessment, its level and its submission."
                  ar="تُسجَّل هنا كل فعالية تقيمونها مع تقييمها ومستواها وتقديمها."
                />
              </InfoNote>
              <Link href="/events/new" style={serviceAction}>
                <L en="Create an event" ar="إنشاء فعالية" />
              </Link>
            </div>
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}>
                <L en="Facilities and sites" ar="المنشآت والمواقع" />
              </div>
              <InfoNote>
                <L
                  en="A covered facility or site registers once with its responsible contact and each AED, and keeps its cardiac emergency response plan current. Events held there can reuse its registered information."
                  ar="تُسجَّل المنشأة أو الموقع المشمول مرة واحدة مع جهة الاتصال المسؤولة وكل جهاز AED، ويُبقي خطة الاستجابة لطوارئ القلب محدّثة. ويمكن للفعاليات التي تُقام فيه إعادة استخدام معلوماته المسجّلة."
                />
              </InfoNote>
              <Link href="/facilities/new" style={serviceAction}>
                <L en="Register a facility/site" ar="تسجيل منشأة/موقع" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {allEvents.length > 0 && facilities.length > 0 ? (
              <nav data-region="service-tabs" aria-label="Services" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 22 }}>
                {([
                  ['all', 'All', 'الكل', null],
                  ['events', 'Events', 'الفعاليات', liveEventCount],
                  ['facilities', 'Facilities and sites', 'المنشآت والمواقع', facilities.length],
                ] as const).map(([key, en, ar, n]) => (
                  <Link key={key} href={key === 'all' ? '/dashboard' : `/dashboard?service=${key}`} data-service-tab={key} aria-current={view === key ? 'page' : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, paddingInline: 16, borderRadius: 20, fontSize: 14, border: `1px solid ${view === key ? 'var(--brand)' : 'var(--line)'}`, background: view === key ? 'var(--brand-soft)' : 'var(--bg)', color: view === key ? 'var(--brand)' : 'var(--ink)', fontWeight: view === key ? 600 : 400 }}>
                    <L en={en} ar={ar} />{n !== null ? <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)', fontWeight: 400 }}>{n}</span> : null}
                  </Link>
                ))}
              </nav>
            ) : null}
            {showEvents ? (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                <L en="Events" ar="الفعاليات" />
              </h2>
            </div>
            {/* Search and sort only once there is something to search; an empty account gets a start, not a failed search. */}
            {allEvents.length > 0 ? <form style={{display:'flex',gap:12,flexWrap:'wrap',marginBlock:'12px 20px'}}>{view !== 'all' ? <input type="hidden" name="service" value={view} /> : null}<label style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><L en="Search events" ar="البحث عن فعاليات"/><input name="q" defaultValue={filters?.q ?? ''} type="search" style={{height:40,paddingInline:12,borderRadius:8,border:'1px solid var(--line)',background:'var(--bg)',color:'var(--ink)',fontSize:14,minWidth:0,maxWidth:'100%'}}/></label><label style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><L en="Sort by" ar="ترتيب حسب"/><select name="sort" defaultValue={sort} style={{height:40,paddingInline:12,borderRadius:8,border:'1px solid var(--line)',background:'var(--bg)',color:'var(--ink)',fontSize:14}}>{[['updated','Last updated','آخر تحديث'],['pending','Pending requirements','المتطلبات المتبقية'],['due','Submit by','موعد التقديم'],['status','Status','الحالة'],['date','Event date','تاريخ الفعالية']].map(([value,en,ar])=><option key={value} value={value}><OptionText en={String(en)} ar={String(ar)} /></option>)}</select></label><button type="submit" style={{height:40,paddingInline:18,border:'1px solid var(--line)',borderRadius:20,background:'var(--bg)',color:'var(--ink)',cursor:'pointer'}}><L en="Apply" ar="تطبيق"/></button></form> : null}
            {allEvents.length===0 ? <p style={{padding:'16px 22px',background:'var(--surface2)',borderRadius:12}}><L en="No events yet." ar="لا فعاليات بعد."/> <Link href="/events/new"><L en="Create an event" ar="إنشاء فعالية"/></Link></p> : events.length===0 ? <p><L en="No matching events." ar="لا توجد فعاليات مطابقة."/></p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 52 }}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} today={today} pending={pendingById.get(event.id) ?? 0} waiting={othersById.get(event.id) ?? 0} />
              ))}
            </div>
            </>) : null}

            {showFacilities && facilities.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
                    <L en="Facilities and sites" ar="المنشآت والمواقع" />
                  </h2>
                </div>
                {view === 'facilities' ? (
                  <form style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBlock: '12px 20px' }}>
                    <input type="hidden" name="service" value="facilities" />
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><L en="Search facilities and sites" ar="البحث عن منشآت ومواقع" /><input name="q" defaultValue={filters?.q ?? ''} type="search" style={{ height: 40, paddingInline: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, minWidth: 0, maxWidth: '100%' }} /></label>
                    <button type="submit" style={{ height: 40, paddingInline: 18, border: '1px solid var(--line)', borderRadius: 20, background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer' }}><L en="Apply" ar="تطبيق" /></button>
                  </form>
                ) : null}
                {shownFacilities.length === 0 ? <p><L en="No matching facilities or sites." ar="لا توجد منشآت أو مواقع مطابقة." /></p> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 44 }}>
                  {shownFacilities.map((f) => {
                    const lapseDays = f.nextLapse ? daysBetween(today, f.nextLapse) : null;
                    const window = REASSESSMENT_WINDOW.facilityReadinessOpensDaysBeforeLapse;
                    const color =
                      lapseDays !== null && lapseDays < 0
                        ? 'var(--bad)'
                        : lapseDays !== null && lapseDays <= window
                          ? 'var(--accent-ink)'
                          : 'var(--brand)';
                    // The site status (latest revision, 9 October 2026): product-defined, never an event outcome.
                    const statusColor = f.statusTone === 'brand' ? 'var(--brand)' : f.statusTone === 'bad' ? 'var(--bad)' : f.statusTone === 'accent' ? 'var(--accent-ink)' : 'var(--muted)';
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
                            <L en={f.categoryEn} ar={f.categoryAr} /> · <span data-region="facility-site-id" style={{ fontVariantNumeric: 'tabular-nums' }}>{f.siteId ?? f.id}</span>
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
                            <L en="Status" ar="الحالة" />
                          </div>
                          <div data-region="facility-site-status" style={{ fontSize: '14.5px', lineHeight: 1.45, color: statusColor }}>
                            <L en={f.statusEn} ar={f.statusAr} />
                          </div>
                        </div>
                        <div data-due="" style={{ textAlign: 'end', minWidth: 170 }}>
                          <div style={secLabel}>
                            <L en="Next due" ar="الاستحقاق التالي" />
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>{f.nextLapse ?? '—'}</div>
                          {f.nextLapse && f.nextLapseEn && f.nextLapseAr ? <div data-region="next-due-what" style={{ fontSize: 12.5, color: 'var(--muted)' }}><L en={f.nextLapseEn} ar={f.nextLapseAr} /></div> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}

            {eventsAtSites !== null && showFacilities ? <EventsAtYourSites groups={eventsAtSites} /> : null}
          </>
        )}


        {cancelled.length > 0 && showEvents ? (
          <details data-region="cancelled-events" style={{ marginBlockStart: 48, borderBlockStart: '1px solid var(--line)', paddingBlockStart: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>
              <L en={`Cancelled (${cancelled.length})`} ar={`الملغاة (${cancelled.length})`} />
            </summary>
            <div style={{ marginBlockStart: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en="Cancelled events. The record remains readable; nothing further can be filed on it." ar="فعاليات ملغاة. يبقى السجل قابلاً للقراءة؛ ولا يمكن تقديم أي شيء إضافي عليه." />
              </div>
              {cancelled.map((e) => (
                <Link key={e.id} href={`/events/${e.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                    <L en={e.nameEn} ar={e.nameAr} />
                  </span>
                  <span style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                    {e.id}{e.startDate ? ` · ${e.startDate}` : ''}
                  </span>
                  {e.level !== null ? (
                    <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                      <L en={`Level ${e.level}`} ar={`المستوى ${e.level}`} />
                    </span>
                  ) : null}
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                    <L en={`Cancelled${e.lifecycleAt ? ` ${e.lifecycleAt.slice(0, 10)}` : ''}`} ar={`أُلغيت${e.lifecycleAt ? ` ⁦${e.lifecycleAt.slice(0, 10)}⁩` : ''}`} />
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ) : null}

        {previousCount > 0 ? (
          <details data-region="previous-services" style={{ marginBlockStart: 48, borderBlockStart: '1px solid var(--line)', paddingBlockStart: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>
              <L en={`Archive (${previousCount})`} ar={`الأرشيف (${previousCount})`} />
            </summary>
            <div style={{ marginBlockStart: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                <L en="Concluded records. Read-only." ar="سجلات منتهية. للقراءة فقط." />
              </div>
              {archived.length > 0 ? (
                <div data-region="previous-events">
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
                    <L en="Past events" ar="الفعاليات السابقة" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {archived.map((e) => (
                      <div key={e.id} data-past-event={e.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingBlock: 8, paddingInlineStart: 16, paddingInlineEnd: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }}>
                        <Link href={`/events/${e.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', minHeight: 44, color: 'var(--muted)', flex: '1 1 260px' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: 500, alignSelf: 'center' }}>
                            <L en={e.nameEn} ar={e.nameAr} />
                          </span>
                          <span style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>
                            {e.id} · {e.endDate ?? '—'}
                          </span>
                          {e.level !== null ? (
                            <span style={{ fontSize: '12.5px', alignSelf: 'center' }}>
                              <L en={`Level ${e.level}`} ar={`المستوى ${e.level}`} />
                            </span>
                          ) : null}
                        </Link>
                        {/* A cancelled event was never held; it is not duplicated from here. */}
                        {e.lifecycle !== 'cancelled' && e.endDate !== null && e.endDate < today ? (
                          <form action={reapplyEventAction.bind(null, e.id)}>
                            <button type="submit" data-action="duplicate-event" style={{ height: 44, paddingInline: 18, border: '1px solid var(--brand)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, color: 'var(--brand)', cursor: 'pointer' }}>
                              <L en="Duplicate event" ar="نسخ الفعالية" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {archivedVenues.length > 0 ? (
                <div data-region="previous-venues">
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
                    <L en="Hosting venues (replaced by facility/site registration)" ar="المواقع المستضيفة (حلّ محلّها تسجيل المنشأة/الموقع)" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {archivedVenues.map((v) => (
                      <Link key={v.id} href={`/venues/${v.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--muted)' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                          <L en={v.nameEn} ar={v.nameAr} />
                        </span>
                        <span style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                          {v.id}{v.validUntil ? ` · ${v.validUntil}` : ''}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {archivedFacilities.length > 0 ? (
                <div data-region="previous-facilities">
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
                    <L en="Facilities/sites" ar="المنشآت/المواقع" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {archivedFacilities.map((f) => (
                      <Link key={f.id} href={`/facilities/${f.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--muted)' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 500 }}>
                          <L en={f.nameEn} ar={f.nameAr} />
                        </span>
                        <span style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>{f.id}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </main>
    </>
  );
}

