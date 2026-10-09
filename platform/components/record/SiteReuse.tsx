import { L } from '../L';
import { InfoNote } from '../InfoNote';
import { RequirementForm } from './RequirementForm';
import { confirmSiteInformationAction, applySiteLayoutMapAction } from '../../app/actions';
import type { RecordRequirements } from '../../lib/record-facts';
import type { SiteConfirmation, SiteInformation, SiteSnapshot } from '../../lib/event-site';
import { siteEmergencyAccessText, sitePatientAccessText } from '../../lib/event-site';
import { FACILITY_CONTENT, FACILITY_REFERENCE_KEY, fieldsFor, referenceShortfalls, siteAedAnswer, type RequirementInstance } from '../../lib/rules';
import { fieldInput, primaryButton } from '../workspace-styles';
import { arabicCount } from '../../lib/rules/venue-workflow';

/**
 * REUSING THE SITE ON THE EVENT (latest revision, sections 16 and 17). An event held at a
 * registered Facility/Site reads the site's identity, address, map pin, licensed capacity,
 * layout map, emergency access, patient extraction arrangements and registered AEDs from the
 * site record. Nothing is copied silently: the organizer confirms, once, that the site
 * information applies to this event and says what is different for it; the AEDs are reused
 * only on the organizer's answer in the CPR and AED step. The event still completes its own
 * assessment, level and requirements -- there is no inheritance from the site.
 */

/** "N registered AEDs" in Arabic: the singular, the dual, the plural to ten, the accusative singular beyond. */
const AED_COUNT_AR = { one: 'جهاز AED واحد مسجّل', two: 'جهازا AED مسجّلان', few: 'أجهزة AED مسجّلة', many: 'جهاز AED مسجّلاً' };

const dt: React.CSSProperties = { color: 'var(--muted)', fontSize: 13 };
const dd: React.CSSProperties = { margin: '4px 0 0', fontSize: '14.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px 20px', margin: 0 };

function Unrecorded() {
  return <span style={{ color: 'var(--muted)' }}><L en="None on the site record" ar="لا شيء في سجل الموقع" /></span>;
}

function Text({ value }: { value: string }) {
  return value.trim() === '' ? <Unrecorded /> : <>{value}</>;
}

/** The AEDs a site has registered, with their location and current status. */
export function SiteAedList({ info }: { info: Pick<SiteInformation, 'aeds'> }) {
  if (info.aeds.length === 0) return <L en="None registered" ar="لا أجهزة مسجّلة" />;
  return (
    <ul data-region="site-aeds" style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {info.aeds.map((a) => (
        <li key={a.label} data-aed={a.label} data-status={a.statusKey}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{a.label}</span>
          {' · '}
          <L en={a.locationEn || '—'} ar={a.locationAr || a.locationEn || '—'} />
          {' · '}
          <span style={{ color: a.statusKey === 'operational' ? 'var(--success)' : 'var(--bad)' }}><L en={a.statusEn} ar={a.statusAr} /></span>
        </li>
      ))}
    </ul>
  );
}

/** The site information an event reuses, as one definition list (the record page and the Ministry's review). */
export function SiteInformationList({ info }: { info: SiteInformation }) {
  const municipality = { en: [info.address, info.municipalityEn].filter((s) => s.trim() !== '').join(', '), ar: [info.address, info.municipalityAr].filter((s) => s.trim() !== '').join('، ') };
  return (
    <dl data-region="site-information-list" style={grid}>
      <div>
        <dt style={dt}><L en="Site" ar="الموقع" /></dt>
        <dd style={dd}><L en={`${info.nameEn} · ${info.siteId}`} ar={`${info.nameAr} · ⁦${info.siteId}⁩`} />
          {info.facilityId ? <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}><L en={`Facility/Site registration ${info.facilityId}`} ar={`تسجيل المنشأة/الموقع ⁦${info.facilityId}⁩`} /></span> : null}
        </dd>
      </div>
      <div>
        <dt style={dt}><L en="Address and municipality" ar="العنوان والبلدية" /></dt>
        <dd style={dd}>{municipality.en === '' ? <Unrecorded /> : <L en={municipality.en} ar={municipality.ar} />}</dd>
      </div>
      <div>
        <dt style={dt}><L en="Map pin" ar="الموقع على الخريطة" /></dt>
        <dd style={dd}>{info.point ? <bdi dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{`${info.point.lat.toFixed(5)}, ${info.point.lng.toFixed(5)}`}</bdi> : <Unrecorded />}</dd>
      </div>
      <div>
        <dt style={dt}><L en="Licensed capacity" ar="السعة المرخّصة" /></dt>
        <dd style={dd}>{info.licensedCapacity !== null ? info.licensedCapacity.toLocaleString('en-US') : <Unrecorded />}</dd>
      </div>
      <div>
        <dt style={dt}><L en="Site or layout map" ar="خريطة الموقع أو المخطط" /></dt>
        <dd style={dd}>{info.layoutMap ? info.layoutMap.fileName : <Unrecorded />}</dd>
      </div>
      <div>
        <dt style={dt}><L en="Emergency vehicle access" ar="وصول مركبات الطوارئ" /></dt>
        <dd style={dd}><Text value={siteEmergencyAccessText(info)} /></dd>
      </div>
      <div>
        <dt style={dt}><L en="Patient access and extraction" ar="الوصول إلى المريض وإخلاؤه" /></dt>
        <dd style={dd}><Text value={sitePatientAccessText(info)} /></dd>
      </div>
      <div>
        <dt style={dt}><L en="Registered AEDs" ar="أجهزة AED المسجّلة" /></dt>
        <dd style={dd}><SiteAedList info={info} /></dd>
      </div>
    </dl>
  );
}

