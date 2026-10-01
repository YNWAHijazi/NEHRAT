import Link from 'next/link';
import { VenueWorkspace } from '../../../components/VenueWorkspace';
import { NextStepCard } from '../../../components/NextStepCard';
import { StageRail } from '../../../components/StageRail';
import { actionGrid, actionCell, actionPill, actionPillDisabled, actionReason, gateReason } from '../../../components/RecordActions';
import { L } from '../../../components/L';
import { ownedVenuePage } from '../../../lib/venue/page';
import { venuePackageFacts } from '../../../lib/venue/workspace';
import { getDb } from '../../../lib/db';
import { beirutToday } from '../../../lib/clock';
import { venueReassessmentGate } from '../../../lib/rules';
import { venueNextAction, venueRailStages, venueSubmissionChecks } from '../../../lib/rules/venue-workflow';
import { venueChangeSinceAssessment } from '../../../lib/queries';
import { renewVenuePackageAction } from '../actions';

/** The venue overview: the next step, the progress rail, the counters and routes, then history -- the event record's order. */
export default async function VenueOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const v = w.venue;
  const facts = venuePackageFacts(w);
  const next = venueNextAction(facts);
  const { stage, stages } = venueRailStages(facts);
  const { requirementsRemaining } = venueSubmissionChecks(facts);
  const pending = facts.pendingInvitations.length;
  const certificates = getDb()
    .prepare('SELECT version, effective, valid_until FROM venue_assessments WHERE venue_id = ? AND certificate_issued = 1 ORDER BY version DESC')
    .all(id) as unknown as { version: number; effective: string; valid_until: string }[];
  const renewal = venueReassessmentGate({ validUntil: v.validUntil, today: beirutToday(), changeReportedSinceAssessment: venueChangeSinceAssessment(account.id, id) });
  const renewalReason = gateReason(renewal);

  return (
    <VenueWorkspace account={account} w={w} active="overview">
      {next ? <NextStepCard step={next} to={`/venues/${id}/${next.href}`} /> : null}

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

      <StageRail
        titleEn="Venue progress"
        titleAr="مراحل الموقع"
        stages={stages}
        noteEn={`Stage ${stage} of ${stages.length}`}
        noteAr={`المرحلة ${stage} من ${stages.length}`}
      />

      {/* The counters and routes, the same row the event record has. */}
      <div data-region="counters" style={{ padding: '18px 0', borderBlockEnd: '1px solid var(--line)', marginBlockEnd: 24, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: pending > 0 ? 'var(--accent-ink)' : 'var(--muted)' }}>{pending}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en="pending responses" ar="ردود معلّقة" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: requirementsRemaining > 0 ? 'var(--accent-ink)' : 'var(--muted)' }}>{requirementsRemaining}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en="remaining requirements" ar="متطلبات متبقية" />
            </div>
          </div>
        </div>
        <div style={actionGrid}>
          <span style={actionCell}>
            <Link href={`/venues/${id}/requirements`} style={actionPill}>
              <L en="Requirements" ar="المتطلبات" />
            </Link>
          </span>
          <span style={actionCell}>
            <Link href={`/venues/${id}/team`} style={actionPill}>
              <L en="Medical team" ar="الفريق الطبي" />
            </Link>
          </span>
          <span style={actionCell}>
            <Link href={`/venues/${id}/change`} style={actionPill}>
              <L en="Report a venue change" ar="الإبلاغ عن تغيير في الموقع" />
            </Link>
          </span>
          {w.status === 'accepted' && !v.archivedAt ? (
            renewal.behaviour === 'enabled' ? (
              <form action={renewVenuePackageAction.bind(null, id)} style={actionCell}>
                <button type="submit" style={{ ...actionPill, cursor: 'pointer' }}>
                  <L en="Renew certificate" ar="تجديد الشهادة" />
                </button>
              </form>
            ) : renewal.behaviour === 'disabled' ? (
              <span style={actionCell}>
                <button type="button" disabled style={actionPillDisabled}>
                  <L en="Renew certificate" ar="تجديد الشهادة" />
                </button>
                <span style={actionReason}>
                  <L en={renewalReason.en} ar={renewalReason.ar} />
                </span>
              </span>
            ) : null
          ) : null}
          <span style={actionCell}>
            <Link href="/dashboard" style={actionPill}>
              <L en="Events and post-event reports" ar="الفعاليات وتقارير ما بعد الفعاليات" />
            </Link>
          </span>
        </div>
      </div>

      <details data-region="history" className="record-details">
        <summary><L en="Certificate history" ar="سجل الشهادات" /></summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 40 }}>
          {certificates.length ? certificates.map((c) => (
            <Link key={c.version} href={`/venues/${id}/certificate?version=${c.version}`} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', color: 'var(--ink)' }}>
              <span style={{ fontSize: '14.5px' }}>
                <L en={`Certificate ${c.version}`} ar={`الشهادة ${c.version}`} />
              </span>
              <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{c.effective} — {c.valid_until}</span>
            </Link>
          )) : (
            <div style={{ background: 'var(--bg)', padding: '16px 20px', fontSize: '14.5px', color: 'var(--muted)' }}>
              <L en="No certificate issued yet." ar="لم تصدر شهادة بعد." />
            </div>
          )}
        </div>
      </details>
    </VenueWorkspace>
  );
}
