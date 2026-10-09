import { L } from '../../../components/L';
import { submitSiteRegistrationAction } from '../../site-actions';
import type { SummaryLine, SummaryKey } from '../../../lib/rules/site';

/** Where each line is completed: a step on the record, or the details edit screen. */
function lineHref(facilityId: string, key: SummaryKey, managing: boolean): string {
  switch (key) {
    case 'profile': return `/facilities/${facilityId}/profile`;
    case 'contact': return `/facilities/${facilityId}/profile#contact`;
    case 'emsAccess': return `/facilities/${facilityId}/profile`;
    case 'aeds': return managing ? `/facilities/${facilityId}?tab=aeds` : '#aeds';
    case 'plan': return managing ? `/facilities/${facilityId}?tab=readiness` : '#plan';
    case 'confirmation': return managing ? `/facilities/${facilityId}?tab=readiness#confirmation` : '#confirmation-step';
    case 'infrastructure': return managing ? `/facilities/${facilityId}?tab=overview#infrastructure` : '#infrastructure';
    case 'evidence': return managing ? `/facilities/${facilityId}?tab=documents` : '#evidence';
  }
}

/**
 * THE SINGLE REVIEW PAGE (latest revision, 9 October 2026, section 8): one line per part of
 * the registration with its state, then "Submit Facility/Site registration to MOPH". The
 * button is drawn disabled, with the reason, while a required line is open -- it becomes
 * available when the line is complete (rule 10: disabled with a reason). The optional lines
 * never block. On the dashboard, answering a Ministry request, it submits the updated version.
 */
export function SubmitReview({ facilityId, lines, managing, refused }: {
  facilityId: string;
  lines: SummaryLine[];
  /** On the dashboard (answering a Ministry request) rather than the step path. */
  managing: boolean;
  /** The server refused a submission (?error=submit). */
  refused: boolean;
}) {
  const open = lines.filter((l) => !l.done);
  const ready = open.length === 0;
  return (
    <div data-region="site-review">
      {refused ? (
        <p role="alert" style={{ margin: '0 0 16px', padding: '12px 16px', border: '1px solid var(--bad)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.55 }}>
          <L en="The registration was not submitted. Complete the items marked below, then submit again." ar="لم يُقدَّم التسجيل. أكملوا البنود المشار إليها أدناه، ثم قدّموه مجدداً." />
        </p>
      ) : null}
      <div data-region="review-summary" style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 20 }}>
        {lines.map((l) => (
          <a key={l.key} href={lineHref(facilityId, l.key, managing)} data-summary={l.key} data-done={l.done || undefined}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '10px 16px', borderBlockEnd: '1px solid var(--line)', borderInlineStart: `3px solid ${l.optional ? 'var(--line)' : l.done ? 'var(--success)' : 'var(--accent)'}`, color: 'var(--ink)', textDecoration: 'none', background: 'var(--bg)' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 500 }}><L en={l.en} ar={l.ar} /></span>
            <span style={{ fontSize: '13.5px', color: l.optional ? 'var(--muted)' : l.done ? 'var(--success)' : 'var(--accent-ink)' }}>
              <L en={l.valueEn} ar={l.valueAr} />
            </span>
          </a>
        ))}
      </div>
      <form action={submitSiteRegistrationAction.bind(null, facilityId)}>
        <button type="submit" disabled={!ready} data-region="submit-registration"
          style={{ minHeight: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6 }}>
          {managing
            ? <L en="Submit the updated registration to MOPH" ar="تقديم التسجيل المحدَّث إلى وزارة الصحة العامة" />
            : <L en="Submit Facility/Site registration to MOPH" ar="تقديم تسجيل المنشأة/الموقع إلى وزارة الصحة العامة" />}
        </button>
        {!ready ? (
          <p data-region="submit-reason" style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <L
              en={`Available once these are complete: ${open.map((l) => l.en).join(', ')}.`}
              ar={`يتاح عند اكتمال ما يلي: ${open.map((l) => l.ar).join('، ')}.`}
            />
          </p>
        ) : (
          <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en="The submission is kept as a numbered version. The Ministry reviews it; the record stays editable." ar="يُحفظ التقديم كإصدار مرقّم. تراجعه الوزارة، ويبقى السجل قابلاً للتعديل." />
          </p>
        )}
      </form>
    </div>
  );
}
