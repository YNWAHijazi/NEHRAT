import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { SubmitForm } from './SubmitForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
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
import { COMPLIANCE_DECLARATIONS, COMPLIANCE_HEADER, documentsForLevel, type Level } from '../../../../lib/rules';

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
  const headerValue: Record<string, string> = {
    eventName: event.nameEn,
    organizer: organization?.nameEn ?? '—',
    dates: event.startDate === event.endDate ? (event.startDate ?? '—') : `${event.startDate} — ${event.endDate}`,
    venueRoute: venueRoute || '—',
    finalLevel: `Level ${level}`,
    submissionDate: submission?.filedAt?.slice(0, 10) ?? '—',
    mophReference: event.mophReference ?? '—',
    planVersion: plan ? String(plan.version) : '—',
  };
  const headerRows = COMPLIANCE_HEADER.map((h) => ({ en: h.en, ar: h.ar, value: headerValue[h.key] ?? '—' }));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '14px 20px', border: '1px solid var(--line)', borderRadius: 10, marginBlockEnd: 32, fontSize: '14.5px', color: 'var(--muted)', maxWidth: '74ch' }}>
            <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
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
                <div key={d.key} style={{ padding: '18px 22px', border: '1px solid var(--line)', borderInlineStart: `3px ${d.thirdParty ? 'dashed' : 'solid'} ${color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>
                    <L en={d.en} ar={d.ar} />
                  </span>
                  <span style={{ padding: '4px 10px', borderRadius: 4, background: chipBg, color, fontSize: 13 }}>
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
          blockers={gate.blockers}
          expedited={gate.expedited}
          revisionOpen={event.filed && revisionOpenFor(id)}
          headerRows={headerRows}
        />

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${id}/acknowledgment`,
              en: 'Acknowledgment',
              ar: 'إشعار الاستلام',
              descEn: 'The Ministry reference number. Give it to the authorising authority.',
              descAr: 'الرقم المرجعي للوزارة. قدّموه إلى السلطة المرخِّصة.',
              primary: true,
            },
            {
              href: `/events/${id}/requirements`,
              en: 'Requirements and attachments',
              ar: 'المتطلبات والمرفقات',
              descEn: 'Documents, named providers, requirements you certify to, inspections.',
              descAr: 'المستندات والمزوّدون المُسمّون والمتطلبات التي تصدّقون عليها والتفتيش.',
            },
          ]}
        />
      </main>
    </>
  );
}
