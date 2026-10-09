import Link from 'next/link';
import type { ReactNode } from 'react';
import { L } from '../../../components/L';
import { UploadInput } from '../../../components/UploadInput';
import { respondToSiteRequestAction } from '../../site-actions';
import { SITE_TABS, reviewActLabel, type SiteTabKey } from '../../../lib/rules/site';
import type { SiteEventRow, SiteHistoryEntry, SiteRequest, SiteReviewAct, SiteSubmission } from '../../../lib/site-registration';

/**
 * The facility/site dashboard's parts (latest revision, 9 October 2026, sections 12-14):
 * the tab strip, the events held at the site, and the Ministry history with the operator's
 * answers to the Ministry's requests and corrective actions. Shared where it makes sense with
 * the Ministry's review screen, which draws the same history read-only.
 */

/** The platform's own tab look (components/AdminTabs.tsx): soft pills on a rule, the current one in the brand colour -- at the 44px target. */
const tabLink = (on: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 16, borderRadius: 999, fontSize: '14px',
  background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', fontWeight: on ? 500 : 400, textDecoration: 'none',
});

/** Overview | Cardiac readiness | AEDs | Events | Incident reports | Documents | Ministry history. Links, not client state, as the admin tabs are; no venue tab. */
export function SiteTabsNav({ facilityId, active }: { facilityId: string; active: SiteTabKey }) {
  return (
    <nav aria-label="Site record" data-tabs="" data-region="site-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 28, borderBlockEnd: '1px solid var(--line)', paddingBlockEnd: 12 }}>
      {SITE_TABS.map((t) => (
        <Link key={t.key} href={`/facilities/${facilityId}?tab=${t.key}`} data-tab={t.key} aria-current={t.key === active ? 'page' : undefined} style={tabLink(t.key === active)} scroll={false}>
          <L en={t.en} ar={t.ar} />
        </Link>
      ))}
    </nav>
  );
}

