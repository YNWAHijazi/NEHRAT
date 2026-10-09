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
import { siteStatusTone } from '../lib/rules/site';

export type FacilityScreen = 'record' | 'details';

const TONE: Record<ReturnType<typeof siteStatusTone>, { color: string; bg: string }> = {
  grey: { color: 'var(--muted)', bg: 'var(--surface2)' },
  accent: { color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
  bad: { color: 'var(--bad)', bg: 'var(--bad-soft)' },
  brand: { color: 'var(--brand)', bg: 'var(--brand-soft)' },
};

/**
 * One identity layout for the facility/site record and its details edit screen. The Site ID
 * is the primary identifier -- the anchor for the AEDs, incidents, events, documents and the
 * Ministry's actions (latest revision, 9 October 2026, section 2) -- and the FC-nnnn record
 * id stays as the registration reference. The status is the site status, product-defined.
 */
export function FacilityWorkspace({ account, facility: f, active, children }: { account: Account; facility: FacilityDetail; active: FacilityScreen; children: React.ReactNode }) {
  const facts = facilityRegistrationFacts(f.id);
  const state = facilityStatusLabel(facts);
  const tone = TONE[siteStatusTone(facts.status)];
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
              ...(siteId ? [{ en: 'Site ID', ar: 'معرّف الموقع', value: <span data-region="site-id">{siteId}</span>, strong: true }] : []),
              { en: 'Registration reference', ar: 'مرجع التسجيل', value: <span data-region="registration-reference">{f.id}</span>, strong: !siteId },
              {
                en: 'Status', ar: 'الحالة',
                value: (
                  <span data-region="site-status" data-status={facts.status} style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 13.5 }}>
                    <L en={state.en} ar={state.ar} />
                  </span>
                ),
              },
            ]}
            nameEn={f.nameEn}
            nameAr={f.nameAr}
            stats={stats}
          />
          {active !== 'record' ? (
            <Link href={`/facilities/${f.id}`} data-region="back-to-record" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginBlock: '8px 20px', fontSize: '14.5px', color: 'var(--brand)' }}>
              <span data-flip="" aria-hidden="true" style={{ marginInlineEnd: 6 }}>←</span><L en="Back to the facility/site record" ar="العودة إلى سجل المنشأة/الموقع" />
            </Link>
          ) : <div style={{ marginBlockEnd: 20 }} />}
        </div>
        {children}
      </main>
    </>
  );
}
