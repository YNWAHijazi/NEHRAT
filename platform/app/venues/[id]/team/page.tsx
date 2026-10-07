import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { SectionHeading } from '../../../../components/SectionHeading';
import { L } from '../../../../components/L';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { venueLocalEmsContactApplies, arabicCount } from '../../../../lib/rules/venue-workflow';
import { inviteVenuePartnerAction, withdrawVenuePartnerAction, saveVenueLocalEmsContactAction } from '../../team-actions';
import { InvitationLinkBlock } from '../../../../components/record/InvitationLinkBlock';
import { alertBand, noticeBand, fieldInput } from '../../../../components/workspace-styles';

/** The nomination states (SPEC 2: Nominated / Confirmed / Declined), agreeing with the party in Arabic:
 *  an agency (جهة) takes the feminine, a Director the masculine. */
const PART = {
  nominated: { en: 'Nominated', ems: 'مُرشَّحة', director: 'مُرشَّح', bg: 'var(--surface2)', color: 'var(--muted)', edge: 'var(--accent-ink)',
    noteEn: 'Has not answered yet', noteEms: 'لم تُجب بعد', noteDirector: 'لم يُجب بعد' },
  confirmed: { en: 'Confirmed', ems: 'مؤكِّدة', director: 'مؤكِّد', bg: 'var(--brand-soft)', color: 'var(--brand)', edge: 'var(--brand)',
    noteEn: 'Accepted the invitation', noteEms: 'قبلت الدعوة', noteDirector: 'قبل الدعوة' },
  declined: { en: 'Declined', ems: 'معتذرة', director: 'معتذر', bg: 'var(--bad-soft)', color: 'var(--bad)', edge: 'var(--bad)',
    noteEn: 'Invitation declined. Invite a replacement.', noteEms: 'اعتذرت عن الدعوة. ادعوا بديلاً.', noteDirector: 'اعتذر عن الدعوة. ادعوا بديلاً.' },
  withdrawn: { en: 'Withdrawn', ems: 'مسحوبة', director: 'مسحوبة', bg: 'var(--surface)', color: 'var(--muted)', edge: 'var(--line)',
    noteEn: 'Invitation withdrawn', noteEms: 'سُحبت الدعوة', noteDirector: 'سُحبت الدعوة' },
} as const;

const DECLARATION = {
  none: { en: 'No declaration', ar: 'لا إقرار', bg: 'var(--surface2)', color: 'var(--muted)' },
  signed: { en: 'Declaration — signed', ar: 'الإقرار — موقّع', bg: 'var(--brand-soft)', color: 'var(--brand)' },
} as const;

const chipStyle = (bg: string, color: string): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, background: bg, color, fontSize: 13 });
const smallButton: React.CSSProperties = { height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: '12.5px', cursor: 'pointer' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 };
const labelText: React.CSSProperties = { fontSize: '12.5px', color: 'var(--muted)' };