export function TabSection({ id, titleEn, titleAr, children, action }: { id: string; titleEn: string; titleAr: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} data-region={`section-${id}`} tabIndex={-1} style={{ marginBlockEnd: 44, scrollMarginBlockStart: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 16 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}><L en={titleEn} ar={titleAr} /></h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const dates = (e: { startDate: string | null; endDate: string | null }) =>
  !e.startDate ? '—' : e.endDate && e.endDate !== e.startDate ? `${e.startDate} – ${e.endDate}` : e.startDate;

/**
 * The events linked to this site (section 13). The owner's own events open their records;
 * another organizer's event shows its name, dates, record id, level and status and nothing
 * else -- the projection that read it selected nothing more (lib/site-registration.ts).
 */
export function EventsTab({ siteId, events, archived }: { siteId: string | null; events: SiteEventRow[]; archived: boolean }) {
  const cell: React.CSSProperties = { background: 'var(--bg)', padding: '12px 14px', fontSize: '14px', lineHeight: 1.45, minWidth: 0 };
  const head: React.CSSProperties = { background: 'var(--surface2)', padding: '10px 14px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' };
  return (
    <div data-region="site-events">
      {siteId && !archived ? (
        <p style={{ margin: '0 0 18px' }}>
          <Link href={`/events/new?site=${siteId}`} data-region="create-event-at-site" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 20, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500 }}>
            <L en="Create event at this site" ar="إنشاء فعالية في هذا الموقع" />
          </Link>
        </p>
      ) : null}
      {events.length === 0 ? (
        <p data-region="no-site-events" style={{ margin: 0, fontSize: '14.5px', color: 'var(--muted)' }}><L en="No events are linked to this site." ar="لا فعاليات مرتبطة بهذا الموقع." /></p>
      ) : (
        <div data-stack="" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,2fr) 1.2fr 1fr .6fr 1.2fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {([['Event', 'الفعالية'], ['Dates', 'التواريخ'], ['Record ID', 'معرّف السجل'], ['Level', 'المستوى'], ['Status', 'الحالة']] as const).map(([en, ar]) => (
            <div key={en} data-th="" style={head}><L en={en} ar={ar} /></div>
          ))}
          {events.map((e) => [
            <div key={`${e.id}-name`} data-event-row={e.id} data-own={e.own || undefined} style={{ ...cell, fontWeight: 500 }}>
              {e.own ? <Link href={`/events/${e.id}`}><L en={e.nameEn} ar={e.nameAr} /></Link> : <L en={e.nameEn} ar={e.nameAr} />}
              {!e.own ? <span style={{ display: 'block', fontSize: 12.5, fontWeight: 400, color: 'var(--muted)' }}><L en="Another organizer’s event" ar="فعالية لمنظّم آخر" /></span> : null}
            </div>,
            <div key={`${e.id}-dates`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{dates(e)}</div>,
            <div key={`${e.id}-id`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{e.id}</div>,
            <div key={`${e.id}-level`} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{e.level === null ? '—' : <L en={`Level ${e.level}`} ar={`المستوى ${e.level}`} />}</div>,
            <div key={`${e.id}-status`} style={cell}><L en={e.statusEn} ar={e.statusAr} /></div>,
          ])}
        </div>
      )}
    </div>
  );
}

const REQUEST_KIND: Record<SiteRequest['kind'], { en: string; ar: string }> = {
  corrective: { en: 'Corrective action', ar: 'إجراء تصحيحي' },
  confirmation: { en: 'Readiness confirmation requested', ar: 'طُلب تأكيد الجاهزية' },
  information: { en: 'Additional information requested', ar: 'طُلبت معلومات إضافية' },
  correction: { en: 'Correction requested', ar: 'طُلب تصحيح' },
};

/** One request or corrective action: what the Ministry recorded, the operator's answers, and how it closed. */
export function RequestCard({ facilityId, request: r, respond, close }: {
  facilityId: string;
  request: SiteRequest;
  /** The operator may answer it here (an open corrective action on a live record). */
  respond: boolean;
  /** The Ministry's close control, drawn by the review screen. */
  close?: ReactNode;
}) {
  const kind = REQUEST_KIND[r.kind];
  const open = r.status === 'open';
  return (
    <div id={`request-${r.id}`} data-request={r.id} data-kind={r.kind} data-status={r.status}
      style={{ paddingBlock: '18px', paddingInline: '22px', background: 'var(--surface2)', borderInlineStart: `3px solid ${open ? (r.kind === 'corrective' ? 'var(--bad)' : 'var(--accent)') : 'var(--brand)'}`, borderRadius: 12, marginBlockEnd: 12, scrollMarginBlockStart: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}><L en={kind.en} ar={kind.ar} /></span>
        <span data-region="request-status" style={{ padding: '3px 10px', borderRadius: 999, fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', background: open ? 'var(--accent-soft)' : 'var(--brand-soft)', color: open ? 'var(--accent-ink)' : 'var(--brand)' }}>
          {open
            ? (r.responses.length > 0 && r.kind === 'corrective'
              ? <L en="Open — answered, awaiting Ministry verification" ar="مفتوح — جرى الرد، بانتظار تحقق الوزارة" />
              : <L en="Open" ar="مفتوح" />)
            : <L en={`Closed ${r.closedAt ?? ''}`} ar={`أُقفل ⁦${r.closedAt ?? ''}⁩`} />}
        </span>
      </div>
      <dl style={{ margin: 0, display: 'grid', gap: 6, fontSize: '14.5px', lineHeight: 1.55 }}>
        {r.deficiency ? <div><dt style={{ display: 'inline', color: 'var(--muted)' }}><L en="Deficiency: " ar="النقص: " /></dt><dd style={{ display: 'inline', margin: 0 }}>{r.deficiency}</dd></div> : null}
        <div>
          <dt style={{ display: 'inline', color: 'var(--muted)' }}>{r.kind === 'corrective' ? <L en="Corrective action requested: " ar="الإجراء التصحيحي المطلوب: " /> : <L en="Request: " ar="الطلب: " />}</dt>
          <dd style={{ display: 'inline', margin: 0 }}><L en={r.bodyEn} ar={r.bodyAr} /></dd>
        </div>
        {r.note ? <div><dt style={{ display: 'inline', color: 'var(--muted)' }}><L en="Ministry note: " ar="ملاحظة الوزارة: " /></dt><dd style={{ display: 'inline', margin: 0 }}>{r.note}</dd></div> : null}
        {r.kind === 'corrective' ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {r.due ? <L en={`Due ${r.due}`} ar={`يُستحق في ⁦${r.due}⁩`} /> : <L en="No due date: the Ministry has not published a corrective-action timeline." ar="لا تاريخ استحقاق: لم تنشر الوزارة مهلة للإجراءات التصحيحية." />}
          </div>
        ) : null}
        <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          <L en={`Raised ${r.raisedAt}${r.raisedBy ? ` · ${r.raisedBy}` : ''}`} ar={`أُثير في ⁦${r.raisedAt}⁩${r.raisedBy ? ` · ${r.raisedBy}` : ''}`} />
        </div>
      </dl>
      {r.responses.length > 0 ? (
        <ul data-region="request-responses" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          {r.responses.map((x) => (
            <li key={x.id} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: '14px', lineHeight: 1.55 }}>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}><L en={`Operator’s answer · ${x.at.slice(0, 10)}`} ar={`ردّ المشغّل · ⁦${x.at.slice(0, 10)}⁩`} /></span>
              {x.note}
              {x.documentId ? <> · <a href={`/api/facility-documents/${facilityId}/${x.documentId}`} target="_blank" rel="noreferrer">{x.fileName}</a></> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!open && r.closeNote ? (
        <p data-region="request-verified" style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.55 }}>
          {r.kind === 'corrective'
            ? <L en={`Closed by the Ministry. Verified: ${r.closeNote}`} ar={`أقفلته الوزارة. ما جرى التحقق منه: ${r.closeNote}`} />
            : <L en={`Closed: ${r.closeNote}`} ar={`أُقفل: ${r.closeNote}`} />}
        </p>
      ) : null}
      {open && respond && r.kind === 'corrective' ? (
        <form action={respondToSiteRequestAction.bind(null, facilityId, r.id)} data-region="request-response-form" style={{ display: 'grid', gap: 12, marginBlockStart: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="What was done to correct it" ar="ما الذي تم لتصحيحه" /></span>
            <textarea name="note" required rows={3} style={{ width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 15, lineHeight: 1.55 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}><L en="Evidence, if any (optional)" ar="الدليل، إن وُجد (اختياري)" /></span>
            <UploadInput name="evidence" />
          </label>
          <button type="submit" style={{ justifySelf: 'start', minHeight: 44, padding: '10px 22px', border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
            <L en="Send the answer to the Ministry" ar="إرسال الرد إلى الوزارة" />
          </button>
        </form>
      ) : null}
      {open && respond && r.kind === 'confirmation' ? (
        <p style={{ margin: '12px 0 0' }}><Link href={`/facilities/${facilityId}?tab=readiness#confirmation`}><L en="Record the readiness confirmation" ar="تسجيل تأكيد الجاهزية" /></Link></p>
      ) : null}
      {open && respond && (r.kind === 'information' || r.kind === 'correction') ? (
        <p style={{ margin: '12px 0 0' }}><Link href={`/facilities/${facilityId}?tab=overview#resubmit`}><L en="Update the record and submit it again" ar="تحديث السجل وتقديمه مجدداً" /></Link></p>
      ) : null}
      {open ? close : null}
    </div>
  );
}

/**
 * The Ministry history (section 9's history, and the operator's view of it): previous
 * submissions, the Ministry's acts and requests, corrective actions, incidents and the site's
 * changes. The operator answers corrective actions here.
 */
export function HistoryTab({ facilityId, submissions, acts, requests, incidentCount, changes, respond, closeFor }: {
  facilityId: string;
  submissions: SiteSubmission[];
  acts: SiteReviewAct[];
  requests: SiteRequest[];
  incidentCount: number;
  changes: SiteHistoryEntry[];
  respond: boolean;
  /** The Ministry's close control for an open corrective action, on the review screen. */
  closeFor?: (r: SiteRequest) => ReactNode;
}) {
  const row: React.CSSProperties = { background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: '14.5px', lineHeight: 1.5 };
  const list: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 28 };
  const h3: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600 };
  const muted: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' };
  return (
    <div data-region="ministry-history">
      <h3 style={h3}><L en="Submissions" ar="عمليات التقديم" /></h3>
      {submissions.length === 0 ? <p style={{ ...muted, margin: '0 0 28px' }}><L en="Not yet submitted." ar="لم يُقدَّم بعد." /></p> : (
        <div data-region="submission-versions" style={list}>
          {submissions.map((s) => (
            <div key={s.id} style={row}>
              <span><L en={`Version ${s.version}`} ar={`الإصدار ${s.version}`} /></span>
              <span style={muted}>{s.submittedAt}{s.submittedBy ? ` · ${s.submittedBy}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      <h3 style={h3}><L en="Ministry review" ar="مراجعة الوزارة" /></h3>
      {acts.length === 0 ? <p style={{ ...muted, margin: '0 0 28px' }}><L en="No Ministry act recorded yet." ar="لم يُسجَّل أي إجراء للوزارة بعد." /></p> : (
        <div data-region="review-acts" style={list}>
          {acts.map((a) => {
            const label = reviewActLabel(a.kind);
            return (
              <div key={a.id} data-act={a.kind} style={row}>
                <span style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500 }}><L en={label.en} ar={label.ar} /></span>
                  {a.inspectionDate ? <span style={{ display: 'block', ...muted }}><L en={`Inspection date ${a.inspectionDate}`} ar={`تاريخ التفتيش ⁦${a.inspectionDate}⁩`} /></span> : null}
                  {a.note ? <span style={{ display: 'block' }}>{a.note}</span> : null}
                </span>
                <span style={muted}>{a.at}{a.actor ? ` · ${a.actor}` : ''}{a.version ? ` · v${a.version}` : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      <div id="requests" style={{ scrollMarginBlockStart: 16 }}>
        <h3 style={h3}><L en="Requests and corrective actions" ar="الطلبات والإجراءات التصحيحية" /></h3>
        {requests.length === 0 ? <p data-region="no-requests" style={{ ...muted, margin: '0 0 28px' }}><L en="No requests from the Ministry." ar="لا طلبات من الوزارة." /></p> : (
          <div data-region="site-requests" style={{ marginBlockEnd: 28 }}>
            {requests.map((r) => <RequestCard key={r.id} facilityId={facilityId} request={r} respond={respond} close={closeFor?.(r)} />)}
          </div>
        )}
      </div>

      <h3 style={h3}><L en="Incidents" ar="الحوادث" /></h3>
      <p style={{ margin: '0 0 28px', fontSize: '14.5px' }}>
        <L en={incidentCount === 1 ? '1 incident report.' : `${incidentCount} incident reports.`} ar={`تقارير الحوادث: ${incidentCount}.`} />
      </p>

      <h3 style={h3}><L en="Site changes" ar="تغييرات الموقع" /></h3>
      {changes.length === 0 ? <p style={{ ...muted, margin: 0 }}><L en="No changes recorded." ar="لا تغييرات مسجّلة." /></p> : (
        <div data-region="site-changes" style={list}>
          {changes.map((c, i) => (
            <div key={`${c.at}-${i}`} style={row}>
              <span><L en={c.en} ar={c.ar} />{c.detail ? <span style={{ color: 'var(--muted)' }}> · {c.detail}</span> : null}</span>
              <span style={muted}>{c.at}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
