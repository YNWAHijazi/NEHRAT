import Link from 'next/link';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { RecordHeader } from './RecordHeader';
import { organizationFor } from '../lib/auth';
import { assessmentsFor, beirutToday, daysBetween, archiveWindowDays, type EventRow } from '../lib/queries';
import { clockNow } from '../lib/clock';
import { eventFilingDeadline, isArchivedRecord, levelWhy, type EventGateContext } from '../lib/rules';
import { chip } from './workspace-styles';

/**
 * The identity header of the single event record page: name in both languages, record
 * id, date, level, deadline and current status (brief: Layout). The tab strip that
 * used to sit under it is gone -- there is one page.
 */
export function EventWorkspaceHeader({ accountId, event }: { accountId: number; event: EventRow }) {
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
  const dates = event.startDate && event.endDate && event.startDate !== event.endDate ? `${event.startDate} — ${event.endDate}` : event.startDate ?? '—';
  const statusTone = event.outcome === 'satisfied' ? 'done' : event.outcome ? 'pending' : event.filed ? 'muted' : 'pending';
  return <div data-region="event-workspace-header">
        <RecordHeader
          facts={[
            {
              en: 'Record ID', ar: 'معرّف السجل', value: event.id, strong: true,
              extra: event.copiedFrom ? (
                <div data-region="copied-from" style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                  <Link href={`/events/${event.copiedFrom}`} style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
                    <L en={`Copied from ${event.copiedFrom}`} ar={`منسوخة من ${event.copiedFrom}`} />
                  </Link>
                </div>
              ) : null,
            },
            { en: 'Event date', ar: 'تاريخ الفعالية', value: <bdi dir="ltr">{dates}</bdi> },
            { en: 'Status', ar: 'الحالة', value: <span data-region="record-status" style={chip(statusTone)}><L en={event.stateEn} ar={event.stateAr} /></span> },
          ]}
          nameEn={event.nameEn}
          nameAr={event.nameAr}
          stats={[
            {
              en: 'Level', ar: 'المستوى', region: 'derivation', wrapperStyle: { maxWidth: '100%' },
              info: why?.reason || why?.comparison ? <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى">
                {why.reason ? <L en={why.reason.en} ar={why.reason.ar} /> : null}{' '}
                {why.comparison ? <L en={why.comparison.en} ar={why.comparison.ar} /> : null}
              </InfoNote> : null,
              value: level ?? '—',
              valueStyle: { color: level ? `var(--l${level})` : 'var(--muted)' },
              below: level === null ? <Link href={`/events/${event.id}/reassess`} style={{ fontSize: 13 }}><L en="Complete the assessment" ar="إكمال التقييم" /></Link> : null,
            },
            // A filed record owes no filing: the File by / Days left tiles rendered
            // on after filing -- a satisfied record read "Days left -34" beside a rail
            // marking Submitted done (Pass B re-walk, 2026-09-02).
            ...(filing && !event.filed ? [
              {
                en: 'Submit by', ar: 'التقديم بحلول',
                info: filing.conditional && filing.conditionEn && filing.conditionAr ? <InfoNote labelEn="Filing deadline" labelAr="مهلة التقديم"><L en={filing.conditionEn} ar={filing.conditionAr} /></InfoNote> : null,
                value: filing.date,
                valueStyle: { fontVariantNumeric: 'tabular-nums' },
              },
              {
                en: daysLeft !== null && daysLeft < 0 ? 'Days overdue' : 'Days left',
                ar: daysLeft !== null && daysLeft < 0 ? 'أيام التأخير' : 'الأيام المتبقية',
                value: daysLeft !== null ? Math.abs(daysLeft) : '—',
                valueStyle: { color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' },
              },
            ] : []),
          ]}
        />
  </div>;
}
