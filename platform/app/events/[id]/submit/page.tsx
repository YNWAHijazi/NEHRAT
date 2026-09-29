import type { SubmissionCheck } from '../../../../components/SubmissionChecklist';
import { EventWorkspaceHeader } from '../../../../components/EventWorkspaceHeader';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SubmitForm } from './SubmitForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
  attachmentsFor,
  documentStateFor,
  eventFor,
  invitationsFor,
  revisionOpenFor,
  submissionFor,
  unreadCountFor,
  planFor,
  addedMeasuresFor,
  venueRouteFor,
} from '../../../../lib/queries';
import { submissionGateFor } from '../../../../lib/submission-facts';
import { COMPLIANCE_DECLARATIONS, COMPLIANCE_CERTIFICATION_STATEMENT, COMPLIANCE_HEADER, documentsForLevel, type Level } from '../../../../lib/rules';

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;
  if (level === null) redirect(`/events/${id}`);

  const submission = submissionFor(account.id, id);
  const gate = submissionGateFor(account.id, id);
  const documentState = documentStateFor(account.id, id, level);
  const documents = documentsForLevel(level, addedMeasuresFor(id).some(m => m.catalogKey === 'plan' && !m.clearedAt));
  const providers = invitationsFor(account.id, id).filter((i) => i.kind === 'ems');

  const checks = (optional: boolean): SubmissionCheck[] => documents.filter(d => Boolean(d.optional) === optional && d.key !== 'complianceForm').map(d => ({
    key: d.key, en: d.en, ar: d.ar, done: documentState[d.key] === true,
    href: d.key === 'assessment' ? `/events/${id}/reassess` : d.key === 'plan' ? `/events/${id}/plan` : d.thirdParty ? `/events/${id}/medical-team?tab=ems` : `/events/${id}/requirements#documents`,
  }));
  const requiredChecks = checks(false);
  if (providers.some(p => !['removed', 'withdrawn'].includes(p.status))) requiredChecks.push({ key: 'ems-replies', en: 'EMS invitation replies', ar: 'الردود على دعوات الإسعاف', done: !gate.blockers.some(b => b.kind === 'providerUnanswered'), href: `/events/${id}/requirements#medical-team` });
  if (level === 3) requiredChecks.push({ key: 'director', en: 'Medical Director confirmed', ar: 'تأكيد المدير الطبي', done: !gate.blockers.some(b => ['directorMissing','directorUnanswered'].includes(b.kind)), href: `/events/${id}/requirements#medical-director` });
  if (gate.fee) requiredChecks.push({ key: 'fee', en: 'Application fee', ar: 'رسم الطلب', done: gate.fee.paid, href: '#amount-due' });
  const optionalChecks = checks(true);
  if (level === 2) optionalChecks.push({ key: 'director', en: 'Medical Director', ar: 'المدير الطبي', done: invitationsFor(account.id,id).some(i => i.kind === 'director' && i.status === 'confirmed'), href: `/events/${id}/requirements#medical-director` });

  // The eight header fields the compliance form defines -- from the data, not
  // hand-written: two of eight went missing the last time this was a literal list.
  const plan = planFor(account.id, id);
  const venueRoute = venueRouteFor(account.id, id);
  // Three of these have an Arabic form, and the header used to carry ONE value for both
  // languages -- so the Arabic form header read "Level 3" and the organizer's English
  // name, on a page that is otherwise entirely Arabic (non-negotiable 4).
  const dates =
    event.startDate === event.endDate ? (event.startDate ?? '—') : `${event.startDate} — ${event.endDate}`;
  const headerValue: Record<string, { en: string; ar: string }> = {
    eventName: { en: event.nameEn, ar: event.nameAr },
    organizer: { en: organization?.nameEn ?? '—', ar: organization?.nameAr ?? '—' },
    dates: { en: dates, ar: dates },
    venueRoute: { en: venueRoute || '—', ar: venueRoute || '—' },
    finalLevel: { en: `Level ${level}`, ar: `المستوى ${level}` },
    submissionDate: { en: submission?.filedAt?.slice(0, 10) ?? '—', ar: submission?.filedAt?.slice(0, 10) ?? '—' },
    mophReference: { en: event.mophReference ?? '—', ar: event.mophReference ?? '—' },
    planVersion: { en: plan ? String(plan.version) : '—', ar: plan ? String(plan.version) : '—' },
  };
  const headerRows = COMPLIANCE_HEADER.map((h) => ({
    en: h.en,
    ar: h.ar,
    valueEn: headerValue[h.key]?.en ?? '—',
    valueAr: headerValue[h.key]?.ar ?? '—',
  }));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true}  />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <EventWorkspaceHeader accountId={account.id} event={event} active="submit" />
        <h2 data-sec-h1="" style={{ fontSize: 28, marginBlock: '0 24px' }}><L en="Submission package" ar="حزمة التقديم" /></h2>
        {/* THE AMOUNT DUE, on the package (rendered only while a fee is in
            force -- the capability ships off and this region with it). Between
            complete and filed sits awaiting payment: filing completes when the
            payment is recorded through the payment seam, and no payment channel
            renders here because none is integrated. */}
        {gate.fee ? (
          <div id="amount-due" data-region="amount-due" style={{ maxWidth: 900, padding: '19px 23px', border: `1px solid ${gate.fee.paid ? 'var(--line)' : 'var(--accent-ink)'}`, borderRadius: 12, marginBlockEnd: 44 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                <L en="Application fee" ar="رسم الطلب" />
              </span>
              <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                {gate.fee.paid ? (
                  <L en={`Paid — ${gate.fee.paidAt ?? ''}`} ar={`مسدَّد — ⁦${gate.fee.paidAt ?? ''}⁩`} />
                ) : (
                  <L en={`Amount due: ${gate.fee.amount} ${gate.fee.currency}`} ar={`المبلغ المستحق: ${gate.fee.amount} ${gate.fee.currency}`} />
                )}
              </span>
            </div>
            {gate.awaitingPayment ? (
              <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--accent-ink)', lineHeight: 1.65, maxWidth: '80ch' }}>
                <L
                  en="Your application is ready. Payment must be recorded before it can be submitted."
                  ar="طلبكم جاهز. يجب تسجيل الدفع قبل تقديمه."
                />
              </p>
            ) : null}
            {!gate.fee.paid ? (
              <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '80ch' }}>
                <L
                  en="No payment channel is configured on the platform yet. The Ministry announces how the fee is paid; the record is updated when payment is received."
                  ar="لا قناة سداد مهيّأة على المنصة بعد. تعلن الوزارة كيفية سداد الرسم؛ ويُحدَّث السجل عند استلام السداد."
                />
              </p>
            ) : null}
          </div>
        ) : null}

        <SubmitForm
          requiredChecks={requiredChecks}
          optionalChecks={optionalChecks}
          eventId={id}
          level={level}
          declarations={[...COMPLIANCE_DECLARATIONS]}
          initial={submission}
          attachments={Object.fromEntries(
            attachmentsFor(account.id, id).map((a) => [
              a.docKey,
              { fileName: a.fileName, hasFile: a.hasFile, contentType: a.contentType },
            ]),
          )}
          blockers={gate.blockers}
          expedited={gate.expedited}
          revisionOpen={event.filed && revisionOpenFor(id)}
          certificationStatement={COMPLIANCE_CERTIFICATION_STATEMENT}
          headerRows={headerRows}
        />

      </main>
    </>
  );
}
