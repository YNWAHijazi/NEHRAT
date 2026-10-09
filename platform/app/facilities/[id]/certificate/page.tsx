import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { facilityDetail, facilityDevices, facilityPlanConfirmation } from '../../../../lib/queries';
import { ensureFacilityCertificateToken } from '../../../../lib/facility-gis';
import { siteStatusFor } from '../../../../lib/site-registration';
import { siteCertificateAvailable, siteStatusLabel } from '../../../../lib/rules/site';
import { siteIdForFacility } from '../../../../lib/sites';
import { can } from '../../../../lib/rules/ministry';
import { FACILITY_CONTENT, facilityCategory } from '../../../../lib/rules';
import { PrintButton } from '../../../../components/PrintButton';
import { L } from '../../../../components/L';

/**
 * THE FACILITY REGISTRATION CERTIFICATE (partner audit, 2026-10-08), modelled on
 * the venue certificate: the facility's names, record id, category, registration
 * date, the registered AEDs and the readiness confirmation that completes the
 * registration -- and a verification link. The link carries an unguessable token
 * (non-negotiable 5b), minted here the first time the completed certificate
 * renders. While the registration is incomplete the page says what is pending and
 * issues nothing: no token, no link.
 *
 * NO QR IMAGE. The platform carries no QR encoder and ships none; the verification
 * address is printed in full so it can be typed, and can be rendered as a QR once
 * an encoder is adopted. Recorded as a deliberate gap.
 *
 * A demonstration facility's certificate renders like a real one so the Ministry
 * can walk the platform, and says that its address does not resolve on the public
 * register (non-negotiable 8: demo rows never reach a public lookup).
 */
export default async function FacilityCertificate({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const owner = getDb().prepare('SELECT account_id, is_demo FROM facilities WHERE id = ?').get(id) as { account_id: number; is_demo: number } | undefined;
  if (!owner || owner.is_demo !== Number(account.isDemo) || (owner.account_id !== account.id && !can(account.role, 'viewSubmission'))) notFound();
  const facility = facilityDetail(owner.account_id, id);
  if (!facility) notFound();
  const content = FACILITY_CONTENT;
  const category = facilityCategory(facility.categoryKey);
  // Issued only while readiness is current: the Ministry accepted the registration and no
  // corrective action is open (the revision does not mention the certificate; recorded).
  const status = siteStatusFor(id);
  const complete = facility.archivedAt === null && siteCertificateAvailable(status);
  const back = owner.account_id === account.id ? `/facilities/${id}` : '/ministry/facilities';

  if (!complete) {
    const label = siteStatusLabel(status);
    return (
      <main style={{ maxWidth: 820, margin: '40px auto', padding: 32 }}>
        <nav data-no-print=""><Link href={back}><L en="Back" ar="رجوع" /></Link></nav>
        <h1><L en={content.certificate.titleEn} ar={content.certificate.titleAr} /></h1>
        <p><L en={content.certificate.pendingEn} ar={content.certificate.pendingAr} /></p>
        {facility.archivedAt !== null ? (
          <p><L en="This record is no longer covered by the Ministry. No certificate is issued for it." ar="لم يعد هذا السجل مشمولاً لدى الوزارة. ولا تصدر له شهادة." /></p>
        ) : (
          <p data-region="certificate-pending">
            <L
              en={`The certificate is available while readiness is current: once the Ministry has accepted the registration, and while no corrective action is open. The site’s status is ${label.en}.`}
              ar={`تتاح الشهادة ما دامت الجاهزية سارية: بعد قبول الوزارة للتسجيل، وما دام لا إجراء تصحيحياً مفتوحاً. حالة الموقع: ${label.ar}.`}
            />
          </p>
        )}
      </main>
    );
  }

  const token = ensureFacilityCertificateToken(id);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base = process.env['APP_BASE_URL'] ? process.env['APP_BASE_URL'].replace(/\/$/, '') : `${proto}://${host}`;
  const verifyUrl = `${base}/lookup/facility/${token}`;
  const devices = facilityDevices(id);
  const confirmation = facilityPlanConfirmation(id);
  const registeredOn = facility.createdAt.slice(0, 10);

  return (
    <main data-region="certificate" style={{ maxWidth: 820, margin: '40px auto', padding: 32 }}>
      <nav data-no-print=""><Link href={back}><L en="Back" ar="رجوع" /></Link></nav>
      <h1><L en={content.certificate.titleEn} ar={content.certificate.titleAr} /></h1>
      <h2><L en={facility.nameEn} ar={facility.nameAr} /></h2>
      <p><L en={`Site ID ${siteIdForFacility(id) ?? '—'} · registration reference ${id}`} ar={`معرّف الموقع ⁦${siteIdForFacility(id) ?? '—'}⁩ · مرجع التسجيل ⁦${id}⁩`} /></p>
      <p><L en={`Category: ${category?.en ?? ''}`} ar={`الفئة: ${category?.ar ?? ''}`} /></p>
      <p><L en={`${facility.address}, ${facility.municipalityEn}`} ar={`${facility.address}، ${facility.municipalityAr}`} /></p>
      <p><L en={`Registered ${registeredOn}`} ar={`سُجِّلت في ⁦${registeredOn}⁩`} /></p>
      <p>
        <L
          en={`${siteStatusLabel(status).en} · ${devices.length} AED${devices.length === 1 ? '' : 's'} registered · readiness confirmation recorded ${confirmation?.createdAt.slice(0, 10) ?? '—'}`}
          ar={`${siteStatusLabel(status).ar} · ${devices.length} جهاز مسجَّل · سُجِّل تأكيد الجاهزية في ⁦${confirmation?.createdAt.slice(0, 10) ?? '—'}⁩`}
        />
      </p>
      <div data-region="certificate-verification">
        <p><L en="Verify this certificate" ar="التحقق من هذه الشهادة" /></p>
        <p style={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}><a href={verifyUrl} dir="ltr">{verifyUrl}</a></p>
        <p><L en="The address answers with the facility name, record id, category and registration status, and nothing further." ar="يجيب العنوان باسم المنشأة ومعرّف السجل والفئة وحالة التسجيل، ولا شيء غير ذلك." /></p>
        {owner.is_demo === 1 ? (
          <p data-region="certificate-demo-note"><L en="Demonstration record: this address does not resolve on the public register." ar="سجل توضيحي: لا يُجاب عن هذا العنوان في السجل العام." /></p>
        ) : null}
      </div>
      <PrintButton en="Print or save PDF" ar="طباعة أو حفظ PDF" />
    </main>
  );
}
