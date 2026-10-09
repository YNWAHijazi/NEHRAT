import Link from 'next/link';
import { VenueWorkspace } from '../../../components/VenueWorkspace';
import { NextStepCard } from '../../../components/NextStepCard';
import { StageRail } from '../../../components/StageRail';
import { RecordRequirements } from '../../../components/record/RecordRequirements';
import { VenueFinalReview } from '../../../components/record/VenueFinalReview';
import { VenuePadPanel } from '../../../components/venue/VenuePadPanel';
import { linkableFacilitiesFor, padFacilityForVenue } from '../../../lib/sites';
import { actionGrid, actionCell, actionPill, actionPillDisabled, actionReason, gateReason } from '../../../components/RecordActions';
import { L } from '../../../components/L';
import { ownedVenuePage } from '../../../lib/venue/page';
import { venuePackageFacts } from '../../../lib/venue/workspace';
import { getDb } from '../../../lib/db';
import { beirutToday } from '../../../lib/clock';
import { venueReassessmentGate } from '../../../lib/rules';
import { venueNextAction, venueRailStages, venueStatusLabel } from '../../../lib/rules/venue-workflow';
import { venueAssessmentsFor, venueChangeSinceAssessment } from '../../../lib/queries';
import { InfoNote } from '../../../components/InfoNote';
import { levelWhy } from '../../../lib/rules';
import { renewVenuePackageAction, reopenVenueSectionAction } from '../actions';

/**
 * THE VENUE'S SINGLE RECORD PAGE, laid out as the event's (owner, 8 October 2026), in the
 * order of the Hosting Venue Registration revised logic: venue profile, annual assessment,
 * venue infrastructure and access, the linked PAD facility's AEDs, review and submit, the
 * annual venue certificate. A hosting venue names no EMS agency and no Medical Director;
 * each event held there names its own. No section tabs.
 */