/**
 * The record page's Site information block: what the site offers, and the organizer's one
 * confirmation that it applies to this event, with what is different for it.
 */
export function EventSiteBlock({ eventId, info, confirmation, editable, saved }: {
  eventId: string; info: SiteInformation; confirmation: SiteConfirmation | null; editable: boolean; saved: boolean;
}) {
  // Compact, in the record's own card style (owner, 9 October 2026: "Events now is perfect"): one
  // line, the same border and padding as the details-and-assessment card, open only while the
  // organizer has something to do here -- before confirming, or straight after a save.
  const reusable = info.facilityId !== null;
  return (
    <details id="site-information" data-region="site-information" tabIndex={-1} data-confirmed={confirmation ? 'yes' : 'no'} open={reusable && (confirmation === null || saved) ? true : undefined}
      style={{ padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 28, scrollMarginBlockStart: 16 }}>
      <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline', minHeight: 36, fontSize: 14, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 500 }}><L en="Site information" ar="معلومات الموقع" /></span>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}><L en={`${info.nameEn} · ${info.siteId}`} ar={`${info.nameAr} · ⁦${info.siteId}⁩`} /></span>
        {reusable ? (
          <span data-region="site-confirmation-state" style={{ fontSize: 13, color: confirmation ? 'var(--success)' : 'var(--accent-ink)' }}>
            {confirmation ? (
              <L en={`Confirmed for this event by ${confirmation.confirmedByName} · ${confirmation.confirmedAt.slice(0, 10)}`} ar={`أكّدها لهذه الفعالية ${confirmation.confirmedByName} · ⁦${confirmation.confirmedAt.slice(0, 10)}⁩`} />
            ) : (
              <L en="Not confirmed for this event" ar="غير مؤكّدة لهذه الفعالية" />
            )}
          </span>
        ) : null}
      </summary>
      <div style={{ paddingBlockStart: 12 }}>
        {!reusable ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en="No facility/site registration stands on this site, so there is no site information to reuse." ar="لا يوجد تسجيل منشأة/موقع على هذا الموقع، فلا معلومات موقع لإعادة استخدامها." />
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              <L
                en="Read from the registered facility/site. Nothing is used for this event until you confirm it applies. The event still completes its own assessment, level and requirements."
                ar="تُقرأ من المنشأة/الموقع المسجّل. لا يُستخدم شيء منها لهذه الفعالية قبل أن تؤكّدوا انطباقه. وتستكمل الفعالية تقييمها ومستواها ومتطلباتها الخاصة."
              />
            </p>
            <SiteInformationList info={info} />
            {confirmation && confirmation.differences ? (
              <p data-region="site-differences" style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                <span style={{ color: 'var(--muted)' }}><L en="Different for this event: " ar="المختلف في هذه الفعالية: " /></span>{confirmation.differences}
              </p>
            ) : null}
            {editable ? (
              <form action={confirmSiteInformationAction.bind(null, eventId)} data-region="site-confirmation-form" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockStart: 14 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 14, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" name="applies" value="yes" defaultChecked={confirmation !== null} style={{ inlineSize: 18, blockSize: 18, flex: 'none' }} />
                  <L en="The site information above applies to this event." ar="تنطبق معلومات الموقع أعلاه على هذه الفعالية." />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}><L en="What is different for this event (optional)" ar="ما المختلف في هذه الفعالية (اختياري)" /></span>
                  <textarea name="differences" rows={2} maxLength={2000} defaultValue={confirmation?.differences ?? ''} style={{ ...fieldInput, minBlockSize: 64, paddingBlock: 10 }} />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <button type="submit" style={primaryButton}><L en="Save" ar="حفظ" /></button>
                  {saved ? <span role="status" style={{ fontSize: 13, color: 'var(--success)' }}><L en="Saved." ar="حُفظ." /></span> : null}
                </div>
              </form>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

/** The REF instance the CPR and AED step's question saves through, from the record's stored answer. */
export function siteAedInstance(record: RecordRequirements): RequirementInstance | null {
  if (record.level === null) return null;
  const stored = record.facts?.answers[FACILITY_REFERENCE_KEY] ?? null;
  const values = { ...(stored?.values ?? {}) };
  const answer = siteAedAnswer(values);
  if (answer && values['reuse'] === undefined) values['reuse'] = answer;
  return {
    key: FACILITY_REFERENCE_KEY, n: null, labelEn: 'Site AEDs', labelAr: 'أجهزة AED في الموقع', promptEn: '', promptAr: '', infoEn: null, infoAr: null,
    sourceEn: '', sourceAr: '', responsibilityEn: '', responsibilityAr: '', obligation: 'recommended', obligationEn: '', obligationAr: '', group: 'recommended', section: 'requirement',
    state: answer ? 'complete' : 'pending', stateEn: '', stateAr: '', detailEn: null, detailAr: null, authors: ['organizer'], approver: null,
    fields: fieldsFor(FACILITY_REFERENCE_KEY, record.level, 'event') ?? [], values, missing: answer ? [] : ['reuse'], file: null, linkedPlan: [],
    answeredBy: stored ? { role: stored.savedByRole, name: stored.savedByName, at: stored.savedAt, version: stored.version } : null,
    requested: false, blocks: false, anchor: `req-${FACILITY_REFERENCE_KEY}`,
  };
}

/**
 * The CPR and AED step at a site with registered AEDs (section 17): the site's AEDs with their
 * locations and current status, and the organizer's one question. Yes reuses them for the AED
 * part of the step; No leaves the event to document its own arrangement in the step below.
 */
export function SiteAedQuestion({ record, info, canEdit }: { record: RecordRequirements; info: SiteInformation; canEdit: boolean }) {
  const inst = siteAedInstance(record);
  if (!inst || info.aeds.length === 0) return null;
  const answer = siteAedAnswer(inst.values);
  const n = info.aeds.length;
  const shortfalls = answer === 'yes'
    ? referenceShortfalls(
        { count: n, locationsEn: info.aeds.map((a) => a.locationEn), locationsAr: info.aeds.map((a) => a.locationAr), anyPediatric: info.anyPediatric, planConfirmed: false },
        { admitsChildren: inst.values['admitsChildren'] === true, temporaryAreas: inst.values['temporaryAreas'] === true },
      )
    : [];
  return (
    <div id={inst.anchor} data-region="site-aeds-question" data-answer={answer ?? ''} style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 14 }}>
      <p style={{ margin: '0 0 8px', fontSize: '14.5px', fontWeight: 500 }}>
        <L en={`This site has ${n} registered ${n === 1 ? 'AED' : 'AEDs'}`} ar={`لدى هذا الموقع ${arabicCount(n, AED_COUNT_AR)}`} />
      </p>
      <div style={{ fontSize: '13.5px', marginBlockEnd: 10 }}><SiteAedList info={info} /></div>
      <RequirementForm kind="event" id={record.id} instance={inst} canEdit={canEdit} awaiting={canEdit ? null : { en: 'Not answered', ar: 'لم تُقدَّم إجابة' }} region="site-aed-form" />
      {answer === 'yes' ? (
        <p data-region="site-aeds-reused" style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--success)' }}>
          <L en="These AEDs are used for the AED part of this step." ar="تُستخدم هذه الأجهزة لجزء جهاز AED من هذه الخطوة." />
        </p>
      ) : answer === 'no' ? (
        <p data-region="site-aeds-own" style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)' }}>
          <L en="Document the event’s own AED arrangement below." ar="وثّقوا أدناه ترتيب أجهزة AED الخاص بالفعالية." />
        </p>
      ) : null}
      {shortfalls.map((sf) => {
        const def = FACILITY_CONTENT.reference.shortfalls[sf.key];
        return (
          <div key={sf.key} data-region="shortfall" style={{ marginBlockStart: 10, padding: '12px 16px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}><L en={def.en} ar={def.ar} /></span>{' '}<L en={def.bodyEn} ar={def.bodyAr} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The site's own answer beside the event row that asks the same thing (emergency vehicle
 * access, patient access and extraction, the site map): pointed to, so the organizer does not
 * retype it, and used only once they confirm the site information applies.
 */
export function SiteRowHint({ eventId, rowKey, info, confirmed, canEdit, hasFile }: {
  eventId: string; rowKey: 'B10' | 'B11' | 'P-M'; info: SiteInformation; confirmed: boolean; canEdit: boolean; hasFile: boolean;
}) {
  if (info.facilityId === null) return null;
  const text = rowKey === 'B10' ? siteEmergencyAccessText(info) : rowKey === 'B11' ? sitePatientAccessText(info) : info.layoutMap?.fileName ?? '';
  if (text.trim() === '') return null;
  return (
    <div data-region="site-row-hint" data-row={rowKey} style={{ padding: '10px 14px', borderInlineStart: '3px solid var(--brand)', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 12, fontSize: '13.5px', lineHeight: 1.6 }}>
      <span style={{ color: 'var(--muted)' }}>
        <L en={rowKey === 'P-M' ? 'The site record has a site or layout map: ' : 'On the site record: '} ar={rowKey === 'P-M' ? 'في سجل الموقع خريطة موقع أو مخطط: ' : 'في سجل الموقع: '} />
      </span>
      <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</span>
      {!confirmed ? (
        <span style={{ display: 'block', color: 'var(--muted)' }}>
          <a href="#site-information"><L en="Confirm the site information to reuse it." ar="أكّدوا معلومات الموقع لإعادة استخدامها." /></a>
        </span>
      ) : rowKey === 'B11' ? (
        <span style={{ display: 'block', color: 'var(--muted)' }}><L en="Filled in below from the site record. You can change it." ar="مُدرجة أدناه من سجل الموقع. يمكنكم تغييرها." /></span>
      ) : rowKey === 'P-M' && canEdit && !hasFile ? (
        <form action={applySiteLayoutMapAction.bind(null, eventId)} style={{ marginBlockStart: 8 }}>
          <button type="submit" data-action="use-site-map" style={{ minHeight: 44, paddingInline: 16, border: '1px solid var(--brand)', background: 'var(--bg)', borderRadius: 22, fontSize: '13.5px', color: 'var(--brand)', cursor: 'pointer' }}>
            <L en="Use the site map for this event" ar="استخدام خريطة الموقع لهذه الفعالية" />
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** The Site information the event relied on when it was filed, as the Ministry reads it. */
export function SiteSnapshotView({ snapshot }: { snapshot: SiteSnapshot }) {
  const c = snapshot.confirmation;
  return (
    <section id="review-site" data-region="review-site-snapshot" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBlockEnd: 24 }}>
      <h2 style={{ fontSize: 20, marginBlockStart: 0 }}>
        <L en="Site information relied on" ar="معلومات الموقع المعتمد عليها" />
        <InfoNote labelEn="About the site snapshot" labelAr="حول نسخة الموقع">
          <L en="As it stood when this submission was filed. A later change to the site record does not change it." ar="كما كانت عند تقديم هذا الطلب. لا يغيّرها أي تعديل لاحق في سجل الموقع." />
        </InfoNote>
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        <L
          en={`Submission ${snapshot.submissionVersion} · recorded ${snapshot.takenAt.slice(0, 10)}${snapshot.facilityRevision !== null ? ` · site record revision ${snapshot.facilityRevision}` : ''}`}
          ar={`الطلب ${snapshot.submissionVersion} · سُجّلت في ⁦${snapshot.takenAt.slice(0, 10)}⁩${snapshot.facilityRevision !== null ? ` · نسخة سجل الموقع ${snapshot.facilityRevision}` : ''}`}
        />
      </p>
      <SiteInformationList info={snapshot.information} />
      <dl style={{ ...grid, marginBlockStart: 16 }}>
        <div>
          <dt style={dt}><L en="Organizer’s confirmation" ar="تأكيد المنظّم" /></dt>
          <dd style={dd}>
            {c.confirmed
              ? <L en={`Applies to this event · ${c.confirmedByName ?? ''} · ${(c.confirmedAt ?? '').slice(0, 10)}`} ar={`تنطبق على هذه الفعالية · ${c.confirmedByName ?? ''} · ⁦${(c.confirmedAt ?? '').slice(0, 10)}⁩`} />
              : <L en="Not confirmed" ar="غير مؤكّد" />}
          </dd>
        </div>
        <div>
          <dt style={dt}><L en="Different for this event" ar="المختلف في هذه الفعالية" /></dt>
          <dd style={dd}>{c.differences.trim() !== '' ? c.differences : <L en="Nothing recorded" ar="لم يُسجَّل شيء" />}</dd>
        </div>
        <div>
          <dt style={dt}><L en="Site AEDs remain accessible and operational throughout the event" ar="بقاء أجهزة AED في الموقع متاحة وصالحة للتشغيل طوال الفعالية" /></dt>
          <dd style={dd}>{snapshot.aedReuse === 'yes' ? <L en="Yes" ar="نعم" /> : snapshot.aedReuse === 'no' ? <L en="No" ar="لا" /> : <L en="Not answered" ar="لم تُقدَّم إجابة" />}</dd>
        </div>
      </dl>
    </section>
  );
}
