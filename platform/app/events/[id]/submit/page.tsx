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
  venueRouteFor,
} from '../../../../lib/queries';
import { submissionGateFor } from '../../../../lib/submission-facts';
import { COMPLIANCE_DECLARATIONS, COMPLIANCE_CERTIFICATION_DIVERGENCE, COMPLIANCE_CERTIFICATION_STATEMENT, COMPLIANCE_HEADER, documentsForLevel, type Level } from '../../../../lib/rules';

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
  const documents = documentsForLevel(level).filter((d) => !d.optional);
  const providers = invitationsFor(account.id, id).filter((i) => i.kind === 'ems');
  const signedCount = providers.filter((p) => p.declaration === 'signed').length;

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
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-region="package-docs" style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Submission package" ar="حزمة التقديم" />
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6 }}>
            {/* Verbatim from the reference, lowercase "the" included -- copy is final. */}
            <L
              en={`Level ${level} requires the documents below. the compliance and submission form is completed here, not attached.`}
              ar={`يستوجب المستوى ${level} المستندات أدناه. يُستكمل نموذج الامتثال والتقديم هنا ولا يُرفَق.`}
            />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '15px 21px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 32, fontSize: '14.5px', color: 'var(--muted)', maxWidth: '74ch' }}>
            <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
              <L en="Required" ar="مطلوب" />
            </span>
            <span style={{ lineHeight: 1.6 }}>
              <L
                en="Every field is required unless marked optional. the compliance and submission form cannot be certified while any declaration item is unticked or any required attachment is missing."
                ar="كل حقل مطلوب إلا ما وُسم اختيارياً. لا يمكن التصديق على نموذج الامتثال والتقديم وأي بند إقرار غير مؤشَّر أو أي مرفق مطلوب ناقص."
              />
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 44 }}>
            {documents.map((d) => {
              const done = documentState[d.key] === true;
              const color = done ? 'var(--brand)' : d.thirdParty ? 'var(--bad)' : d.system ? 'var(--muted)' : 'var(--accent-ink)';
              const chipBg = done ? 'var(--brand-soft)' : d.thirdParty ? 'var(--bad-soft)' : 'var(--accent-soft)';
              return (
                <div key={d.key} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px ${d.thirdParty ? 'dashed' : 'solid'} ${color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>
                    <L en={d.en} ar={d.ar} />
                  </span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 'none' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: chipBg, color, fontSize: 13 }}>
                      {done ? (
                        <L en="Complete" ar="مكتمل" />
                      ) : d.thirdParty ? (
                        <L en={`${signedCount} of ${providers.length} signed`} ar={`وُقّع ${signedCount} من ${providers.length}`} />
                      ) : d.system ? (
                        <L en="Generated" ar="مُنشأ" />
                      ) : (
                        <L en="Awaiting you" ar="بانتظاركم" />
                      )}
                    </span>
                    {/* "Awaiting you" without the control that answers it is a corridor:
                        each incomplete row links to where it completes. */}
                    {!done && !d.system && !d.thirdParty ? (
                      <a
                        href={d.key === 'plan' ? `/events/${id}/plan` : d.key === 'complianceForm' ? '#compliance' : `/events/${id}/requirements`}
                        style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
                      >
                        {d.key === 'plan' ? (
                          <L en="Open the plan" ar="فتح الخطة" />
                        ) : d.key === 'complianceForm' ? (
                          <L en="Complete it below" ar="أكملوه أدناه" />
                        ) : (
                          <L en="Attach on the requirements screen" ar="الإرفاق في شاشة المتطلبات" />
                        )}
                      </a>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        <div style={{ maxWidth: 900 }}>
          <h2 style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Compliance and submission" ar="الامتثال والتقديم" />
          </h2>
        </div>

        <SubmitForm
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
          telephoneDivergence={COMPLIANCE_CERTIFICATION_DIVERGENCE}
          certificationStatement={COMPLIANCE_CERTIFICATION_STATEMENT}
          headerRows={headerRows}
        />

      </main>
    </>
  );
}
