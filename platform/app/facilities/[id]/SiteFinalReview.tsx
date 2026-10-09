import { L } from '../../../components/L';
import { fieldInput } from '../../../components/workspace-styles';
import { SiteSubmitControls } from './SiteSubmitControls';
import { submitSiteRegistrationAction } from '../../site-actions';
import { FACILITY_CONTENT } from '../../../lib/rules';
import type { SummaryKey, SummaryLine } from '../../../lib/rules/site';

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
 * THE FOOT OF THE SITE RECORD, laid out like the event's FinalReview (owner, 9 October 2026:
 * "replicate the customer journey ... for the facility/site"): "Review and submit"; once
 * submitted, the receipt band with the acknowledgment one click away and the declaration as
 * signed, read-only; while returned, the revision band; otherwise the registration summary
 * the revision lists (section 8), what remains with a jump link to each, the optional parts
 * apart, the declaration, then "Submit Facility/Site registration to MOPH" beside Save as
 * draft. Every rule it shows is lib/rules/site.ts's; the server re-checks them.
 */
export function SiteFinalReview({ facilityId, siteId, lines, managing, refused, locked, returned, version, filed, me, details }: {
  facilityId: string;
  siteId: string | null;
  lines: SummaryLine[];
  /** On the dashboard (answering a Ministry request after acceptance) rather than the step path. */
  managing: boolean;
  /** The server refused a submission (?error=submit). */
  refused: boolean;
  /** With the Ministry and not yet accepted: the receipt band and the declaration as signed. */
  locked: boolean;
  /** Returned for information or a correction: the record is open for revision. */
  returned: boolean;
  /** The latest submitted version, 0 before the first. */
  version: number;
  /** The declaration as signed on the latest submission. */
  filed: { representative: string; position: string; submittedAt: string } | null;
  me: { name: string } | null;
  /** The submission details, as the event's declaration card carries them. */
  details: { en: string; ar: string; valueEn: string; valueAr: string }[];
}) {
  const required = lines.filter((l) => !l.optional);
  const open = required.filter((l) => !l.done);
  const optional = lines.filter((l) => l.optional);
  const d = FACILITY_CONTENT.site.declaration;
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '8px 14px', color: 'var(--ink)', borderBlockEnd: '1px solid var(--line)', textDecoration: 'none' };
  const cardStyle: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', marginBlockEnd: 16 };
  const record = siteId ?? facilityId;

  return (
    <section id={managing ? 'resubmit-review' : 'final-review'} data-region="final-review" tabIndex={-1} style={{ marginBlockStart: managing ? 0 : 40, scrollMarginBlockStart: 16 }}>
      {!managing ? <h2 style={{ fontSize: 24, margin: '0 0 16px', fontWeight: 600, letterSpacing: '-.025em' }}><L en="Review and submit" ar="المراجعة والتقديم" /></h2> : null}

      {locked ? (
        <div data-region="filed-band" style={{ ...cardStyle, border: '1px solid var(--brand)', background: 'var(--brand-soft)', fontSize: 15, lineHeight: 1.65 }}>
          <L en={`Submitted. The record ID is ${record}.`} ar={`قُدِّم. معرّف السجل هو ⁦${record}⁩.`} />{' '}
          <a href={`/facilities/${facilityId}/acknowledgment`} style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}><L en="Open the acknowledgment of receipt" ar="فتح إشعار الاستلام" /></a>
        </div>
      ) : null}
      {returned ? (
        <div data-region="revision-band" style={{ ...cardStyle, border: '1px solid var(--accent)', background: 'var(--accent-soft)', fontSize: '14.5px', lineHeight: 1.65 }}>
          <L en={`The Ministry asks for more. The record is open for revision; resubmitting archives version ${version} and the record ID does not change.`} ar={`تطلب الوزارة المزيد. السجل مفتوح للتعديل؛ وإعادة التقديم تؤرشف النسخة ${version} ولا يتغير معرّف السجل.`} />
        </div>
      ) : null}
      {refused ? (
        <div role="alert" style={{ ...cardStyle, border: '1px solid var(--bad)', fontSize: '14.5px', lineHeight: 1.6 }}>
          <L en="The registration was not submitted. The server found an item still incomplete, or the declaration unsigned. The list below names what remains." ar="لم يُقدَّم التسجيل. وجد الخادم بنداً لم يكتمل أو إقراراً غير موقّع. القائمة أدناه تسمّي ما تبقّى." />
        </div>
      ) : null}

      {/* The revision's own review lines (section 8), every one, complete or not. */}
      <div data-region="review-summary" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {lines.map((l) => (
          <a key={l.key} href={lineHref(facilityId, l.key, managing)} data-summary={l.key} data-done={l.done || undefined}
            style={{ ...rowStyle, borderInlineStart: `3px solid ${l.optional ? 'var(--line)' : l.done ? 'var(--success)' : 'var(--accent)'}` }}>
            <span style={{ fontSize: '14.5px', fontWeight: 500 }}><L en={l.en} ar={l.ar} /></span>
            <span style={{ flex: 'none', fontSize: '13.5px', color: l.optional ? 'var(--muted)' : l.done ? 'var(--success)' : 'var(--accent-ink)' }}><L en={l.valueEn} ar={l.valueAr} /></span>
          </a>
        ))}
      </div>

      {!locked ? (
        // With nothing left the card goes: no sentence saying so (owner, 8 October 2026).
        <div data-region="remaining" hidden={open.length === 0} style={cardStyle}>
          <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>
            <L en={open.length === 1 ? '1 item remaining' : `${open.length} items remaining`} ar={`${open.length} متبقٍ`} />
          </h3>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {open.map((l) => (
              <a key={l.key} href={lineHref(facilityId, l.key, managing)} data-remaining={l.key} style={{ ...rowStyle, borderInlineStart: '3px solid var(--accent)' }}>
                <span style={{ fontSize: '14.5px' }}><L en={l.en} ar={l.ar} /></span>
                <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}><L en={l.valueEn} ar={l.valueAr} /></span>
              </a>
            ))}
          </div>
          {optional.length > 0 ? (
            <details style={{ marginBlockStart: 12, fontSize: '13.5px', color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}><L en="Optional parts" ar="الأجزاء الاختيارية" /></summary>
              <div style={{ marginBlockStart: 6 }}>
                {optional.map((l) => (
                  <a key={l.key} href={lineHref(facilityId, l.key, managing)} data-optional={l.key} style={{ ...rowStyle, minHeight: 36, color: 'var(--muted)' }}>
                    <span><L en={l.en} ar={l.ar} /></span><span><L en={l.valueEn} ar={l.valueAr} /></span>
                  </a>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div id="site-declaration" data-region="site-declaration" tabIndex={-1} style={{ ...cardStyle, scrollMarginBlockStart: 16 }}>
        <details data-region="submission-details" style={{ marginBlockEnd: 16 }}>
          <summary style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', fontSize: '14.5px', color: 'var(--muted)' }}><L en="Submission details" ar="تفاصيل التقديم" /></summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBlockStart: 8 }}>
            {details.map((h) => (
              <div key={h.en} style={{ background: 'var(--bg)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '13.5px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--muted)' }}><L en={h.en} ar={h.ar} /></span>
                <span style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}><L en={h.valueEn} ar={h.valueAr} /></span>
              </div>
            ))}
          </div>
        </details>
        {locked && filed ? (
          <>
            <h3 style={{ fontSize: 16, margin: '0 0 6px' }}><L en={d.titleEn} ar={d.titleAr} /></h3>
            <div style={{ paddingBlock: 13, paddingInlineStart: 16, paddingInlineEnd: 16, background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, margin: '10px 0 16px', fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
              <L en={d.en} ar={d.ar} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
              {([[filed.representative, 'Authorized representative', 'الممثل المفوّض'], [filed.position, 'Position', 'الصفة']] as const).map(([value, en, ar]) => (
                <label key={en} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en={en} ar={ar} /></span>
                  <input value={value} disabled readOnly style={fieldInput} />
                </label>
              ))}
            </div>
          </>
        ) : !locked ? (
          <form action={submitSiteRegistrationAction.bind(null, facilityId)} data-region="confirm-and-submit">
            <SiteSubmitControls remaining={open.length} revision={returned} me={me} />
          </form>
        ) : null}
      </div>
    </section>
  );
}
