import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { SubmissionChecklist } from '../../../../components/SubmissionChecklist';
import { L } from '../../../../components/L';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { venuePackageFacts } from '../../../../lib/venue/workspace';
import { venueSubmissionChecks, type VenueCheck } from '../../../../lib/rules/venue-workflow';
import { submitVenuePackageAction } from '../../actions';
import { alertBand, noticeBand } from '../../../../components/workspace-styles';

/** The submission package in the event's shape: the checklist, what is still outstanding, the declaration, one button. */
export default async function VenueSubmit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; submitted?: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const q = await searchParams;
  const facts = venuePackageFacts(w);
  const { required, optional, remaining, canSubmit } = venueSubmissionChecks(facts);
  const href = (c: VenueCheck) =>
    c.target === 'details' ? `/venues/${id}/details`
      : c.target === 'assessment' ? `/venues/${id}/assessment`
        : c.target === 'team' ? `/venues/${id}/team`
          : c.target === 'fee' ? '#fee'
            : `/venues/${id}/requirements#r-${c.n}`;
  const row = (c: VenueCheck) => ({ key: c.key, en: c.en, ar: c.ar, done: c.done, href: href(c) });

  return (
    <VenueWorkspace account={account} w={w} active="submit">
      <h2 data-sec-h1="" style={{ fontSize: 28, marginBlock: '0 24px' }}><L en="Submission package" ar="حزمة التقديم" /></h2>
      {q.submitted ? (
        <div role="status" style={noticeBand}><L en="Submitted. You can follow the Ministry’s review here." ar="تم التقديم. يمكنكم متابعة مراجعة الوزارة هنا." /></div>
      ) : null}
      {q.error ? (
        <div role="alert" style={alertBand}><L en="Complete the required items and confirm the declaration before submitting." ar="أكملوا البنود المطلوبة وأكّدوا الإقرار قبل التقديم." /></div>
      ) : null}

      <SubmissionChecklist required={required.map(row)} optional={optional.map(row)} />

      {facts.fee && !facts.fee.paid ? (
        <div id="fee" data-region="amount-due" style={{ maxWidth: 900, padding: '19px 23px', border: '1px solid var(--accent-ink)', borderRadius: 12, marginBlockEnd: 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}><L en="Registration fee" ar="رسم التسجيل" /></span>
            <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
              <L en={`Amount due: ${facts.fee.amount} ${facts.fee.currency}`} ar={`المبلغ المستحق: ${facts.fee.amount} ${facts.fee.currency}`} />
            </span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.65 }}>
            <L en="Payment must be recorded before you can submit." ar="يجب تسجيل الدفع قبل التقديم." />
          </p>
        </div>
      ) : null}

      {w.editable ? (
        <form action={submitVenuePackageAction.bind(null, id)} data-region="confirm-and-submit">
          <h2 style={{ fontSize: 20, marginBlock: '8px 12px' }}><L en="Confirm and submit" ar="التأكيد والتقديم" /></h2>
          <label style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '16px 20px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 22, maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.6 }}>
            <input type="checkbox" name="confirm" value="yes" required style={{ marginBlockStart: 4 }} />
            <L en="I confirm these details and documents are accurate and cover the venue’s routine operations." ar="أؤكّد أن هذه البيانات والمستندات صحيحة وتشمل التشغيل الاعتيادي للموقع." />
          </label>

          {/* Every outstanding item is a row of the checklist above, marked Pending and linked;
              the count rides on the button rather than repeating the list. */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              height: 48,
              paddingInline: 26,
              border: 0,
              borderRadius: 24,
              background: canSubmit ? 'var(--brand)' : 'var(--surface2)',
              color: canSubmit ? 'var(--bg)' : 'var(--muted)',
              fontSize: 15,
              fontWeight: 500,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {canSubmit
              ? <L en="Submit to the Ministry" ar="التقديم إلى الوزارة" />
              : <L en={`Submit to the Ministry — ${remaining} remaining`} ar={`التقديم إلى الوزارة — ${remaining} متبقٍ`} />}
          </button>
        </form>
      ) : null}
    </VenueWorkspace>
  );
}
