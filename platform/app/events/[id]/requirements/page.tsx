import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SourceDivergence } from '../../../../components/SourceDivergence';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { InviteForm } from './InviteForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
  attachmentsFor,
  documentStateFor,
  eventFor,
  invitationsFor,
  unreadCountFor,
  governanceFor,
} from '../../../../lib/queries';
import {
  documentsForLevel,
  commandFunctionRow, requirementsForLevel,
  type Level,
} from '../../../../lib/rules';
import { attachDocumentAction } from '../../../actions';

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
};

function SectionHeading({ n, en, ar, noteEn, noteAr }: { n: number; en: string; ar: string; noteEn: string; noteAr: string }) {
  return (
    <>
      <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', display: 'flex', gap: 14, alignItems: 'baseline' }}>
        <span style={{ flex: 'none', fontSize: 16, fontWeight: 500, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <span>
          <L en={en} ar={ar} />
        </span>
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
        <L en={noteEn} ar={noteAr} />
      </p>
    </>
  );
}

/**
 * Requirements and attachments: one page, four numbered groups, in the order they need
 * acting on. Everything derives from the level; a requirement that does not apply is
 * absent, not shown as "not required" (non-negotiable #10).
 */
function InvitationLinkBlock({ token }: { token: string }) {
  const path = `/invitations/${token}`;
  return (
    <div style={{ width: '100%', marginBlockStart: 12, paddingBlockStart: 12, borderBlockStart: '1px dashed var(--line)' }}>
      <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
        <L en="The invitation link — hand it to the nominated party" ar="رابط الدعوة — سلّموه إلى الطرف المُسمّى" />
      </div>
      <code dir="ltr" style={{ display: 'block', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px', overflowWrap: 'anywhere', userSelect: 'all' }}>
        {path}
      </code>
      <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockStart: 6, maxWidth: '80ch' }}>
        <L
          en="They answer through it. The token is unguessable; share it only with the party it names."
          ar="من خلاله يجيبون. الرمز غير قابل للتخمين؛ فلا تشاركوه إلا مع الطرف الذي يسمّيه."
        />
      </div>
    </div>
  );
}

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
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

  const documents = documentsForLevel(level);
  const documentState = documentStateFor(account.id, id, level);
  const attachments = attachmentsFor(account.id, id);
  const fileNames = Object.fromEntries(attachments.map((a) => [a.docKey, a.fileName]));
  const invitations = invitationsFor(account.id, id);
  const providers = invitations.filter((i) => i.kind === 'ems');
  const director = invitations.find((i) => i.kind === 'director') ?? null;

  const attachOutstanding = documents.filter(
    (d) => !d.optional && !d.thirdParty && !documentState[d.key],
  ).length;
  // A declined party HAS answered -- the counter must not contradict the gate that
  // explains it (the event record derives the same way).
  const agencyPending = invitations.filter((p) => p.status === 'nominated').length;
  const agencyPendColor = agencyPending > 0 ? 'var(--bad)' : 'var(--brand)';

  // Group 3: the certify-to rows -- everything the matrix carries at this level that is
  // neither an attached document nor a named-party row. Requirement 15 (the command
  // function) renders in the Director block instead, Level 3 only.
  // The reference lists every applicable row here, attachable ones included -- their
  // documents live in group 1; this list is the certification view of the whole matrix.
  const certifyRows = requirementsForLevel(level).filter((r) => r.n !== 15 || level !== 3);
  const commandRow = commandFunctionRow(level);
  const governance = governanceFor(id);

  const partChip = {
    nominated: { en: 'Nominated', ar: 'مُسمّاة', bg: 'var(--surface2)', color: 'var(--muted)', noteEn: 'Has not answered yet', noteAr: 'لم تُجب بعد' },
    confirmed: { en: 'Confirmed', ar: 'مؤكِّدة', bg: 'var(--brand-soft)', color: 'var(--brand)', noteEn: 'Accepted and operational detail supplied', noteAr: 'قبلت وقدّمت التفاصيل التشغيلية' },
    declined: { en: 'Declined', ar: 'معتذرة', bg: 'var(--bad-soft)', color: 'var(--bad)', noteEn: 'A material change you must notify to the Ministry', noteAr: 'تغيير جوهري عليكم إبلاغ الوزارة به' },
  } as const;
  const declChip = {
    none: { en: 'No declaration', ar: 'لا إقرار', bg: 'var(--surface2)', color: 'var(--muted)' },
    draft: { en: 'Declaration — draft', ar: 'الإقرار — مسودة', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    signed: { en: 'Declaration — signed', ar: 'الإقرار — موقّع', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  } as const;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en={`${event.nameEn} · ${event.id} · Level ${level}`} ar={`${event.nameAr} · ${event.id} · المستوى ${level}`} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 14px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Requirements and attachments" ar="المتطلبات والمرفقات" />
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L
            en={`Everything Level ${level} requires of you, in the order it needs acting on. Documents you attach, agencies that must answer, requirements you certify to, and checks conducted on site.`}
            ar={`كل ما يقتضيه منكم المستوى ${level}، بترتيب ما يحتاج إلى إجراء. مستندات ترفقونها، وجهات عليها أن تُجيب، ومتطلبات تصدّقون عليها، وتحققات تُجرى ميدانياً.`}
          />
        </p>

        {/* The two actionable counters, from the reference. */}
        <div data-region="counters" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBlockEnd: 44 }}>
          <div style={{ flex: 1, minWidth: 240, padding: '20px 24px', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--accent)', borderRadius: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--accent-ink)' }}>{attachOutstanding}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en="documents left to attach" ar="مستنداً بقي إرفاقه" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240, padding: '20px 24px', border: '1px solid var(--line)', borderInlineStart: `3px solid ${agencyPendColor}`, borderRadius: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: agencyPendColor }}>{agencyPending}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en="named agencies yet to answer" ar="جهة مُسمّاة لم تُجب بعد" />
            </div>
          </div>
        </div>

        {/* Group 1 — Documents to attach */}
        <div data-region="g1">
        <SectionHeading
          n={1}
          en="Documents to attach"
          ar="المستندات المطلوب إرفاقها"
          noteEn="Anything attached here appears as complete in the submission package. It is never entered twice."
          noteAr="كل ما يُرفق هنا يظهر مكتملاً في حزمة التقديم. لا يُدخَل مرتين."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 52 }}>
          {documents.map((doc) => {
            const done = documentState[doc.key] === true;
            const color = done ? 'var(--brand)' : doc.thirdParty ? 'var(--bad)' : doc.optional ? 'var(--muted)' : 'var(--accent-ink)';
            const chipBg = done ? 'var(--brand-soft)' : doc.thirdParty ? 'var(--bad-soft)' : doc.optional ? 'var(--surface2)' : 'var(--accent-soft)';
            const stateEn = done ? 'Attached' : doc.thirdParty ? 'Awaiting the EMS provider' : doc.optional ? 'Optional' : 'Outstanding';
            const stateAr = done ? 'مُرفق' : doc.thirdParty ? 'بانتظار مزوّد الإسعاف' : doc.optional ? 'اختياري' : 'غير مُرفق';
            const signedCount = providers.filter((p) => p.declaration === 'signed').length;
            const fileNoteEn = doc.system ? doc.noteEn : doc.thirdParty ? `${signedCount} of ${providers.length} signed` : fileNames[doc.key];
            const fileNoteAr = doc.system ? doc.noteAr : doc.thirdParty ? `وُقّع ${signedCount} من ${providers.length}` : fileNames[doc.key];
            return (
              <div key={doc.key} style={{ padding: '20px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: `3px ${doc.thirdParty ? 'dashed' : 'solid'} ${color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 240, display: 'flex', gap: 12, alignItems: 'start' }}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                    <path d="M6.5 4h8l3.5 3.5V20h-11.5z" />
                    <path d="M9.5 11.5h6M9.5 15.5h4" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                      <L en={doc.en} ar={doc.ar} />
                    </div>
                    {fileNoteEn && fileNoteAr ? (
                      <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <L en={fileNoteEn} ar={fileNoteAr} />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 'none', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 4, background: chipBg, color, fontSize: 13 }}>
                    <L en={stateEn} ar={stateAr} />
                  </span>
                  {doc.system ? (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      <L en="No action needed" ar="لا إجراء مطلوب" />
                    </span>
                  ) : null}
                  {doc.platform ? (
                    <a
                      href={doc.key === 'plan' ? `/events/${id}/plan` : `/events/${id}/submit`}
                      style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 14, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
                    >
                      {doc.key === 'plan' ? <L en="Open the plan" ar="فتح الخطة" /> : <L en="Open the form" ar="فتح النموذج" />}
                    </a>
                  ) : null}
                  {doc.attach && !done ? (
                    <form
                      action={attachDocumentAction.bind(null, id)}
                      style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <input type="hidden" name="docKey" value={doc.key} />
                      <input
                        type="file"
                        name="file"
                        required
                        aria-label="Attach the document"
                        style={{ fontSize: 13, maxWidth: 230 }}
                      />
                      <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 18, fontSize: 14, cursor: 'pointer' }}>
                        <L en="Attach" ar="إرفاق" />
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Group 2 — Named EMS providers, and the invitation that belongs here (SPEC 5c) */}
        <div data-region="g2">
        <SectionHeading
          n={2}
          en="Named EMS providers"
          ar="مزوّدو الإسعاف المُسمّون"
          noteEn="You cannot certify that participating providers have been identified until each named EMS provider has answered."
          noteAr="لا يمكنكم الإقرار بتحديد المزوّدين المشاركين قبل أن يُجيب كل مزوّد إسعاف مُسمّى."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
          {providers.map((p) => {
            const part = partChip[p.status];
            const decl = declChip[p.declaration];
            const edge = p.status === 'confirmed' ? 'solid' : 'dashed';
            const color = p.status === 'declined' ? 'var(--bad)' : p.status === 'nominated' ? 'var(--accent-ink)' : 'var(--brand)';
            return (
              <div key={p.token} style={{ padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: `3px ${edge} ${color}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                    <L en={p.nameEn} ar={p.nameAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    <L en={part.noteEn} ar={part.noteAr} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 'none' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 4, background: part.bg, color: part.color, fontSize: 13 }}>
                    <L en={part.en} ar={part.ar} />
                  </span>
                  {level === 3 ? (
                    <span style={{ padding: '4px 10px', borderRadius: 4, background: decl.bg, color: decl.color, fontSize: 13 }}>
                      <L en={decl.en} ar={decl.ar} />
                    </span>
                  ) : null}
                </div>
                {p.status === 'nominated' ? <InvitationLinkBlock token={p.token} /> : null}
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
              n={2}
              en="Event Medical Director"
              ar="المدير الطبي للفعالية"
              noteEn="A licensed physician, nominated here. The event medical command function is theirs alone, and the Level 3 package cannot be filed without them."
              noteAr="طبيب مرخّص يُرشَّح هنا. وظيفة القيادة الطبية للفعالية له وحده، ولا يمكن تقديم ملف المستوى 3 من دونه."
            />
            {director ? (
              <div style={{ padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: `3px solid ${director.status === 'confirmed' ? 'var(--brand)' : director.status === 'declined' ? 'var(--bad)' : 'var(--accent-ink)'}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 20 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                    <L en={director.nameEn} ar={director.nameAr} />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4 }}>
                    <L en={commandRow.en} ar={commandRow.ar} />
                    {' · '}
                    <L en={commandRow.respEn} ar={commandRow.respAr} />
                  </div>
                  {commandRow.divergenceNoteEn && commandRow.divergenceNoteAr ? (
                    <SourceDivergence en={commandRow.divergenceNoteEn} ar={commandRow.divergenceNoteAr} />
                  ) : null}
                  {governance['command']?.trim() ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--brand)', marginBlockStart: 6 }}>
                      <L en="Medical-command arrangements written by the Director — requirement 15 addressed; the text sits in plan section 10." ar="كتب المدير الترتيبات للقيادة الطبية — المتطلب 15 مُعالَج؛ والنص في البند 10 من الخطة." />
                    </div>
                  ) : null}
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 4, background: partChip[director.status].bg, color: partChip[director.status].color, fontSize: 13 }}>
                  <L en={partChip[director.status].en} ar={partChip[director.status].ar} />
                </span>
                {director.status === 'nominated' ? <InvitationLinkBlock token={director.token} /> : null}
              </div>
            ) : (
              <InviteForm eventId={id} kind="director" />
            )}
            <div style={{ marginBlockEnd: 52 }} />
          </>
        ) : null}

        {/* Group 3 — Requirements you certify to */}
        <div data-region="g3">
        <SectionHeading
          n={3}
          en="Requirements you certify to"
          ar="المتطلبات التي تصدّقون عليها"
          noteEn={`The remaining minimum requirements at Level ${level}. Nothing is attached against these; they are discharged together by one line in the compliance and submission form — the applicable minimum requirements have been addressed.`}
          noteAr={`بقية الحد الأدنى للمتطلبات في المستوى ${level}. لا يُرفق شيء مقابلها؛ وتُستوفى مجتمعةً بسطر واحد في نموذج الامتثال والتقديم — عولج الحد الأدنى للمتطلبات المنطبقة.`}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 52 }}>
          {certifyRows.map((r) => (
            <div key={r.n} style={{ padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--line)', borderInlineStart: '3px solid var(--line)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'start', minWidth: 280, flex: 1 }}>
                <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: 'var(--line)', marginBlockStart: 9 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 16, lineHeight: 1.45 }}>
                    <L en={r.en} ar={r.ar} />
                  </span>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 3 }}>
                    <L en={r.valueEn} ar={r.valueAr} />
                  </span>
                  {r.raised ? (
                    <span style={{ display: 'inline-block', marginBlockStart: 6, fontSize: 12, color: 'var(--accent-ink)' }}>
                      <L en={r.raisedEn} ar={r.raisedAr} />
                    </span>
                  ) : null}
                  {r.divergenceNoteEn && r.divergenceNoteAr ? (
                    <SourceDivergence en={r.divergenceNoteEn} ar={r.divergenceNoteAr} />
                  ) : null}
                </span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, minWidth: 0, textAlign: 'end' }}>
                <L en={r.respEn} ar={r.respAr} />
              </span>
            </div>
          ))}
        </div>

        </div>

        {/* Group 4 — Inspections and visits */}
        <div data-region="inspections">
        <SectionHeading
          n={4}
          en="Inspections and visits"
          ar="التفتيش والزيارات"
          noteEn="Some requirements are checked on site rather than on paper. You do not schedule these; the authority conducting them does, and you will be told the date. Nothing is attached against them."
          noteAr="تُتحقَّق بعض المتطلبات ميدانياً لا على الورق. ولا تجدولونها أنتم؛ بل الجهة التي تجريها، وستُبلَّغون بالتاريخ. ولا يُرفق شيء مقابلها."
        />
        <div style={{ padding: 28, border: '1px dashed var(--line)', borderRadius: 12, maxWidth: '74ch' }}>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
            <L
              en="No inspection or visit has been scheduled for this event. The conducting authority sets the date, and it appears here and in your notifications when it does."
              ar="لم يُحدَّد أي تفتيش أو زيارة لهذه الفعالية. تحدد الجهة المنفِّذة التاريخ، ويظهر هنا وفي إشعاراتكم عند تحديده."
            />
          </p>
        </div>
        </div>

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${id}/plan`,
              en: 'Health and medical plan',
              ar: 'خطة التأهب الصحي والطبي',
              descEn: 'Sixteen sections. Write here or attach a plan you already hold.',
              descAr: 'ستة عشر بنداً. اكتبوها هنا أو أرفقوا خطة تملكونها.',
              primary: true,
            },
            {
              href: `/events/${id}/submit`,
              en: 'Submission package',
              ar: 'حزمة التقديم',
              descEn: 'The compliance form and the package, completed on the platform.',
              descAr: 'نموذج الامتثال والحزمة، يُستكملان على المنصة.',
            },
            {
              href: `/events/${id}`,
              en: 'Event record',
              ar: 'سجل الفعالية',
              descEn: 'Level, filing date and submission history.',
              descAr: 'المستوى وتاريخ التقديم وسجل التقديم.',
            },
          ]}
        />
      </main>
    </>
  );
}
