import { InfoNote } from '../../../../components/InfoNote';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { MinistryMasthead } from '../../../../components/MinistryMasthead';
import { organizationFor } from '../../../../lib/auth';
import { unreadCountFor } from '../../../../lib/queries';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { VenueRetiredNotice } from '../../../../components/venue/VenueRetiredNotice';
import { venueStatusLabel } from '../../../../lib/rules/venue-workflow';
import { PrintBar } from '../../../events/[id]/acknowledgment/PrintBar';

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
};

/**
 * The venue's acknowledgment of receipt, modelled on the event's (owner, 8 October
 * 2026: "Review and submit -- Submitted. The record ID is ... Open the acknowledgment of
 * receipt -- and you can view and print the receipt and it has the status").
 *
 * Owner-only, through the same check every venue page uses (ownedVenuePage): a medical
 * partner or anyone else gets a 404. The submission time is the stamp the submit action
 * wrote through now_stamp() -- lib/clock's nowStamp, on the Asia/Beirut clock every date
 * gate runs on -- so it is shown as stored, never re-zoned in the browser.
 *
 * The status is the label the venue record itself shows (venueStatusLabel): grey while
 * the submission is with the Ministry and not yet determined; the compliance form's own
 * words once an outcome is recorded.
 */
export default async function VenueAcknowledgmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const v = w.venue;
  // A receipt exists once a package has been submitted: the submit action stamps it and
  // counts the submission. A returned package keeps the receipt of its last submission.
  const filed = w.submittedAt !== null && w.revision > 0 && w.status !== 'draft';
  const status = venueStatusLabel(w.status);
  const determined = w.status === 'accepted' || w.status === 'revision' || w.status === 'incomplete';
  const returned = w.status === 'revision' || w.status === 'incomplete';
  const submittedAt = w.submittedAt?.slice(0, 16) ?? '';

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/venues/${id}`, en: 'Venue record', ar: 'سجل الموقع' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <VenueRetiredNotice venueId={id} accountId={account.id} />
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Acknowledgment of receipt" ar="إشعار الاستلام" />
          <InfoNote><L
            en="Your venue submission is received once you have this receipt and its record ID."
            ar="يُعدّ طلب الموقع مستلماً عند حصولكم على هذا الإيصال ومعرّف السجل الوارد فيه."
          /></InfoNote>
        </h1>

        {!filed ? (
          /* A state gate, not an absence: the acknowledgment is coming once the package is submitted. */
          <div data-region="no-acknowledgment" style={{ maxWidth: 820, marginBlock: 34, padding: '32px 36px', border: '1px dashed var(--line)', borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
              <L
                en="No acknowledgment exists yet. It is issued when the submission is filed."
                ar="لا يوجد إشعار بعد. يصدر عند تقديم الملف."
              />
            </p>
          </div>
        ) : (
          <div data-wallcard="" data-region="venue-acknowledgment" style={{ maxWidth: 820, marginBlock: 34, padding: '57px 61px', background: 'var(--surface2)', borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <MinistryMasthead />

            <div style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 8 }}>
                <L en="Record ID" ar="معرّف السجل" />
              </div>
              <div data-region="record-id" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {v.mophReference ?? id}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 10 }}>
                <L en={`Issued ${submittedAt.slice(0, 10)}`} ar={`صدر في ⁦${submittedAt.slice(0, 10)}⁩`} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '28px 32px', paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              {[
                { key: 'venue', en: 'Venue', ar: 'الموقع', vEn: v.nameEn, vAr: v.nameAr || v.nameEn },
                { key: 'level', en: 'Final level', ar: 'المستوى النهائي', vEn: w.level ? `Level ${w.level}` : '—', vAr: w.level ? `المستوى ${w.level}` : '—' },
                { key: 'operator', en: 'Operator', ar: 'الجهة المشغّلة', vEn: organization?.nameEn ?? '—', vAr: organization?.nameAr ?? '—' },
                { key: 'submission', en: 'Submission', ar: 'الطلب', vEn: String(w.revision), vAr: String(w.revision) },
                { key: 'submitted', en: 'Submitted (Beirut time)', ar: 'تاريخ التقديم (بتوقيت بيروت)', vEn: submittedAt, vAr: `⁦${submittedAt}⁩` },
              ].map((f) => (
                <div key={f.key} data-fact={f.key}>
                  <div style={{ ...upLabel, letterSpacing: '.06em', marginBlockEnd: 6 }}>
                    <L en={f.en} ar={f.ar} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>
                    <L en={f.vEn} ar={f.vAr} />
                  </div>
                </div>
              ))}
            </div>

            <div data-region="acknowledgment-status" style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 12 }}>
                <L en="Current Ministry status" ar="الحالة الحالية لدى الوزارة" />
              </div>
              {/* Grey and quiet while it is an internal workflow state, not a determination. */}
              <div data-region="status-chip" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 999, background: determined ? 'var(--brand-soft)' : 'var(--surface2)', color: determined ? 'var(--ink)' : 'var(--muted)', fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}>
                <L en={status.en} ar={status.ar} />
              </div>
              {/* What happens next. */}
              {!determined ? (
                <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <L
                    en="The Ministry reviews the submission and records one of three outcomes. You are notified on this platform when it does."
                    ar="تراجع الوزارة الطلب وتسجّل إحدى ثلاث نتائج. يصلكم إشعار على هذه المنصة عند تسجيلها."
                  />
                </p>
              ) : returned ? (
                <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <L
                    en={`The Ministry's determination asks for more. The record is open for revision; re-filing archives version ${w.revision} and the record ID does not change.`}
                    ar={`نتيجة الوزارة تطلب المزيد. السجل مفتوح للتعديل؛ وإعادة التقديم تؤرشف النسخة ${w.revision} ولا يتغير معرّف السجل.`}
                  />
                </p>
              ) : (
                <p data-noprint="" style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
                  <a href={`/venues/${id}/certificate`}>
                    <L en="Download venue certificate" ar="تنزيل شهادة الموقع" />
                  </a>
                </p>
              )}
            </div>

            <div data-region="limits" style={{ paddingBlockStart: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 500 }}>
                <L
                  en="This acknowledges receipt of a submission recording health and medical preparedness. It is not a hosting venue classification certificate."
                  ar="يُقرّ هذا باستلام تقديم يسجّل التأهب الصحي والطبي. وهو ليس شهادة تصنيف موقع استضافة الفعاليات."
                />
              </p>
            </div>
          </div>
        )}

        {filed ? <PrintBar /> : null}
      </main>
    </>
  );
}
