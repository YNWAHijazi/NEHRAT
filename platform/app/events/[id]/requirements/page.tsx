import { UploadInput } from '../../../../components/UploadInput';
import { InfoNote } from '../../../../components/InfoNote';
import { EmailDeliveryNotice } from '../../../../components/EmailDeliveryNotice';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { VendorDirectoryLink } from '../../../../components/VendorDirectoryLink';
import { InviteForm } from './InviteForm';
import { InvitationLinkBlock } from './InvitationLinkBlock';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
  attachmentsFor,
  documentStateFor,
  eventFor,
  invitationsFor,
  unreadCountFor,
  governanceFor,
  inspectionsFor,
  addedMeasuresFor,
} from '../../../../lib/queries';
import {
  documentsForLevel,
  levelWhy,
  catalogueEntry,
  certifyRowGroups,
  commandFunctionRow, requirementsForLevel,
  type Level,
} from '../../../../lib/rules';
import { attachDocumentAction, removeAttachmentAction, removeProviderAction, withdrawNominationAction } from '../../../actions';
import { UPLOADS_CONTENT, acceptAttribute, acceptHint } from '../../../../lib/rules/uploads';

/** The three ways an upload is refused, each named. Keyed by the action's reason. */
const UPLOAD_REFUSALS: Record<string, { en: string; ar: string }> = {
  tooLarge: {
    en: UPLOADS_CONTENT.copy.tooLargeEn.replace('{max}', UPLOADS_CONTENT.maxBytesLabel),
    ar: UPLOADS_CONTENT.copy.tooLargeAr.replace('{max}', UPLOADS_CONTENT.maxBytesLabel),
  },
  wrongType: { en: UPLOADS_CONTENT.copy.wrongTypeEn, ar: UPLOADS_CONTENT.copy.wrongTypeAr },
  empty: { en: UPLOADS_CONTENT.copy.emptyEn, ar: UPLOADS_CONTENT.copy.emptyAr },
};

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
};

/**
 * `n` is the group number. The Event Medical Director block passes NONE: it is part of
 * group 2, the parties you name, and giving it its own heading number printed a second
 * "2" beside group 2 at Level 3. Numbering must also not shift with the level -- the
 * Director is absent below Level 3, so a real number here would renumber the groups
 * underneath it for Level 3 organizers only.
 */
function SectionHeading({ n, en, ar, help }: { n?: number; en: string; ar: string; help?: React.ReactNode }) {
  // FIELDS ONLY (partner ruling, 2026-09-04): the group heading is structure;
  // the explanatory note under it was guidance and left for the reference page.
  return (
    <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', display: 'flex', gap: 14, alignItems: 'baseline' }}>
      <span style={{ flex: 'none', fontSize: 16, fontWeight: 500, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }} aria-hidden={n === undefined}>{n}</span>
      <span>
        <L en={en} ar={ar} /> {help ? <InfoNote>{help}</InfoNote> : null}
      </span>
    </h2>
  );
}

