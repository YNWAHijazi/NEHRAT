import Link from 'next/link';
import { GovernmentBand, Header } from './Header';
import { L } from './L';
import { RecordHeader, type RecordStat } from './RecordHeader';
import { organizationFor, type Account } from '../lib/auth';
import { facilityLedgerFor, unreadCountFor, type FacilityDetail } from '../lib/queries';
import { beirutToday } from '../lib/clock';
import { siteIdForFacility } from '../lib/sites';
import { facilityRegistrationFacts } from '../lib/facility-registration';
import { facilityRecordMode, facilityStatusLabel } from '../lib/rules/facility-workflow';

export type FacilityScreen = 'record' | 'details';

/**
 * One identity layout for the facility record and its details edit screen -- the event's
 * and the hosting venue's (owner, 9 October 2026): the record's facts, its names and its
 * figures; no section tabs. The edit screen leads back to the record.
 */
export function FacilityWorkspace({ account, facility: f, active, children }: { account: Account; facility: FacilityDetail; active: FacilityScreen; children: React.ReactNode }) {
  const facts = facilityRegistrationFacts(f.id);
  const state = facilityStatusLabel(facts);
  const siteId = siteIdForFacility(f.id);
  // The next readiness confirmation is the ledger's own row: the date it stops counting.
  const due = facilityRecordMode(facts) === 'manage' && !facts.archived
    ? facilityLedgerFor(f.id, beirutToday()).find((r) => r.key === 'annualConfirmation')?.until ?? null
    : null;
  const stats: RecordStat[] = [
    { en: 'AEDs registered', ar: 'الأجهزة المسجّلة', region: 'aed-count', value: facts.deviceCount, valueStyle: { fontVariantNumeric: 'tabular-nums' } },
    ...(due ? [{ en: 'Readiness confirmation due', ar: 'موعد تأكيد الجاهزية', region: 'confirmation-due', value: due, valueStyle: { color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' } }] : []),
  ];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-region="facility-workspace-header">
          <RecordHeader
            facts={[
              { en: 'Record ID', ar: 'معرّف السجل', value: f.id, strong: true },
              // The physical place this registration belongs to; a hosting venue on it shares it.
              ...(siteId ? [{ en: 'Site ID', ar: 'معرّف المكان', value: siteId }] : []),
              { en: 'Status', ar: 'الحالة', value: <L en={state.en} ar={state.ar} /> },
            ]}
            nameEn={f.nameEn}
            nameAr={f.nameAr}
            stats={stats}
          />
          {active !== 'record' ? (
            <Link href={`/facilities/${f.id}`} data-region="back-to-record" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginBlock: '8px 20px', fontSize: '14.5px', color: 'var(--brand)' }}>
              <span data-flip="" aria-hidden="true" style={{ marginInlineEnd: 6 }}>←</span><L en="Back to the facility record" ar="العودة إلى سجل المنشأة" />
            </Link>
          ) : <div style={{ marginBlockEnd: 20 }} />}
        </div>
        {children}
      </main>
    </>
  );
}
