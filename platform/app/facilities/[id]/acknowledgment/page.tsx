import { notFound, redirect } from 'next/navigation';
import { InfoNote } from '../../../../components/InfoNote';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { MinistryMasthead } from '../../../../components/MinistryMasthead';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { facilityDetail, unreadCountFor } from '../../../../lib/queries';
import { siteStatusFor, siteSubmissions } from '../../../../lib/site-registration';
import { siteCertificateAvailable, siteOperatorStatusLabel, siteStatusTone } from '../../../../lib/rules/site';
import { facilityCategory } from '../../../../lib/rules';
import { PrintBar } from '../../../events/[id]/acknowledgment/PrintBar';

const upLabel: React.CSSProperties = { fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' };

/**
 * THE FACILITY/SITE'S ACKNOWLEDGMENT OF RECEIPT, modelled on the event's and the venue's
 * (owner, 9 October 2026: "replicate the customer journey ... for the facility/site"):
 * printable, with the record ID -- the Site ID -- and the current status chip.
 *
 * Owner-only: anyone else gets a 404, as on every facility route. The submission time is the
 * stamp the submit action wrote on the Asia/Beirut clock, shown as stored. The status is the
 * site status the record shows: grey while it is an internal workflow state, never an event
 * outcome and never an approval.
 */
export default async function SiteAcknowledgmentPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const organization = organizationFor(account.id);
  const latest = siteSubmissions(id)[0] ?? null;
  const statusKey = siteStatusFor(id);
  const status = siteOperatorStatusLabel(statusKey);
  const tone = siteStatusTone(statusKey);
  const determined = statusKey === 'readinessCurrent' || statusKey === 'expiringSoon' || statusKey === 'expired' || statusKey === 'informationRequired' || statusKey === 'correctiveActionRequired';
  const submittedAt = latest?.submittedAt.slice(0, 16) ?? '';
  const category = facilityCategory(facility.categoryKey);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unreadCountFor(account.id)} showBack={true} back={{ href: `/facilities/${id}`, en: 'Facility/site record', ar: 'سجل المنشأة/الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Acknowledgment of receipt" ar="إشعار الاستلام" />
          <InfoNote><L en="Your facility/site registration is received once you have this receipt and its record ID." ar="يُعدّ تسجيل المنشأة/الموقع مستلماً عند حصولكم على هذا الإيصال ومعرّف السجل الوارد فيه." /></InfoNote>
        </h1>

        {!latest ? (
          // A state gate, not an absence: the acknowledgment is issued when the registration is submitted.
          <div data-region="no-acknowledgment" style={{ maxWidth: 820, marginBlock: 34, padding: '32px 36px', border: '1px dashed var(--line)', borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
              <L en="No acknowledgment exists yet. It is issued when the registration is submitted." ar="لا يوجد إشعار بعد. يصدر عند تقديم التسجيل." />
            </p>
          </div>
        ) : (
          <div data-wallcard="" data-region="site-acknowledgment" style={{ maxWidth: 820, marginBlock: 34, padding: '57px 61px', background: 'var(--surface2)', borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <MinistryMasthead />
            <div style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 8 }}><L en="Record ID" ar="معرّف السجل" /></div>
              <div data-region="record-id" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {facility.siteId ?? id}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 10 }}>
                <L en={`Issued ${submittedAt.slice(0, 10)}`} ar={`صدر في ⁦${submittedAt.slice(0, 10)}⁩`} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '28px 32px', paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              {[
                { key: 'site', en: 'Facility/site', ar: 'المنشأة/الموقع', vEn: facility.nameEn, vAr: facility.nameAr || facility.nameEn },
                { key: 'category', en: 'Category', ar: 'الفئة', vEn: category?.en ?? '—', vAr: category?.ar ?? '—' },
                { key: 'operator', en: 'Operating organization', ar: 'الجهة المشغّلة', vEn: facility.operatingOrganization || '—', vAr: facility.operatingOrganization || '—' },
                { key: 'reference', en: 'Registration reference', ar: 'مرجع التسجيل', vEn: id, vAr: id },
                { key: 'submission', en: 'Submission', ar: 'الطلب', vEn: String(latest.version), vAr: String(latest.version) },
                { key: 'submitted', en: 'Submitted (Beirut time)', ar: 'تاريخ التقديم (بتوقيت بيروت)', vEn: submittedAt, vAr: `⁦${submittedAt}⁩` },
              ].map((f) => (
                <div key={f.key} data-fact={f.key}>
                  <div style={{ ...upLabel, letterSpacing: '.06em', marginBlockEnd: 6 }}><L en={f.en} ar={f.ar} /></div>
                  <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}><L en={f.vEn} ar={f.vAr} /></div>
                </div>
              ))}
            </div>

            <div data-region="acknowledgment-status" style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 12 }}><L en="Current Ministry status" ar="الحالة الحالية لدى الوزارة" /></div>
              {/* Grey and quiet while it is an internal workflow state. */}
              <div data-region="status-chip" data-status={statusKey} style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 999, background: tone === 'brand' ? 'var(--brand-soft)' : tone === 'bad' ? 'var(--bad-soft)' : tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface2)', color: tone === 'grey' ? 'var(--muted)' : 'var(--ink)', fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}>
                <L en={status.en} ar={status.ar} />
              </div>
              {!determined ? (
                <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <L en="The Ministry reviews the registration and records its outcome: readiness current, or a request for information or a correction. You are notified on this platform when it does." ar="تراجع الوزارة التسجيل وتسجّل نتيجتها: الجاهزية سارية، أو طلب معلومات أو تصحيح. يصلكم إشعار على هذه المنصة عند تسجيلها." />
                </p>
              ) : statusKey === 'informationRequired' ? (
                <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <L en={`The Ministry asks for more. The record is open for revision; resubmitting archives version ${latest.version} and the record ID does not change.`} ar={`تطلب الوزارة المزيد. السجل مفتوح للتعديل؛ وإعادة التقديم تؤرشف النسخة ${latest.version} ولا يتغير معرّف السجل.`} />
                </p>
              ) : siteCertificateAvailable(statusKey) ? (
                <p data-noprint="" style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <a href={`/facilities/${id}/certificate`}><L en="Open the registration certificate" ar="فتح شهادة التسجيل" /></a>
                </p>
              ) : null}
            </div>

            <div data-region="limits" style={{ paddingBlockStart: 30 }}>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 500 }}>
                <L en="This acknowledges receipt of a facility/site registration for cardiac-arrest readiness. It is not a registration certificate." ar="يُقرّ هذا باستلام تسجيل منشأة/موقع للجاهزية لتوقف القلب. وهو ليس شهادة تسجيل." />
              </p>
            </div>
          </div>
        )}

        {latest ? <PrintBar /> : null}
      </main>
    </>
  );
}
