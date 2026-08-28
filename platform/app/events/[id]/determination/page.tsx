import { notFound, redirect } from 'next/navigation';
import { GovernmentBand } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { PrintButton } from '../../../../components/PrintButton';
import { currentAccount } from '../../../../lib/auth';
import { eventFor, standingDeterminationFor, assessmentsFor } from '../../../../lib/queries';
import { MINISTRY_CONTENT } from '../../../../lib/rules';

/**
 * THE DOCUMENT THE ORGANIZER HANDS TO THE AUTHORISING AUTHORITY.
 *
 * A determination was recorded, the organizer was notified, and there was nothing on
 * their side they could print. The reference number, the event, the level, the
 * determination in its exact wording, who recorded it and when — on one page, with no
 * navigation, no controls and no colour that will not survive a monochrome printer.
 *
 * IT STATES WHAT IT IS NOT. A Ministry determination on health and medical
 * preparedness is not authorization of the event, and a document that travels to
 * another authority has to carry that limit on its own face rather than rely on the
 * screen it came from.
 *
 * The wording of the outcome is verbatim from the compliance form: the three outcomes
 * are the only determinations there are, and the vocabulary the Ministry does not use
 * is not reproduced here either -- the banned-terms sweep caught this comment naming
 * one of the forbidden words to say it is forbidden, which is the sweep working.
 */
export default async function DeterminationCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  // No determination, no certificate. Not an empty page with headings: the record
  // screen says where the submission stands, and this exists only once something does.
  const standing = standingDeterminationFor(id);
  if (!standing) notFound();

  const level = assessmentsFor(account.id, id)[0]?.derivation.finalLevel ?? event.level;
  const C = MINISTRY_CONTENT.certificate;
  const outcome = MINISTRY_CONTENT.outcomes.find((o) => o.key === standing.outcome);

  const row = (
    labelEn: string,
    labelAr: string,
    valueEn: string,
    valueAr: string,
  ): React.ReactElement => (
    <div key={labelEn} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingBlock: 12, borderBlockEnd: '1px solid var(--line)' }}>
      <div style={{ flex: '0 0 220px', fontSize: '12.5px', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        <L en={labelEn} ar={labelAr} />
      </div>
      <div style={{ flex: 1, minWidth: 240, fontSize: '15.5px', lineHeight: 1.55 }}>
        <L en={valueEn} ar={valueAr} />
      </div>
    </div>
  );

  return (
    <>
      <GovernmentBand />
      <main data-pad="" data-region="certificate" style={{ maxWidth: 820, marginInline: 'auto', padding: '48px 32px 120px' }}>
        <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
          <L en={C.titleEn} ar={C.titleAr} />
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '70ch' }}>
          <L en={C.introEn} ar={C.introAr} />
        </p>

        <div style={{ borderBlockStart: '1px solid var(--line)', marginBlockEnd: 24 }}>
          {row(C.refLabelEn, C.refLabelAr, event.mophReference ?? '—', event.mophReference ?? '—')}
          {row(C.eventLabelEn, C.eventLabelAr, event.nameEn, event.nameAr)}
          {row(
            C.levelLabelEn,
            C.levelLabelAr,
            level === null ? '—' : `Level ${level}`,
            level === null ? '—' : `المستوى ${level}`,
          )}
          {row(
            C.outcomeLabelEn,
            C.outcomeLabelAr,
            outcome?.en ?? standing.outcome,
            outcome?.ar ?? standing.outcome,
          )}
          {row(C.byLabelEn, C.byLabelAr, standing.recordedBy, standing.recordedBy)}
          {row(C.dateLabelEn, C.dateLabelAr, standing.recordedAt, standing.recordedAt)}
        </div>

        {standing.note ? (
          <div style={{ padding: '16px 20px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 24, fontSize: '14px', lineHeight: 1.7, maxWidth: '76ch' }}>
            {standing.note}
          </div>
        ) : null}

        {/* A revision is visible on the certificate too: a document that silently
            reflected the second determination would let the first disappear. */}
        {standing.supersedes !== null ? (
          <div data-region="certificate-revised" style={{ padding: '14px 18px', border: '1px solid var(--accent)', borderRadius: 10, marginBlockEnd: 24, fontSize: '13.5px', lineHeight: 1.65, maxWidth: '76ch' }}>
            <L en={C.revisedNoteEn} ar={C.revisedNoteAr} />
          </div>
        ) : null}

        <div style={{ padding: '18px 22px', border: '2px solid var(--ink)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.7, maxWidth: '78ch' }}>
          <L en={C.limitsEn} ar={C.limitsAr} />
        </div>
        <p style={{ margin: '18px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en={C.verifyEn} ar={C.verifyAr} />
        </p>

        {/* Controls, and nothing else on the page that a printer would render. */}
        <div data-region="certificate-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBlockStart: 32 }}>
          <PrintButton en={C.printEn} ar={C.printAr} />
          <a
            href={`/events/${id}`}
            style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', borderRadius: 22, fontSize: 14, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
          >
            <L en="Back to the event record" ar="العودة إلى سجل الفعالية" />
          </a>
        </div>
      </main>
    </>
  );
}
