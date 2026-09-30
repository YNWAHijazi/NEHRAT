import Link from 'next/link';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { EventWorkspaceNav, type EventWorkspaceSection } from './EventWorkspaceNav';
import { organizationFor } from '../lib/auth';
import { assessmentsFor, beirutToday, daysBetween, archiveWindowDays, type EventRow } from '../lib/queries';
import { clockNow } from '../lib/clock';
import { eventFilingDeadline, isArchivedRecord, levelWhy, type EventGateContext } from '../lib/rules';

const upLabel: React.CSSProperties = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 };

/** One identity and navigation layout for every organizer event tab. */
export function EventWorkspaceHeader({ accountId, event, active }: { accountId: number; event: EventRow; active: EventWorkspaceSection }) {
  const latest = assessmentsFor(accountId, event.id)[0];
  const level = latest?.derivation.finalLevel ?? event.level;
  const why = latest ? levelWhy(latest.derivation, latest.inputs.eventDisciplines) : null;
  const today = beirutToday();
  const context: EventGateContext = { finalLevel: level, eventEndDate: event.endDate, eventEndTime: event.closingTime ?? null,
    eventStartDate: event.startDate, filed: event.filed, lifecycle: event.lifecycle,
    organizationStatus: organizationFor(accountId)?.status ?? 'none',
    archived: isArchivedRecord({ archivedAt: event.archivedAt, endDate: event.endDate }, today, archiveWindowDays()), now: clockNow() };
  const filing = eventFilingDeadline(context);
  const daysLeft = filing ? daysBetween(today, filing.date) : null;
  return <div data-region="event-workspace-header">
        {/* Identity header, from the reference */}
        <div data-region="record-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 32 }}>
          <div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBlockEnd: 12 }}>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Record ID" ar="معرّف السجل" />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{event.id}</div>
                {event.copiedFrom ? (
                  <div data-region="copied-from" style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                    <Link href={`/events/${event.copiedFrom}`} style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
                      <L en={`Copied from ${event.copiedFrom}`} ar={`منسوخة من ${event.copiedFrom}`} />
                    </Link>
                  </div>
                ) : null}
              </div>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Event date" ar="تاريخ الفعالية" />
                </div>
                <div style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{event.startDate ?? '—'}</div>
              </div>
            </div>
            <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
              <bdi lang="en">{event.nameEn}</bdi>{event.nameAr && event.nameAr !== event.nameEn ? <> <span style={{display:'block'}}><bdi lang="ar" style={{fontWeight: 400, fontSize: '0.7em', marginBlockStart: 4 }}>({event.nameAr})</bdi></span></> : null}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div data-region="derivation" style={{ maxWidth: '100%' }}>
              <div className="event-stat-label" style={upLabel}>
                <L en="Level" ar="المستوى" />
                {why?.reason || why?.comparison ? <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى">
                  {why.reason ? <L en={why.reason.en} ar={why.reason.ar} /> : null}{' '}
                  {why.comparison ? <L en={why.comparison.en} ar={why.comparison.ar} /> : null}
                </InfoNote> : null}
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: level ? `var(--l${level})` : 'var(--muted)' }}>
                {level ?? '—'}
              </div>
              {level === null ? <Link href={`/events/${event.id}/reassess`} style={{ fontSize: 13 }}><L en="Complete the assessment" ar="إكمال التقييم" /></Link> : null}
            </div>
            {/* A filed record owes no filing: the File by / Days left tiles rendered
                on after filing — a satisfied record read "Days left −34" beside a rail
                marking Submitted done (Pass B re-walk, 2026-09-02). */}
            {filing && !event.filed ? (
              <>
                <div>
                  <div className="event-stat-label" style={upLabel}>
                    <L en="Submit by" ar="التقديم بحلول" />
                    {filing.conditional && filing.conditionEn && filing.conditionAr ? <InfoNote labelEn="Filing deadline" labelAr="مهلة التقديم"><L en={filing.conditionEn} ar={filing.conditionAr} /></InfoNote> : null}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{filing.date}</div>
                </div>
                <div>
                  <div className="event-stat-label" style={upLabel}>
                    <L en={daysLeft !== null && daysLeft < 0 ? "Days overdue" : "Days left"} ar={daysLeft !== null && daysLeft < 0 ? "أيام التأخير" : "الأيام المتبقية"} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' }}>{daysLeft !== null ? Math.abs(daysLeft) : '—'}</div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <EventWorkspaceNav eventId={event.id} active={active} />

  </div>;
}
