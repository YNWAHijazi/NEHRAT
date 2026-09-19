import { InfoNote } from '../../../../components/InfoNote';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { AedWhereToBuy } from '../../../../components/AedWhereToBuy';
import { VendorDirectoryLink } from '../../../../components/VendorDirectoryLink';
import { DeviceRegistry } from './DeviceRegistry';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { facilityDetail, facilityDevices, facilityPersons, unreadCountFor } from '../../../../lib/queries';
import { beirutToday } from '../../../../lib/clock';

/**
 * The AED registry (step 4). One record per device, as the AED registration form requires; the coordinator shows
 * read-only from the one facility-level record; each update is signed by the
 * facility representative -- a different signatory from the plan's coordinator.
 *
 * The reference carries a barcode/QR scan panel; the policy spec lists AI device
 * identifier capture among capabilities requiring separate approval, so it lives
 * behind the aiAedIdentifierCapture flag and ships off -- the identification FIELD
 * (barcode, QR code or serial number, the form's own wording) is a plain input.
 */
export default async function DeviceRegistryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const { notice } = await searchParams;
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const devices = facilityDevices(facility.id);
  const coordinator = facilityPersons(facility.id).find((p) => p.role === 'coordinator') ?? null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/facilities/${id}`, en: 'Facility record', ar: 'سجل المنشأة' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        {notice === 'saved' ? (
          <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
            <L en="The device record has been saved." ar="حُفظ سجل الجهاز." />
          </div>
        ) : null}
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en={`${facility.nameEn} · ${facility.id}`} ar={`${facility.nameAr} · ${facility.id}`} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="AED registry" ar="سجل أجهزة إزالة الرجفان" />
         <InfoNote><L en="Select a device to confirm or update it." ar="اختر جهازاً لتأكيده أو تحديثه." /></InfoNote>
        </h1>


        <DeviceRegistry
          facilityId={facility.id}
          devices={devices}
          coordinatorName={coordinator?.nameOrPosition ?? ''}
          today={beirutToday()}
        />

        {/* THE FLOW CONTINUES (partner ruling, 2026-09-05): registering a device
            used to end here, and steps 5 and 6 of the registration were reachable
            only by knowing the address. Devices are step 4; this is the way on. */}
        <div data-region="continue-to-plan" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockStart: 32 }}>
          <a
            href={`/facilities/${facility.id}/plan`}
            style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}
          >
            <L en="Continue to the response plan" ar="المتابعة إلى خطة الاستجابة" />
          </a>
          <a
            href={`/facilities/${facility.id}`}
            style={{ height: 48, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 24, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
          >
            <L en="The facility record" ar="سجل المنشأة" />
          </a>
        </div>

        <AedWhereToBuy />

        <VendorDirectoryLink />

      </main>
    </>
  );
}
