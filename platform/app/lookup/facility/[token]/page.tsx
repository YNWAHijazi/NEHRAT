import Link from 'next/link';
import { L } from '../../../../components/L';
import { PublicShell } from '../../../../components/PublicShell';
import { currentAccount } from '../../../../lib/auth';
import { facilityByCertificateToken } from '../../../../lib/facility-gis';
import { facilityRegistrationComplete } from '../../../../components/FacilityWorkspaceHeader';
import { FACILITY_CONTENT, facilityCategory } from '../../../../lib/rules';

/**
 * VERIFY A FACILITY REGISTRATION CERTIFICATE. The token is unguessable and minted
 * only for a completed registration (non-negotiable 5b: a non-sequential public
 * token, never the record id, answers an unauthenticated lookup). The answer is the
 * certificate's own statement and nothing further: the facility name, its record
 * id, its category and its registration status. Never contact details, never the
 * responsible contact, never AED locations. Demonstration records never resolve.
 */
export default async function VerifyFacilityCertificate({ params }: { params: Promise<{ token: string }> }) {
  const account = await currentAccount();
  const { token } = await params;
  const facility = facilityByCertificateToken(token);
  const found = facility && !facility.isDemo ? facility : null;
  const content = FACILITY_CONTENT;
  const category = found ? facilityCategory(found.categoryKey) : null;
  const status = !found
    ? null
    : found.archivedAt !== null
      ? { en: 'No longer covered by the Ministry', ar: 'لم تعد مشمولة لدى الوزارة' }
      : facilityRegistrationComplete(found.id)
        ? { en: content.certificate.statusEn, ar: content.certificate.statusAr }
        : { en: content.certificate.pendingEn, ar: content.certificate.pendingAr };

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/lookup" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Verify a record" ar="التحقق من سجل" />
      </Link>
      <h1 data-sec-h1="" style={{ margin: '10px 0 10px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={content.certificate.titleEn} ar={content.certificate.titleAr} />
      </h1>
      <div data-region="lookup-result" style={{ padding: '24px 26px', border: '2px solid var(--line)', borderRadius: 14, maxWidth: '70ch' }}>
        {!found || !status ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 600, marginBlockEnd: 8 }}>
              <L en="No certificate answers that" ar="لا شهادة تطابق ذلك" />
            </div>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
              <L en="No issued facility registration certificate carries that verification address." ar="لا شهادة تسجيل منشأة صادرة تحمل عنوان التحقق هذا." />
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
              <L en="On the register" ar="في السجل" />
            </div>
            {[
              { en: 'Facility', ar: 'المنشأة', v: <L en={found.nameEn} ar={found.nameAr} /> },
              { en: 'Record id', ar: 'معرّف السجل', v: found.id },
              { en: 'Category', ar: 'الفئة', v: <L en={category?.en ?? ''} ar={category?.ar ?? ''} /> },
              { en: 'Registered', ar: 'تاريخ التسجيل', v: found.registeredOn },
              { en: 'Registration status', ar: 'حالة التسجيل', v: <L en={status.en} ar={status.ar} /> },
            ].map((r) => (
              <div key={r.en} style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingBlock: 10, borderBlockEnd: '1px solid var(--line)' }}>
                <span style={{ flex: '0 0 160px', fontSize: '12.5px', color: 'var(--muted)' }}>
                  <L en={r.en} ar={r.ar} />
                </span>
                <span style={{ flex: 1, minWidth: 180, fontSize: '15px' }}>{r.v}</span>
              </div>
            ))}
            <p style={{ margin: '12px 0 0', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="The register discloses nothing further: no contact details, no AED locations, no documents." ar="لا يفصح السجل عن شيء آخر: لا بيانات اتصال ولا مواقع أجهزة ولا مستندات." />
            </p>
          </>
        )}
      </div>
    </PublicShell>
  );
}
