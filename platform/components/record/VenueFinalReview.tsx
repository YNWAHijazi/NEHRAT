import { L } from '../L';
import { VenueSubmitControls } from '../VenueSubmitControls';
import { submitVenuePackageAction } from '../../app/venues/actions';
import type { VenueCheck, VenuePackageFacts } from '../../lib/rules/venue-workflow';
import { venueSubmissionChecks } from '../../lib/rules/venue-workflow';

/**
 * The foot of the venue record page (brief item 16): what remains, with a jump link to
 * each item; the optional choices apart; the operator's declaration; one Submit. The
 * same checks the submit action re-runs.
 */
export function VenueFinalReview({ id, facts, editable, submitted, error }: { id: string; facts: VenuePackageFacts; editable: boolean; submitted: boolean; error: string | null }) {
  const { required, optional, remaining } = venueSubmissionChecks(facts);
  const href = (c: VenueCheck) =>
    c.target === 'details' ? `/venues/${id}/details`
      : c.target === 'assessment' ? `/venues/${id}/assessment`
        : c.target === 'team' ? '#req-B7'
          : c.target === 'fee' ? '#amount-due'
            : `#req-${c.key}`;
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '8px 14px', color: 'var(--ink)', borderBlockEnd: '1px solid var(--line)', textDecoration: 'none' };
  const cardStyle: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', marginBlockEnd: 16 };
  const open = required.filter((c) => !c.done);
  return (
    <section id="final-review" data-region="final-review" tabIndex={-1} style={{ marginBlockStart: 40, scrollMarginBlockStart: 16 }}>
      <h2 style={{ fontSize: 24, margin: '0 0 16px', fontWeight: 600, letterSpacing: '-.025em' }}><L en="Review and submit" ar="المراجعة والتقديم" /></h2>
      {submitted ? (
        <div role="status" data-region="submitted-notice" style={{ ...cardStyle, border: '1px solid var(--brand)', background: 'var(--brand-soft)', fontSize: 15 }}>
          <L en="Submitted. You can follow the Ministry’s review here." ar="تم التقديم. يمكنكم متابعة مراجعة الوزارة هنا." />
        </div>
      ) : null}
      {error === 'incomplete' ? (
        <div role="alert" style={{ ...cardStyle, border: '1px solid var(--bad)', fontSize: '14.5px' }}>
          <L en="The server found an item still incomplete. The list below names it." ar="وجد الخادم بنداً لم يكتمل. القائمة أدناه تسمّيه." />
        </div>
      ) : null}
      {editable ? (
        <>
          {/* With nothing left the card goes: no sentence saying so (owner, 8 October 2026). */}
          <div data-region="remaining" hidden={remaining === 0} style={cardStyle}>
            <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>
              <L en={remaining === 1 ? '1 item remaining' : `${remaining} items remaining`} ar={`${remaining} متبقٍ`} />
            </h3>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {open.map((c) => (
                <a key={c.key} href={href(c)} data-remaining={c.key} style={{ ...rowStyle, borderInlineStart: '3px solid var(--accent)' }}>
                  <span style={{ fontSize: '14.5px' }}><L en={c.en} ar={c.ar} /></span>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}><L en="Pending" ar="قيد الإنجاز" /></span>
                </a>
              ))}
            </div>
            {optional.some((c) => !c.done) ? (
              <details style={{ marginBlockStart: 12, fontSize: '13.5px', color: 'var(--muted)' }}>
                <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}><L en="Optional choices not added" ar="الخيارات الاختيارية غير المضافة" /></summary>
                <div style={{ marginBlockStart: 6 }}>
                  {optional.filter((c) => !c.done).map((c) => (
                    <a key={c.key} href={href(c)} data-optional={c.key} style={{ ...rowStyle, minHeight: 36, color: 'var(--muted)' }}><span><L en={c.en} ar={c.ar} /></span></a>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          {facts.fee && !facts.fee.paid ? (
            <div id="amount-due" data-region="amount-due" style={{ ...cardStyle, border: '1px solid var(--accent-ink)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}><L en="Registration fee" ar="رسم التسجيل" /></span>
                <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}><L en={`Amount due: ${facts.fee.amount} ${facts.fee.currency}`} ar={`المبلغ المستحق: ${facts.fee.amount} ${facts.fee.currency}`} /></span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.65 }}><L en="Payment must be recorded before you can submit." ar="يجب تسجيل الدفع قبل التقديم." /></p>
            </div>
          ) : null}
          <form action={submitVenuePackageAction.bind(null, id)} data-region="confirm-and-submit" style={cardStyle}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px' }}><L en="Confirm and submit" ar="التأكيد والتقديم" /></h3>
            <VenueSubmitControls remaining={remaining} />
          </form>
        </>
      ) : null}
    </section>
  );
}