export default async function RequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  // A refused upload comes back NAMED: the organizer is told which mistake they
  // made -- too large, wrong type, empty -- never just that something failed.
  // ("Refused", deliberately. The determination vocabulary is reserved, and the
  // banned-terms sweep caught the other word here as a local identifier and again
  // in the comment explaining the rename -- which is the sweep working.)
  const q = await searchParams;
  const refusal = typeof q['upload'] === 'string' ? q['upload'] : null;
  const refusedDoc = typeof q['doc'] === 'string' ? q['doc'] : null;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;

  if (level === null) {
    // No level, no requirements: the assessment is the way in.
    redirect(`/events/${id}`);
  }

  const comparison = versions[0] ? levelWhy(versions[0].derivation).comparison : null;
  const documentState = documentStateFor(account.id, id, level);
  // Only organizer uploads and the plan belong here. Generated records, provider
  // declarations, and final certification live in their respective sections.
  const documents = documentsForLevel(level)
    .filter((doc) => doc.attach || doc.key === 'plan')
    .sort((a, b) => {
      const completeOrOptional = (d: { key: string; optional?: boolean }) =>
        documentState[d.key] === true || d.optional === true ? 1 : 0;
      return completeOrOptional(a) - completeOrOptional(b);
    });
  const firstOpenDocument = documents.find((doc) => !(level === 3 && ['plan','deploymentMap'].includes(doc.key)) && !doc.optional && documentState[doc.key] !== true)?.key;
  const attachments = attachmentsFor(account.id, id);
  const fileNames = Object.fromEntries(attachments.map((a) => [a.docKey, a.fileName]));
  const invitations = invitationsFor(account.id, id);
  const providers = invitations.filter((i) => i.kind === 'ems');
  // Ministry-required measures land HERE -- the screen their notification links to.
  // Until this panel existed the link arrived on a page that never mentioned them.
  const ministryMeasures = addedMeasuresFor(id).filter((m) => !m.clearedAt);
  // The ACTIVE director: a declined, withdrawn or removed one is history, and
  // history must not hide the invite form -- a declined director with no way to
  // name a replacement was a dead end.
  const directorRows = invitations.filter((i) => i.kind === 'director');
  const director =
    directorRows.find((i) => i.status === 'nominated' || i.status === 'confirmed') ?? null;
  const pastDirectors = directorRows.filter(
    (i) => i.status === 'declined' || i.status === 'withdrawn' || i.status === 'removed',
  );


  // Group 3: the certify-to rows -- everything the matrix carries at this level that is
  // neither an attached document nor a named-party row. Requirement 15 (the command
  // function) renders in the Director block instead, Level 3 only.
  // The reference lists every applicable row here, attachable ones included -- their
  // documents live in group 1; this list is the certification view of the whole matrix.
  const certifyRows = requirementsForLevel(level).filter((r) => r.n !== 15 || level !== 3);
  const certifyGroups = certifyRowGroups(certifyRows);
  const commandRow = commandFunctionRow(level);
  const inspections = inspectionsFor(id);
  const governance = governanceFor(id);

  const partChip = {
    nominated: { en: 'Nominated', ar: 'مُسمّاة', bg: 'var(--surface2)', color: 'var(--muted)', noteEn: 'Has not answered yet', noteAr: 'لم تُجب بعد' },
    confirmed: { en: 'Confirmed', ar: 'مؤكِّدة', bg: 'var(--brand-soft)', color: 'var(--brand)', noteEn: 'Accepted and operational detail supplied', noteAr: 'قبلت وقدّمت التفاصيل التشغيلية' },
    declined: { en: 'Declined', ar: 'معتذرة', bg: 'var(--bad-soft)', color: 'var(--bad)', noteEn: 'A material change you must notify to the Ministry', noteAr: 'تغيير جوهري عليكم إبلاغ الوزارة به' },
    withdrawn: { en: 'Withdrawn', ar: 'مسحوبة', bg: 'var(--surface)', color: 'var(--muted)', noteEn: 'Invitation withdrawn', noteAr: 'سُحبت الدعوة' },
    removed: { en: 'Removed', ar: 'مُزالة', bg: 'var(--surface)', color: 'var(--muted)', noteEn: 'You removed this confirmed party — a material change', noteAr: 'أزلتم هذا الطرف المؤكَّد — تغيير جوهري' },
  } as const;
  const declChip = {
    none: { en: 'No declaration', ar: 'لا إقرار', bg: 'var(--surface2)', color: 'var(--muted)' },
    draft: { en: 'Declaration — draft', ar: 'الإقرار — مسودة', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    signed: { en: 'Declaration — signed', ar: 'الإقرار — موقّع', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  } as const;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en={`${event.nameEn} · ${event.id} · Level ${level}`} ar={`${event.nameAr} · ${event.id} · المستوى ${level}`} />
          {comparison ? <span data-region="derivation"><InfoNote labelEn="How the level is calculated" labelAr="كيفية احتساب المستوى"><L en={comparison.en} ar={comparison.ar} /></InfoNote></span> : null}
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 14px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Requirements and attachments" ar="المتطلبات والمرفقات" />
         <InfoNote><L
            en="Add your documents, invite your medical team, then review your submission."
            ar="أضيفوا مستنداتكم، وادعوا فريقكم الطبي، ثم راجعوا ملف التقديم."
          /></InfoNote>
</h1>



        <EmailDeliveryNotice status={typeof q.mail === 'string' ? q.mail : undefined} />
        <nav data-region="preparation-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBlockEnd: 32 }}>
          {[
            { href: '#documents', en: level === 1 ? '1. Documents' : '1. Documents and plan', ar: level === 1 ? '١. المستندات' : '١. المستندات والخطة' },
            { href: '#medical-team', en: '2. Medical team', ar: '٢. الفريق الطبي' },
            { href: '#review', en: '3. Review and submit', ar: '٣. المراجعة والتقديم' },
          ].map((item) => (
            <a key={item.href} href={item.href} style={{ padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 14 }}>
              <L en={item.en} ar={item.ar} />
            </a>
          ))}
        </nav>

        {ministryMeasures.length > 0 ? (
          <div data-region="ministry-measures" style={{ marginBlockEnd: 40 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 10 }}>
              <L en="Required by the Ministry" ar="مطلوب من الوزارة" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ministryMeasures.map((m) => {
                const doc = catalogueEntry(m.catalogKey);
                return (
                  <div key={m.id} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--accent-soft)', borderInlineStart: '3px solid var(--accent)', borderRadius: 10 }}>
                    <div style={{ fontSize: '14.5px', lineHeight: 1.5, marginBlockEnd: m.note ? 4 : 0 }}>
                      {doc ? <L en={doc.en} ar={doc.ar} /> : m.catalogKey}
                      {m.blocking ? (
                        <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '1px 7px', border: '1px solid var(--accent)', borderRadius: 999, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                          <L en="Blocks the satisfied outcome" ar="يحجب نتيجة الاستيفاء" />
                        </span>
                      ) : null}
                    </div>
                    {m.note ? (
                      <div style={{ fontSize: '13px', color: 'var(--accent-ink)', lineHeight: 1.55 }}>{m.note}</div>
                    ) : null}
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 6, lineHeight: 1.55 }}>
                      <L
                        en={`Required ${m.recordedAt} by ${m.recordedBy}. Attach or revise the named document below; the Ministry clears the requirement on review.`}
                        ar={`طُلب في ⁦${m.recordedAt}⁩ من ${m.recordedBy}. أرفقوا المستند المُسمّى أدناه أو نقّحوه؛ وتُقفل الوزارة المتطلب عند المراجعة.`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Group 1 — Documents to attach */}
        <div data-region="g1" id="documents" style={{ scrollMarginBlockStart: 24 }}>
        <SectionHeading
          n={1}
          en={level === 1 ? "Documents" : "Documents and plan"}
          ar={level === 1 ? "المستندات" : "المستندات والخطة"}
          help={<L en={acceptHint().en} ar={acceptHint().ar} />}
        />

        {refusal ? (
          <div
            data-region="upload-refused"
            style={{ padding: '14px 18px', background: 'var(--bad-soft)', border: '2px solid var(--bad)', borderRadius: 12, marginBlockEnd: 14, fontSize: 14, lineHeight: 1.6, maxWidth: '78ch' }}
          >
            <L
              en={UPLOAD_REFUSALS[refusal]?.en ?? UPLOAD_REFUSALS['wrongType']!.en}
              ar={UPLOAD_REFUSALS[refusal]?.ar ?? UPLOAD_REFUSALS['wrongType']!.ar}
            />
            {refusedDoc && catalogueEntry(refusedDoc) ? (
              <div style={{ marginBlockStart: 4, fontSize: '12.5px' }}>
                <L en={catalogueEntry(refusedDoc)!.en} ar={catalogueEntry(refusedDoc)!.ar} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 52 }}>
          {documents.map((doc) => {
            const done = documentState[doc.key] === true;
            const medicalMap = doc.key === 'deploymentMap' && level === 3;
            const medicalPlan = doc.key === 'plan' && level === 3;
            const color = done ? 'var(--success)' : doc.optional ? 'var(--muted)' : 'var(--accent-ink)';
            const chipBg = done ? 'var(--success-soft)' : doc.optional ? 'var(--surface2)' : 'var(--accent-soft)';
            const stateEn = done ? 'Complete' : doc.optional ? 'Optional' : 'Pending';
            const stateAr = done ? 'مكتمل' : doc.optional ? 'اختياري' : 'قيد الانتظار';
            const fileNoteEn = fileNames[doc.key];
            const fileNoteAr = fileNames[doc.key];
            return (
              <details className="requirement-card" id={`requirement-${doc.key}`} name="event-documents" key={doc.key} open={doc.key === firstOpenDocument} data-document={doc.key} style={{ borderInlineStartColor: color }}>
                <summary className="requirement-summary">
                <div className="requirement-title">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginBlockStart: 3 }}>
                    <path d="M6.5 4h8l3.5 3.5V20h-11.5z" />
                    <path d="M9.5 11.5h6M9.5 15.5h4" />
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                      <L en={doc.en} ar={doc.ar} />
                    </div>
                    {fileNoteEn && fileNoteAr ? (
                      <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                        <L en={fileNoteEn} ar={fileNoteAr} />
                      </div>
                    ) : null}
                  </div>
                </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: chipBg, color, fontSize: 13, flexShrink: 0 }}>
                    <L en={stateEn} ar={stateAr} />
                  </span>
                </summary>
                <div className="requirement-body">
                  {medicalPlan ? <p><L en="Completed by the Medical Director or EMS agency." ar="يستكملها المدير الطبي أو جهة الإسعاف."/></p>:null}
                  {medicalMap ? <p><L en="Uploaded by the Event Medical Director." ar="يرفعها المدير الطبي للفعالية." /></p> : null}
                  {doc.platform ? (
                    <a
                      href={doc.key === 'plan' ? `/events/${id}/plan` : `/events/${id}/submit`}
                      className="requirement-action"
                    >
                      {doc.key === 'plan' ? <L en={medicalPlan?'View plan':'Open the plan'} ar={medicalPlan?'عرض الخطة':'فتح الخطة'} /> : <L en="Open the form" ar="فتح النموذج" />}
                    </a>
                  ) : null}
                  {doc.attach && !medicalMap && !done ? (
                    <form
                      action={attachDocumentAction.bind(null, id)}
                      className="requirement-upload"
                    >
                      <input type="hidden" name="docKey" value={doc.key} />
                      <UploadInput

                        name="file"
                        required
                        accept={acceptAttribute()}
                        aria-label="Attach the document"
                        className="requirement-file"
                      />
                      <button type="submit" className="requirement-action">
                        <L en="Attach" ar="إرفاق" />
                      </button>
                    </form>
                  ) : null}
                  {/* An attached document can be REPLACED (the revision loop the change
                      screen promises) and, while nothing is filed, REMOVED. After
                      filing, removal would falsify the filed record -- replacing is
                      the honest correction, so only Replace remains. */}
                  {doc.attach && !medicalMap && done ? (
                    <details>
                      <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: 'var(--muted)', listStyle: 'none' }}>
                        <span style={{ textDecoration: 'underline' }}>
                          <L en="Replace or remove" ar="استبدال أو إزالة" />
                        </span>
                      </summary>
                      <div className="requirement-replace">
                        <form action={attachDocumentAction.bind(null, id)} className="requirement-upload">
                          <input type="hidden" name="docKey" value={doc.key} />
                          <UploadInput name="file" required accept={acceptAttribute()} aria-label="Replace the document" className="requirement-file" />
                          <button type="submit" className="requirement-action">
                            <L en="Replace" ar="استبدال" />
                          </button>
                        </form>
                        {!event.filed ? (
                          <form action={removeAttachmentAction.bind(null, id)}>
                            <input type="hidden" name="docKey" value={doc.key} />
                            <button type="submit" className="requirement-action">
                              <L en="Remove" ar="إزالة" />
                            </button>
                          </form>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            <L en="To change a submitted document, upload a replacement." ar="لتغيير مستند سبق تقديمه، ارفعوا مستنداً بديلاً." />
                          </span>
                        )}
                      </div>
                    </details>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
        </div>

        {/* Group 2 — Named EMS providers, and the invitation that belongs here (SPEC 5c) */}
        <div data-region="g2" id="medical-team" style={{ scrollMarginBlockStart: 24 }}>
        <SectionHeading
          n={2}
          en="Event EMS Agencies"
          ar="جهات الإسعاف في الفعالية"
        />
        {level === 3 ? (
          <InfoNote>
            <L en="Each participating EMS provider completes their own readiness declaration. Track their response and signature below."
              ar="يستكمل كل مزوّد إسعاف مشارك إقرار الجاهزية الخاص به. تابعوا الردّ والتوقيع أدناه." />
          </InfoNote>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
          {providers.map((p) => {
            const part = partChip[p.status];
            const decl = declChip[p.declaration];
            const edge = p.status === 'confirmed' ? 'solid' : 'dashed';
            const closed = p.status === 'withdrawn' || p.status === 'removed';
            const color = closed
              ? 'var(--line)'
              : p.status === 'declined'
                ? 'var(--bad)'
                : p.status === 'nominated'
                  ? 'var(--accent-ink)'
                  : 'var(--brand)';
            return (
              <div key={p.token} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px ${edge} ${color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                    <L en={p.nameEn} ar={p.nameAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    {p.status === 'declined' && !event.filed ? (
                      // Nothing is filed: no change report is owed on a decline --
                      // the fixed chip note claimed one regardless, wrongly.
                      <L en="Invitation declined. Invite a replacement." ar="رُفضت الدعوة. ادعوا بديلاً." />
                    ) : (
                      <L en={part.noteEn} ar={part.noteAr} />
                    )}
                  </div>
                  {p.status === 'nominated' && p.responseNote ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--accent-ink)', marginBlockStart: 6, lineHeight: 1.55 }}>
                      <L
                        en={`Modification requested, as written: “${p.responseNote}”. The nomination stays open — answer by adjusting the event, or withdraw and renominate.`}
                        ar={`طُلب تعديل، كما كُتب: «${p.responseNote}». يبقى الترشيح قائماً — أجيبوا بتعديل الفعالية، أو اسحبوا ورشّحوا من جديد.`}
                      />
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 'none' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: part.bg, color: part.color, fontSize: 13 }}>
                    <L en={part.en} ar={part.ar} />
                  </span>
                  {level === 3 ? (
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: decl.bg, color: decl.color, fontSize: 13 }}>
                      <L en={decl.en} ar={decl.ar} />
                    </span>
                  ) : null}
                </div>
                {p.status === 'nominated' ? <InvitationLinkBlock token={p.token} /> : null}
                {p.status === 'nominated' ? (
                  <form action={withdrawNominationAction.bind(null, id)} style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <input type="hidden" name="token" value={p.token} />
                    <button type="submit" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', cursor: 'pointer' }}>
                      <L en="Withdraw the nomination" ar="سحب الترشيح" />
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      <L en="This disables the invitation link." ar="سيتوقف رابط الدعوة عن العمل." />
                    </span>
                  </form>
                ) : null}
                {p.status === 'confirmed' ? (
                  <details style={{ flexBasis: '100%' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: 'var(--muted)', listStyle: 'none' }}>
                      <span style={{ textDecoration: 'underline' }}>
                        <L en="Remove this provider" ar="إزالة هذا المزوّد" />
                      </span>
                    </summary>
                    <form action={removeProviderAction.bind(null, id)} style={{ marginBlockStart: 10, padding: '12px 16px', background: 'var(--accent-soft)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <input type="hidden" name="token" value={p.token} />
                      <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.55 }}>
                        {event.filed ? (
                          <L en="This person will be notified. Since you already submitted the application, report this change to the Ministry too." ar="سيُبلَّغ هذا الطرف. بما أنكم قدّمتم الطلب، أبلغوا الوزارة بهذا التغيير أيضاً." />
                        ) : (
                          <L en="The party will be notified when removed." ar="سيُبلَّغ الطرف عند إزالته." />
                        )}
                      </span>
                      <button type="submit" style={{ flex: 'none', height: 34, paddingInline: 14, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                        <L en="Remove — a material change" ar="إزالة — تغيير جوهري" />
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
        </div>
        <div data-region="invite">
          <InviteForm eventId={id} kind="ems" />
        </div>
        <div style={{ marginBlockEnd: 52 }} />

        {/* The Event Medical Director: Level 3 only. Below Level 3 this block is ABSENT. */}
        {level === 3 && commandRow ? (
          <>
            <SectionHeading
              en="Event Medical Director"
              ar="المدير الطبي للفعالية"
            />
            {director ? (
              <div style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px solid ${director.status === 'confirmed' ? 'var(--brand)' : director.status === 'declined' ? 'var(--bad)' : 'var(--accent-ink)'}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 20 }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                    <L en={director.nameEn} ar={director.nameAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    <L en={commandRow.en} ar={commandRow.ar} />
                    {' · '}
                    <L en={commandRow.respEn} ar={commandRow.respAr} />
                  </div>
                  {governance['command']?.trim() ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--brand)', marginBlockStart: 6 }}>
                      <L en="Medical-command arrangements added to the plan." ar="أُضيفت ترتيبات القيادة الطبية إلى الخطة." />
                    </div>
                  ) : null}
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: partChip[director.status].bg, color: partChip[director.status].color, fontSize: 13 }}>
                  <L en={partChip[director.status].en} ar={partChip[director.status].ar} />
                </span>
                {director.status === 'nominated' ? <InvitationLinkBlock token={director.token} /> : null}
                {director.status === 'nominated' ? (
                  <form action={withdrawNominationAction.bind(null, id)} style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <input type="hidden" name="token" value={director.token} />
                    <button type="submit" style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', cursor: 'pointer' }}>
                      <L en="Withdraw the nomination" ar="سحب الترشيح" />
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      <L en="This disables the invitation link." ar="سيتوقف رابط الدعوة عن العمل." />
                    </span>
                  </form>
                ) : null}
                {director.status === 'confirmed' ? (
                  <details style={{ flexBasis: '100%' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '12.5px', color: 'var(--muted)', listStyle: 'none' }}>
                      <span style={{ textDecoration: 'underline' }}>
                        <L en="Remove the Event Medical Director" ar="إزالة المدير الطبي للفعالية" />
                      </span>
                    </summary>
                    <form action={removeProviderAction.bind(null, id)} style={{ marginBlockStart: 10, padding: '12px 16px', background: 'var(--accent-soft)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <input type="hidden" name="token" value={director.token} />
                      <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.55 }}>
                        {event.filed ? (
                          <L en="The Medical Director will be notified. Report this change to the Ministry and confirm a new Director before submitting the Level 3 application again." ar="سيُبلَّغ المدير الطبي. أبلغوا الوزارة بالتغيير وأكّدوا مديراً طبياً جديداً قبل إعادة تقديم طلب المستوى 3." />
                        ) : (
                          <L en="Removing the confirmed Director is a material change: they will be notified. The Level 3 package cannot be filed without a Director." ar="إزالة المدير المؤكَّد تغيير جوهري: سيُبلَّغ. ولا يمكن تقديم ملف المستوى 3 دون مدير." />
                        )}
                      </span>
                      <button type="submit" style={{ flex: 'none', height: 34, paddingInline: 14, border: '1px solid var(--accent)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', color: 'var(--accent-ink)', cursor: 'pointer' }}>
                        <L en="Remove — a material change" ar="إزالة — تغيير جوهري" />
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            ) : (
              <InviteForm eventId={id} kind="director" />
            )}
            {pastDirectors.map((d) => (
              <div key={d.token} style={{ padding: '12px 18px', background: 'var(--surface)', borderInlineStart: '3px dashed var(--line)', borderRadius: 10, marginBlockStart: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: 'var(--muted)' }}>
                <span><L en={d.nameEn} ar={d.nameAr} /></span>
                <span style={{ padding: '3px 9px', borderRadius: 999, background: partChip[d.status].bg, color: partChip[d.status].color, fontSize: 12 }}>
                  <L en={partChip[d.status].en} ar={partChip[d.status].ar} />
                </span>
              </div>
            ))}
            <div style={{ marginBlockEnd: 52 }} />
          </>
        ) : null}

        <section id="review" data-region="review-submission" style={{ scrollMarginBlockStart: 24, padding: 24, background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 32 }}>
          <SectionHeading n={3} en="Review and submit" ar="المراجعة والتقديم" />
          <InfoNote>
            <L en="Your risk assessment is included automatically. Review the package and complete your declarations. You can save your progress while waiting for others."
              ar="يُدرَج تقييم المخاطر تلقائياً. راجعوا الملف وأكملوا إقراراتكم. يمكنكم حفظ تقدّمكم أثناء انتظار الآخرين." />
          </InfoNote>
          <a href={`/events/${id}/submit`} style={{ display: 'inline-flex', padding: '12px 20px', borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15 }}>
            <L en="Review submission" ar="مراجعة ملف التقديم" />
          </a>
        </section>

        {/* Group 3 — Requirements you certify to */}
        {/* Groups 3 and 4 are not the organizer's work: one is reading, the other is
            somebody visiting them. Both collapse to a header with a derived count, so
            the two groups that ARE work are what the page leads with. */}
        <details data-region="g3" style={{ marginBlockEnd: 20 }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline', paddingBlock: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Final checklist" ar="القائمة النهائية" />
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              <L
                en={`${certifyRows.length} requirements to review`}
                ar={`${certifyRows.length} متطلباً للمراجعة`}
              />
            </span>
            <span style={{ marginInlineStart: 'auto', fontSize: 14, color: 'var(--brand)' }}>
              <L en="Read them" ar="قراءتها" />
            </span>
          </summary>
          <div className="secondary-help"><InfoNote><L
              en="Confirm these items when you submit your application."
              ar="أكّدوا هذه البنود عند تقديم طلبكم."
            /></InfoNote></div>
          {[
            {
              rows: certifyGroups.everyLevel,
              en: 'Required at every level',
              ar: 'مطلوبة في كل المستويات',
              countEn: `${certifyGroups.everyLevel.length} apply at every level`,
              countAr: `${certifyGroups.everyLevel.length} تنطبق في كل المستويات`,
              tone: 'var(--muted)',
            },
            {
              rows: certifyGroups.addedOrRaised,
              en: `Added or raised at Level ${level}`,
              ar: `أُضيفت أو رُفعت في المستوى ${level}`,
              countEn: `${certifyGroups.addedOrRaised.length} begin or increase at Level ${level}`,
              countAr: `${certifyGroups.addedOrRaised.length} تبدأ أو تزيد في المستوى ${level}`,
              tone: 'var(--accent-ink)',
            },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <div key={g.en} style={{ marginBlockEnd: 28 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', marginBlockEnd: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>
                    <L en={g.en} ar={g.ar} />
                  </span>
                  <span style={{ fontSize: '13.5px', color: g.tone }}>
                    <L en={g.countEn} ar={g.countAr} />
                  </span>
                </div>
                {/* A plain hairline table: requirement, value, responsible party. No
                    edge, dot or chip -- those are the vocabulary of the actionable
                    groups, and using them here made a read-only list look like work. */}
                <div style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', padding: 1 }}>
                  {g.rows.map((r, i) => (
                    <div
                      key={r.n}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: '14px 18px',
                        borderBlockStart: i === 0 ? '0' : '1px solid var(--line)',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 260 }}>
                        <span style={{ display: 'block', fontSize: '15.5px', lineHeight: 1.45 }}>
                          <L en={r.en} ar={r.ar} />
                        </span>
                        <span style={{ display: 'block', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 2 }}>
                          <L en={r.valueEn} ar={r.valueAr} />
                        </span>
                      </span>
                      <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, textAlign: 'end' }}>
                        <L en={r.respEn} ar={r.respAr} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </details>

        <details data-region="inspections" style={{ marginBlockEnd: 44 }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline', paddingBlock: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="Inspections and visits" ar="التفتيش والزيارات" />
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              {inspections.length === 0 ? (
                <L en="none scheduled, conducted by an authority" ar="لا شيء مجدول، تجريها جهة مختصة" />
              ) : (
                <L
                  en={`${inspections.length} ${inspections.length === 1 ? 'check' : 'checks'}, conducted by an authority`}
                  ar={`${inspections.length} ${inspections.length === 1 ? 'تحقق' : 'تحققات'}، تجريها جهة مختصة`}
                />
              )}
            </span>
            <span style={{ marginInlineStart: 'auto', fontSize: 14, color: 'var(--brand)' }}>
              <L en="See them" ar="الاطلاع عليها" />
            </span>
          </summary>
          <div className="secondary-help"><InfoNote><L
              en="The conducting authority schedules these checks, and you will be told the date."
              ar="تجدول الجهةُ المنفِّذة هذه التحققات، وستُبلَّغون بالتاريخ."
            /></InfoNote></div>
          {inspections.length === 0 ? (
            <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, maxWidth: '74ch' }}>
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
                <L
                  en="No inspection scheduled."
                  ar="لم يُحدَّد موعد تفتيش."
                />
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', maxWidth: '74ch', padding: 1 }}>
              {inspections.map((ins, i) => (
                <div key={ins.id} style={{ padding: '14px 18px', borderBlockStart: i === 0 ? '0' : '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: '15.5px', lineHeight: 1.45 }}>
                    <L en={ins.titleEn} ar={ins.titleAr} />
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                    {ins.date ?? ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </details>

        <VendorDirectoryLink />

      </main>
    </>
  );
}
