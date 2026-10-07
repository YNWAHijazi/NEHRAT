import Link from 'next/link';
import { VenueWorkspace } from '../../../components/VenueWorkspace';
import { NextStepCard } from '../../../components/NextStepCard';
import { StageRail } from '../../../components/StageRail';
import { RecordRequirements } from '../../../components/record/RecordRequirements';
import { VenueFinalReview } from '../../../components/record/VenueFinalReview';
import { actionGrid, actionCell, actionPill, actionPillDisabled, actionReason, gateReason } from '../../../components/RecordActions';
import { L } from '../../../components/L';
import { ownedVenuePage } from '../../../lib/venue/page';
import { venuePackageFacts } from '../../../lib/venue/workspace';
import { getDb } from '../../../lib/db';
import { beirutToday } from '../../../lib/clock';
import { venueReassessmentGate } from '../../../lib/rules';
import { venueNextAction, venueRailStages } from '../../../lib/rules/venue-workflow';
import { venueChangeSinceAssessment } from '../../../lib/queries';
import { renewVenuePackageAction } from '../actions';

/**
 * THE VENUE'S SINGLE RECORD PAGE (owner brief, 2026-10-07): the next step, the certificate,
 * the rail, the record's actions, then the SAME requirement renderer the event page uses --
 * the two summaries, the full-width cards, the final review and Submit -- over one routine
 * operating session. Details, assessment and the medical team keep their own forms,
 * reached from the header's tabs with deliberate edit actions.
 */
export default async function VenueRecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; submitted?: string; upload?: string; doc?: string; saved?: string }> }) {
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
  const contentTypes: Record<string, string | null> = {};
  for (const f of w.files) contentTypes[f.docKey] = null;
  const derived = {
    scheduleEn: `${v.nameEn} · routine operating session · capacity ${v.licensedCapacity ?? '—'}`,
    scheduleAr: `${v.nameAr} · جلسة تشغيل اعتيادية · السعة ${v.licensedCapacity ?? '—'}`,
    contactsEn: [v.responsibleName, ...w.invitations.filter((i) => i.status === 'confirmed').map((i) => `${i.name} (${i.kind === 'ems' ? 'EMS agency' : 'Medical Director'})`)].filter(Boolean).join(' · '),
    contactsAr: [v.responsibleName, ...w.invitations.filter((i) => i.status === 'confirmed').map((i) => `${i.name} (${i.kind === 'ems' ? 'جهة الإسعاف' : 'المدير الطبي'})`)].filter(Boolean).join(' · '),
    organizerPhoneMissing: !v.responsiblePhone,
  };

  return (
    <VenueWorkspace account={account} w={w} active="overview">
      {next ? <NextStepCard step={next} to={next.href.startsWith('#') ? next.href : `/venues/${id}/${next.href}`} /> : null}

      {w.status === 'accepted' ? (
        <div data-region="certificate-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, marginBlockEnd: 32 }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
              <L en="Venue certificate" ar="شهادة الموقع" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45 }}>
              <L en={v.validUntil ? `Valid until ${v.validUntil}` : 'Issued'} ar={v.validUntil ? `صالحة حتى ⁦${v.validUntil}⁩` : 'صادرة'} />
            </div>
          </div>
          <Link href={`/venues/${id}/certificate`} style={{ flex: 'none', height: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
            <L en="Download venue certificate" ar="تنزيل شهادة الموقع" />
          </Link>
        </div>
      ) : null}

      <StageRail titleEn="Venue progress" titleAr="مراحل الموقع" stages={stages} noteEn={`Stage ${stage} of ${stages.length}`} noteAr={`المرحلة ${stage} من ${stages.length}`} />

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
        <span style={actionCell}>
          <Link href="/dashboard" style={actionPill}><L en="Events and post-event reports" ar="الفعاليات وتقارير ما بعد الفعاليات" /></Link>
        </span>
      </div>

      {w.record && w.level !== null ? (
        <div id="req-summary" tabIndex={-1}>
          {!w.editable && w.status !== 'draft' ? (
            <div data-region="submitted-band" style={{ padding: '14px 20px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en={`Submitted on ${w.submittedAt?.slice(0, 10) ?? ''} · submission ${w.revision}. The answers below are the record as the Ministry reads it.`} ar={`قُدِّم في ⁦${w.submittedAt?.slice(0, 10) ?? ''}⁩ · الطلب ${w.revision}. الإجابات أدناه هي السجل كما تقرأه الوزارة.`} />
            </div>
          ) : null}
          <RecordRequirements record={w.record} viewerRole="organizer" viewerConfirmed contentTypes={contentTypes} refusal={q.upload && q.doc ? { key: q.doc, reason: q.upload } : null} derived={derived} listHref={`/venues/${id}/requirements`}
            final={<VenueFinalReview id={id} facts={facts} editable={w.editable} submitted={Boolean(q.submitted)} error={q.error ?? null} />} />
        </div>
      ) : (
        <>
          <div id="req-summary" role="status" style={{ padding: '16px 22px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, fontSize: '14.5px' }}>
            <Link href={`/venues/${id}/assessment`}><L en="Complete the assessment to see the requirements. The level is derived from one routine operating session." ar="أكملوا التقييم للاطلاع على المتطلبات. يُستنتج المستوى من جلسة تشغيل اعتيادية واحدة." /></Link>
          </div>
          {/* Without a level the final review still names the details, the assessment and the fee. */}
          <VenueFinalReview id={id} facts={facts} editable={w.editable} submitted={Boolean(q.submitted)} error={q.error ?? null} />
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