export default async function VenueRecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; submitted?: string; upload?: string; doc?: string; saved?: string; step?: string; pad?: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const q = await searchParams;
  const v = w.venue;
  const facts = venuePackageFacts(w);
  const next = venueNextAction(facts);
  const { stage, stages } = venueRailStages(facts);
  const certificates = getDb()
    .prepare('SELECT version, effective, valid_until FROM venue_assessments WHERE venue_id = ? AND certificate_issued = 1 ORDER BY version DESC')
    .all(id) as unknown as { version: number; effective: string; valid_until: string }[];
  const renewal = venueReassessmentGate({ validUntil: v.validUntil, today: beirutToday(), changeReportedSinceAssessment: venueChangeSinceAssessment(account.id, id) });
  const renewalReason = gateReason(renewal);
  const assessed = w.assessmentVersion ? venueAssessmentsFor(account.id, id).find((a) => a.version === w.assessmentVersion) ?? null : null;
  const why = assessed ? levelWhy(assessed.derivation) : null;
  const pad = padFacilityForVenue(id);
  const signed = (getDb().prepare('SELECT representative, position FROM venue_assessments WHERE venue_id = ? AND version = ?').get(id, w.assessmentVersion ?? 0) as { representative: string; position: string } | undefined) ?? { representative: '', position: '' };
  // Once filed, the final review reads as the event's does: the record ID, the receipt, and the declaration as signed.
  const filed = w.status !== 'draft' && w.submittedAt ? { submittedAt: w.submittedAt, revision: w.revision, ...signed } : null;
  const editLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 18, fontSize: '13.5px', color: 'var(--ink)' };
  const contentTypes: Record<string, string | null> = {};
  for (const f of w.files) contentTypes[f.docKey] = null;
  const derived = {
    scheduleEn: `${v.nameEn} · routine operating session · capacity ${v.licensedCapacity ?? '—'}`,
    scheduleAr: `${v.nameAr} · جلسة تشغيل اعتيادية · السعة ${v.licensedCapacity ?? '—'}`,
    contactsEn: v.responsibleName,
    contactsAr: v.responsibleName,
    organizerPhoneMissing: !v.responsiblePhone,
  };

  return (
    <VenueWorkspace account={account} w={w} active="overview">
      {next ? <NextStepCard step={next} to={next.href.startsWith('#') ? next.href : `/venues/${id}/${next.href}`} /> : null}
      {/* Submitted and not yet decided: say what happens next, and keep the receipt one click away -- as on the event record. */}
      {w.status === 'submitted' && !v.archivedAt ? (
        <NextStepCard
          step={{
            kind: 'underReview', href: 'acknowledgment', tone: 'brand',
            titleEn: venueStatusLabel('submitted').en, titleAr: venueStatusLabel('submitted').ar,
            bodyEn: 'The Ministry reviews the submission and records one of three outcomes. You are notified on this platform when it does.',
            bodyAr: 'تراجع الوزارة الطلب وتسجّل إحدى ثلاث نتائج. يصلكم إشعار على هذه المنصة عند تسجيلها.',
            buttonEn: 'View acknowledgment of receipt', buttonAr: 'عرض إشعار الاستلام',
          }}
          to={`/venues/${id}/acknowledgment`}
        />
      ) : null}

      {w.status === 'accepted' ? (
        <div data-region="certificate-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, marginBlockEnd: 32 }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
              <L en="Annual venue certificate" ar="الشهادة السنوية للموقع" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45 }}>
              <L en={v.validUntil ? `Valid until ${v.validUntil}` : 'Issued'} ar={v.validUntil ? `صالحة حتى ⁦${v.validUntil}⁩` : 'صادرة'} />
            </div>
          </div>
          <Link href={`/venues/${id}/certificate`} style={{ flex: 'none', height: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
            <L en="Open the certificate" ar="فتح الشهادة" />
          </Link>
        </div>
      ) : null}

      <StageRail titleEn="Venue progress" titleAr="مراحل الموقع" stages={stages} noteEn={`Stage ${stage} of ${stages.length}`} noteAr={`المرحلة ${stage} من ${stages.length}`} />

      {/* The compact details and assessment block, with deliberate edit actions -- as on the event record. */}
      <section id="assessment" data-region="details-assessment" tabIndex={-1} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 28, scrollMarginBlockStart: 16 }}>
        <div style={{ fontSize: 14, lineHeight: 1.5, minWidth: 0 }}>
          <span style={{ fontWeight: 500 }}><L en="Venue profile and annual assessment" ar="ملف الموقع والتقييم السنوي" /></span>
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13 }}>
            {assessed && w.level !== null ? (
              <>
                <L en={`Level ${w.level} · assessment version ${assessed.version} · capacity ${v.licensedCapacity ?? '—'}`} ar={`المستوى ${w.level} · نسخة التقييم ${assessed.version} · السعة ${v.licensedCapacity ?? '—'}`} />
                {why?.reason ? <> <InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى"><L en={why.reason.en} ar={why.reason.ar} />{why.comparison ? <> <L en={why.comparison.en} ar={why.comparison.ar} /></> : null}</InfoNote></> : null}
              </>
            ) : <L en="The assessment is not complete; no level is derived and no requirements apply yet." ar="التقييم غير مكتمل؛ لم يُستنتج مستوى ولا تنطبق متطلبات بعد." />}
          </span>
        </div>
        {w.editable ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
            {/* One click straight into the form, as on the event record: each action reopens its section. */}
            <form action={reopenVenueSectionAction.bind(null, id, 'details')}>
              <button type="submit" data-region="edit-details-link" style={{ ...editLink, background: 'var(--bg)', cursor: 'pointer' }}><L en="Edit the venue profile" ar="تعديل ملف الموقع" /></button>
            </form>
            {assessed ? (
              <form action={reopenVenueSectionAction.bind(null, id, 'assessment')}>
                <button type="submit" data-region="reassess-link" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontSize: '12.5px', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 36, display: 'inline-flex', alignItems: 'center' }}>
                  <L en="Something changed? Update the assessment" ar="تغيّر شيء؟ حدّثوا التقييم" />
                </button>
              </form>
            ) : (
              <Link href={`/venues/${id}/assessment`} style={editLink}><L en="Complete the assessment" ar="إكمال التقييم" /></Link>
            )}
          </div>
        ) : null}
      </section>

      {/* The routes off the record that are not requirements. */}
      <div data-region="record-actions" style={{ ...actionGrid, display: 'grid', marginBlockEnd: 28 }}>
        <span style={actionCell}>
          <Link href={`/venues/${id}/change`} style={actionPill}><L en="Report a venue change" ar="الإبلاغ عن تغيير في الموقع" /></Link>
        </span>
        {w.status === 'accepted' && !v.archivedAt ? (
          renewal.behaviour === 'enabled' ? (
            <form action={renewVenuePackageAction.bind(null, id)} style={actionCell}>
              <button type="submit" style={{ ...actionPill, cursor: 'pointer' }}><L en="Renew certificate" ar="تجديد الشهادة" /></button>
            </form>
          ) : renewal.behaviour === 'disabled' ? (
            <span style={actionCell}>
              <button type="button" disabled style={actionPillDisabled}><L en="Renew certificate" ar="تجديد الشهادة" /></button>
              <span style={actionReason}><L en={renewalReason.en} ar={renewalReason.ar} /></span>
            </span>
          ) : null
        ) : null}
      </div>

      {w.record && w.level !== null ? (
        <div id="req-summary" tabIndex={-1}>
          {!w.editable && w.status !== 'draft' ? (
            <div data-region="submitted-band" style={{ padding: '14px 20px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en={`Submitted on ${w.submittedAt?.slice(0, 10) ?? ''} · submission ${w.revision}. The answers below are the record as the Ministry reads it.`} ar={`قُدِّم في ⁦${w.submittedAt?.slice(0, 10) ?? ''}⁩ · الطلب ${w.revision}. الإجابات أدناه هي السجل كما تقرأه الوزارة.`} />
            </div>
          ) : null}
          <RecordRequirements record={w.record} viewerRole="organizer" viewerConfirmed contentTypes={contentTypes} refusal={q.upload && q.doc ? { key: q.doc, reason: q.upload } : null} derived={derived} listHref={`/venues/${id}/requirements`} initialStep={q.step ?? q.saved ?? q.doc ?? null}
            extras={{ V7: <VenuePadPanel venueId={id} pad={pad} linkable={w.editable ? linkableFacilitiesFor(account.id, id) : []} editable={w.editable} refused={q.pad === 'refused'} /> }}
            final={<VenueFinalReview id={id} facts={facts} editable={w.editable} submitted={Boolean(q.submitted)} error={q.error ?? null} filed={filed} />} />
        </div>
      ) : (
        <>
          <div id="req-summary" role="status" style={{ padding: '16px 22px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '14.5px' }}>
            <Link href={`/venues/${id}/assessment`}><L en="Complete the assessment to see the requirements. The level is derived from one routine operating session." ar="أكملوا التقييم للاطلاع على المتطلبات. يُستنتج المستوى من جلسة تشغيل اعتيادية واحدة." /></Link>
          </div>
          {/* Without a level the final review still names the details, the assessment and the fee. */}
          <VenueFinalReview id={id} facts={facts} editable={w.editable} submitted={Boolean(q.submitted)} error={q.error ?? null} filed={filed} />
        </>
      )}

      <details data-region="history" className="record-details" style={{ marginBlockStart: 32 }}>
        <summary><L en="Certificate history" ar="سجل الشهادات" /></summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 40 }}>
          {certificates.length ? certificates.map((c) => (
            <Link key={c.version} href={`/venues/${id}/certificate?version=${c.version}`} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', color: 'var(--ink)' }}>
              <span style={{ fontSize: '14.5px' }}><L en={`Certificate ${c.version}`} ar={`الشهادة ${c.version}`} /></span>
              <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{c.effective} — {c.valid_until}</span>
            </Link>
          )) : (
            <div style={{ background: 'var(--bg)', padding: '16px 20px', fontSize: '14.5px', color: 'var(--muted)' }}><L en="No certificate issued yet." ar="لم تصدر شهادة بعد." /></div>
          )}
        </div>
      </details>
    </VenueWorkspace>
  );
}