export default async function VenueTeam({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const q = await searchParams;
  const linkedEms = w.invitations.some((i) => i.kind === 'ems' && ['nominated', 'confirmed'].includes(i.status));
  const localContact = venueLocalEmsContactApplies(w.level, linkedEms);
  const directorHeld = w.invitations.some((i) => i.kind === 'director' && ['nominated', 'confirmed'].includes(i.status));
  // A Director is required at Level 3 and optional at Level 2; at Level 1 the section is absent, as on events.
  const sections = [
    { kind: 'ems' as const, en: 'EMS agencies', ar: 'جهات الإسعاف' },
    ...((w.level !== null && w.level >= 2) || w.invitations.some((i) => i.kind === 'director') ? [{ kind: 'director' as const, en: w.level === 3 ? 'Event Medical Director' : w.level === 2 ? 'Medical Director (optional)' : 'Medical Director — not required at Level 1', ar: w.level === 3 ? 'المدير الطبي للفعالية' : w.level === 2 ? 'المدير الطبي (اختياري)' : 'المدير الطبي — غير مطلوب في المستوى 1' }] : []),
  ];

  return (
    <VenueWorkspace account={account} w={w} active="team">
      <h2 data-sec-h1="" style={{ margin: '0 0 22px', fontSize: 28 }}><L en="Medical team" ar="الفريق الطبي" /></h2>
      {q.error ? (
        <div role="alert" style={alertBand}>
          <L
            en={q.error === 'duplicate' ? 'This invitation already exists. Withdraw it before replacing it.' : q.error === 'local' ? 'Enter the local EMS name and phone, then confirm the contact.' : 'Enter a name and a valid email address.'}
            ar={q.error === 'duplicate' ? 'هذه الدعوة موجودة. اسحبوها قبل استبدالها.' : q.error === 'local' ? 'أدخلوا اسم جهة الإسعاف المحلية ورقمها، ثم أكّدوا الاتصال.' : 'أدخلوا اسماً وبريداً إلكترونياً صالحاً.'}
          />
        </div>
      ) : null}
      {q.saved ? (
        <div role="status" style={noticeBand}>
          <L en="Contact saved. Your requirements have been updated." ar="حُفظت بيانات الاتصال وحُدّثت المتطلبات." />
        </div>
      ) : null}
      {w.level === null ? (
        <div role="status" style={noticeBand}>
          <L en="Complete the assessment first. The level decides who is invited." ar="أكملوا التقييم أولاً. يحدّد المستوى من تجب دعوته." />
        </div>
      ) : null}

      {sections.map((section, index) => {
        const people = w.invitations.filter((i) => i.kind === section.kind);
        const canInvite = w.editable && w.level !== null && (section.kind === 'ems' || (w.level >= 2 && !directorHeld));
        return (
          <div key={section.kind} data-region={`team-${section.kind}`} style={{ marginBlockEnd: 52 }}>
            <SectionHeading n={index + 1} en={section.en} ar={section.ar} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
              {people.map((i) => {
                const part = PART[i.status];
                const completed = w.contributions.filter((c) => c.invitation_token === i.token).length;
                const declared = w.contributions.some((c) => c.requirement_key === '20' && c.invitation_token === i.token);
                const decl = DECLARATION[declared ? 'signed' : 'none'];
                return (
                  <div key={i.token} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px ${i.status === 'confirmed' ? 'solid' : 'dashed'} ${part.edge}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div style={{ fontSize: 16, lineHeight: 1.45 }}><bdi>{i.name}</bdi></div>
                      <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, overflowWrap: 'anywhere' }}>
                        {i.email}{i.phone ? <> · <bdi>{i.phone}</bdi></> : null} · <L en={part.noteEn} ar={i.kind === 'ems' ? part.noteEms : part.noteDirector} />
                      </div>
                      {i.status === 'confirmed' ? (
                        <div style={{ fontSize: '12.5px', color: completed ? 'var(--brand)' : 'var(--muted)', marginBlockStart: 6 }}>
                          <L en={completed === 1 ? '1 requirement completed' : `${completed} requirements completed`} ar={completed === 0 ? 'لم يكتمل أي متطلب' : arabicCount(completed, { one: 'اكتمل متطلب واحد', two: 'اكتمل متطلبان', few: 'متطلبات مكتملة', many: 'متطلباً مكتملاً' })} />
                        </div>
                      ) : null}
                      {i.note ? <div style={{ fontSize: '12.5px', color: 'var(--accent-ink)', marginBlockStart: 6, lineHeight: 1.55 }}>{i.note}</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 'none' }}>
                      <span style={chipStyle(part.bg, part.color)}><L en={part.en} ar={i.kind === 'ems' ? part.ems : part.director} /></span>
                      {section.kind === 'ems' && w.level === 3 && i.status === 'confirmed' ? (
                        <span style={chipStyle(decl.bg, decl.color)}><L en={decl.en} ar={decl.ar} /></span>
                      ) : null}
                    </div>
                    {i.status === 'nominated' ? (
                      <div style={{ flexBasis: '100%' }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockEnd: 6 }}>
                          <L
                            en={i.delivery === 'sent' ? 'Invitation email sent.' : i.delivery === 'demo' ? 'Demonstration invitation — share this link.' : 'Email not sent. Share this invitation link.'}
                            ar={i.delivery === 'sent' ? 'أُرسلت الدعوة بالبريد.' : i.delivery === 'demo' ? 'دعوة تجريبية — شاركوا هذا الرابط.' : 'لم يُرسل البريد. شاركوا رابط الدعوة.'}
                          />
                        </div>
                        <InvitationLinkBlock token={i.token} path={`/venue-invitations/${i.token}`} />
                      </div>
                    ) : null}
                    {w.editable && ['confirmed', 'nominated'].includes(i.status) ? (
                      <form action={withdrawVenuePartnerAction.bind(null, id, i.token)} style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                        <button type="submit" style={smallButton}><L en="Withdraw invitation" ar="سحب الدعوة" /></button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {canInvite ? (
              <form action={inviteVenuePartnerAction.bind(null, id)} style={{ padding: '18px 22px', border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
                <input type="hidden" name="kind" value={section.kind} />
                <label style={label}>
                  <span style={labelText}><L en={section.kind === 'ems' ? 'Agency name' : 'Physician name'} ar={section.kind === 'ems' ? 'اسم الجهة' : 'اسم الطبيب'} /></span>
                  <input name="name" required style={fieldInput} />
                </label>
                <label style={label}>
                  <span style={labelText}><L en="Email" ar="البريد الإلكتروني" /></span>
                  <input name="email" type="email" required style={fieldInput} />
                </label>
                <button type="submit" style={{ height: 44, paddingInline: 18, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  <L en="Send invitation" ar="إرسال الدعوة" />
                </button>
              </form>
            ) : null}
          </div>
        );
      })}

      {localContact ? (
        <div data-region="team-local-ems" style={{ marginBlockEnd: 52 }}>
          <SectionHeading
            n={sections.length + 1}
            en="Local EMS contact"
            ar="جهة الاتصال بالإسعاف المحلي"
            help={<L en="At Level 1, you can confirm a local EMS contact without inviting an on-site agency." ar="في المستوى الأول، يمكنكم تأكيد جهة اتصال إسعافية محلية دون دعوة جهة للعمل في الموقع." />}
          />
          {w.editable ? (
            <form action={saveVenueLocalEmsContactAction.bind(null, id)} style={{ padding: '18px 22px', border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end' }}>
              <label style={label}>
                <span style={labelText}><L en="EMS agency" ar="جهة الإسعاف" /></span>
                <input name="agency" required defaultValue={w.answers['7']?.agency ?? ''} style={fieldInput} />
              </label>
              <label style={label}>
                <span style={labelText}><L en="Phone number" ar="رقم الهاتف" /></span>
                <input name="phone" type="tel" required defaultValue={w.answers['7']?.phone ?? ''} style={fieldInput} />
              </label>
              <label style={{ flexBasis: '100%', display: 'flex', gap: 10, alignItems: 'start', fontSize: '14.5px' }}>
                <input name="confirm" type="checkbox" value="yes" required style={{ marginBlockStart: 3 }} />
                <L en="I have confirmed this EMS contact." ar="أكّدت بيانات الاتصال بجهة الإسعاف هذه." />
              </label>
              <button type="submit" style={{ height: 44, paddingInline: 18, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Save contact" ar="حفظ بيانات الاتصال" />
              </button>
            </form>
          ) : (
            <div style={noticeBand}><bdi>{w.answers['7']?.agency}</bdi> · <bdi>{w.answers['7']?.phone}</bdi></div>
          )}
        </div>
      ) : null}
    </VenueWorkspace>
  );
}
