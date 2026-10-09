import Link from 'next/link';
import { GovernmentBand, Header } from './Header';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { RecordHeader, type RecordStat } from './RecordHeader';
import { organizationFor, type Account } from '../lib/auth';
import { unreadCountFor, venueAssessmentsFor, daysBetween } from '../lib/queries';
import { beirutToday } from '../lib/clock';
import { levelWhy } from '../lib/rules';
import { venuePackageFor } from '../lib/venue/workspace';
import { venueStatusLabel } from '../lib/rules/venue-workflow';
import { siteIdForVenue } from '../lib/sites';

export type VenueTab = 'overview' | 'details' | 'assessment' | 'team';
export type VenueWorkspaceData = NonNullable<ReturnType<typeof venuePackageFor>>;

/** One identity layout for the venue record and its two edit screens -- the event record's, with the venue's facts. */
export function VenueWorkspace({ account, w, active, children }: { account: Account; w: VenueWorkspaceData; active: VenueTab; children: React.ReactNode }) {
  const v = w.venue;
  const state = venueStatusLabel(w.status);
  const assessed = w.assessmentVersion ? venueAssessmentsFor(account.id, v.id).find((a) => a.version === w.assessmentVersion) : undefined;
  const why = assessed ? levelWhy(assessed.derivation) : null;
  const daysLeft = v.validUntil ? daysBetween(beirutToday(), v.validUntil) : null;
  const returned = w.status === 'revision' || w.status === 'incomplete';
  const siteId = siteIdForVenue(v.id);

  const stats: RecordStat[] = [
    {
      en: 'Annual classification', ar: 'التصنيف السنوي', region: 'derivation', wrapperStyle: { maxWidth: '100%' },
      info: why?.reason || why?.comparison ? <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى">
        {why.reason ? <L en={why.reason.en} ar={why.reason.ar} /> : null}{' '}
        {why.comparison ? <L en={why.comparison.en} ar={why.comparison.ar} /> : null}
      </InfoNote> : null,
      value: w.level ?? '—',
      valueStyle: { color: w.level ? `var(--l${w.level})` : 'var(--muted)' },
      below: w.level === null ? <Link href={`/venues/${v.id}/assessment`} style={{ fontSize: 13 }}><L en="Complete the assessment" ar="إكمال التقييم" /></Link> : null,
    },
    ...(v.validUntil ? [
      { en: 'Certificate valid until', ar: 'الشهادة صالحة حتى', value: v.validUntil, valueStyle: { fontVariantNumeric: 'tabular-nums' } },
      {
        en: daysLeft !== null && daysLeft < 0 ? 'Days since expiry' : 'Days left',
        ar: daysLeft !== null && daysLeft < 0 ? 'أيام منذ الانتهاء' : 'الأيام المتبقية',
        value: daysLeft !== null ? Math.abs(daysLeft) : '—',
        valueStyle: { color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' },
      },
    ] : []),
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-region="venue-workspace-header">
          <RecordHeader
            facts={[
              { en: 'Record ID', ar: 'معرّف السجل', value: v.id, strong: true },
              // The physical place this registration belongs to; its PAD facility and its events share it.
              ...(siteId ? [{ en: 'Site ID', ar: 'معرّف المكان', value: siteId }] : []),
              { en: 'Status', ar: 'الحالة', value: <L en={state.en} ar={state.ar} /> },
            ]}
            nameEn={v.nameEn}
            nameAr={v.nameAr}
            stats={stats}
          />
          {/* One record page, like the event's (owner, 8 October 2026): no section tabs. The edit
              screens (details, assessment) lead back to the record. */}
          {active !== 'overview' ? (
            <Link href={`/venues/${v.id}`} data-region="back-to-record" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginBlock: '8px 20px', fontSize: '14.5px', color: 'var(--brand)' }}>
              <span data-flip="" aria-hidden="true" style={{ marginInlineEnd: 6 }}>←</span><L en="Back to the venue record" ar="العودة إلى سجل الموقع" />
            </Link>
          ) : <div style={{ marginBlockEnd: 20 }} />}
        </div>

        {!w.editable ? (
          <div role="status" data-region="read-only-band" style={{ padding: '20px 26px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
            <L
              en={v.archivedAt ? 'Archived record · Read-only' : w.status === 'accepted' ? 'Certificate issued · Read-only' : 'Submitted package · Read-only'}
              ar={v.archivedAt ? 'سجل مؤرشف · للقراءة فقط' : w.status === 'accepted' ? 'صدرت الشهادة · للقراءة فقط' : 'ملف مقدّم · للقراءة فقط'}
            />
          </div>
        ) : null}

        {/* The Ministry's recorded outcome and its note, the way an event shows its determination. */}
        {w.note && (returned || w.status === 'accepted') ? (
          <div role="status" data-region="determination-card" style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: `3px solid ${returned ? 'var(--accent)' : 'var(--brand)'}`, borderRadius: 12, marginBlockEnd: 32 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: returned ? 'var(--accent-ink)' : 'var(--brand)', marginBlockEnd: 6 }}>
              <L en="Ministry outcome" ar="نتيجة الوزارة" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 10 }}>
              <L en={state.en} ar={state.ar} />
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14.5px', lineHeight: 1.7 }}>{w.note}</p>
          </div>
        ) : null}

        {children}
      </main>
    </>
  );
}
