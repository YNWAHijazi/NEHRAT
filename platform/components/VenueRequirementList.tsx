import Link from 'next/link';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { UploadInput } from './UploadInput';
import { saveVenueRequirementAction, approveVenuePlanAction } from '../app/venues/actions';
import { venueRequirementEditors, venueLocalEmsContactApplies, type VenueEditor } from '../lib/rules/venue-workflow';
import { acceptAttribute, acceptHint } from '../lib/rules/uploads';
import type { VenueWorkspaceData } from './VenueWorkspace';

const button: React.CSSProperties = { padding: '10px 22px', border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)' };

/** The same linked team appears to the organizer and medical partners; identity is entered once. */
export function VenueLinkedTeam({ w, organizer = true }: { w: VenueWorkspaceData; organizer?: boolean }) {
  const people = w.invitations.filter(i => ['nominated', 'confirmed'].includes(i.status));
  return <section data-region="linked-medical-team" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBlockEnd: 28 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <h3 style={{ margin: 0 }}><L en="Medical team" ar="الفريق الطبي" /></h3>
      {organizer ? <Link href={`/venues/${w.venue.id}/team`}><L en={people.length ? 'View team' : 'Set up medical team'} ar={people.length ? 'عرض الفريق' : 'إعداد الفريق الطبي'} /></Link> : null}
    </div>
    {venueLocalEmsContactApplies(w.level,people.some(i=>i.kind==='ems'))&&w.answers['7']?.localConfirmed==='yes'?<p><strong>{w.answers['7'].agency}</strong> · <bdi>{w.answers['7'].phone}</bdi><br/><L en="Local EMS contact confirmed" ar="أُكّدت جهة الاتصال بالإسعاف المحلي"/></p>:null}
    {people.map(i => <div key={i.token} style={{ marginBlockStart: 14, display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div><strong>{i.name}</strong><div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 4 }}><L en={i.kind === 'ems' ? 'EMS agency' : 'Medical Director'} ar={i.kind === 'ems' ? 'جهة إسعاف' : 'المدير الطبي'} />{i.phone ? <> · <bdi>{i.phone}</bdi></> : null}</div></div>
      <span style={{ fontSize: 13, color: i.status === 'confirmed' && i.active ? 'var(--brand)' : 'var(--accent-ink)' }}><L en={i.status === 'confirmed' ? i.active ? 'Accepted' : 'Account inactive' : 'Awaiting response'} ar={i.status === 'confirmed' ? i.active ? 'مقبولة' : 'الحساب غير نشط' : 'بانتظار الرد'} /></span>
    </div>)}
  </section>;
}

export function VenueRequirementList({ w, role = 'organizer', token, saved }: { w: VenueWorkspaceData; role?: VenueEditor; token?: string; saved?: string | undefined }) {
  const id = w.venue.id;
  const groups = role === 'organizer' ? [
    { key: 'organizer', en: 'Your requirements', ar: 'متطلباتكم', rows: w.requirements.filter(r => !r.optional && !r.clinical) },
    { key: 'medical', en: 'Medical team requirements', ar: 'متطلبات الفريق الطبي', rows: w.requirements.filter(r => !r.optional && r.clinical) },
    { key: 'optional', en: 'Recommended (optional)', ar: 'موصى به (اختياري)', rows: w.requirements.filter(r => r.optional) },
  ] : [
    { key: 'required', en: 'Required', ar: 'مطلوب', rows: w.requirements.filter(r => !r.optional) },
    { key: 'optional', en: 'Recommended (optional)', ar: 'موصى به (اختياري)', rows: w.requirements.filter(r => r.optional) },
  ];
  return <>{groups.map(group => group.rows.length ? <section key={group.key} data-requirement-group={group.key}>
    <h3><L en={group.en} ar={group.ar} /></h3>
    <div data-region="requirements" style={{ display: 'grid', gap: 12, marginBlockEnd: 28 }}>{group.rows.map(r => {
      const key = String(r.n);
      const canEdit = w.editable && w.level && venueRequirementEditors(r.n, w.level).includes(role);
      const receipt = r.receipts.find(c => r.n === 20 ? c.invitation_token === token : true);
      const values = r.n === 20 && role !== 'organizer' ? (receipt ? JSON.parse(receipt.answers) : {}) : w.answers[key] ?? {};
      const fileKey = r.n === 20 && token ? `20-${token}` : key;
      const file = w.files.find(f => f.docKey === fileKey && f.hasFile);
      const doneForMe = r.n === 20 ? Boolean(receipt) : r.done || r.awaitingApproval;
      const waitingForEms = r.fields.some(f => f.source === 'ems' && !w.answers[key]?.[f.key]);
      const editableFields = r.fields.filter(f => !f.source);
      const visibleAnswers = r.fields.filter(f => !['ems','author'].includes(f.source??'') && (!r.clinical || !f.source) && values[f.key]);
      const upload = <><UploadInput name="file" accept={acceptAttribute()} required={r.fileRequired && !file} /><small style={{ display: 'block', marginBlockStart: 8 }}><L en={acceptHint().en} ar={acceptHint().ar} /></small></>;
      const fields = <form action={saveVenueRequirementAction.bind(null, id, key)}>
        <input type="hidden" name="assessmentVersion" value={w.assessmentVersion ?? ''} /><input type="hidden" name="workRevision" value={w.workRevision} />
        <div style={{ display: 'grid', gap: 16 }}>{editableFields.map(f => <label key={f.key} style={{ display: 'grid', gap: 6 }}><L en={f.en} ar={f.ar} /><textarea required name={f.key} defaultValue={values[f.key] ?? ''} rows={2} maxLength={5000} style={{ width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit', fontSize: 15 }} /></label>)}</div>
        {r.fileRequired ? <label style={{ display: 'grid', gap: 8, marginBlock: 20 }}><L en="Required document" ar="مستند مطلوب" />{upload}</label> : <details style={{ marginBlock: 20 }}><summary style={{ cursor: 'pointer', marginBlockEnd: 12 }}><L en="Add a file (optional)" ar="إضافة ملف (اختياري)" /></summary>{upload}</details>}
        {role !== 'organizer' ? <label style={{ display: 'flex', gap: 10, marginBlock: 18 }}><input type="checkbox" name="confirm" value="yes" required /><L en="I confirm these arrangements for this venue." ar="أؤكّد هذه الترتيبات لهذا الموقع." /></label> : null}
        {waitingForEms ? <p role="status"><L en="Waiting for an EMS agency to accept its invitation." ar="بانتظار قبول جهة الإسعاف للدعوة." /></p> : null}
        <button style={button} disabled={waitingForEms}><L en={role === 'organizer' ? 'Save' : 'Mark complete'} ar={role === 'organizer' ? 'حفظ' : 'تأكيد الاكتمال'} /></button>
      </form>;
      return <details key={key} id={`r-${key}`} data-requirement={key} open={saved === key} style={{ background: 'var(--surface2)', borderRadius: 12, borderInlineStart: `3px solid ${r.done ? 'var(--brand)' : r.optional ? 'var(--line)' : 'var(--accent-ink)'}`, padding: 20, scrollMarginBlockStart: 24 }}>
        <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 40 }}><strong><L en={r.en} ar={r.ar} /></strong><span data-completion={r.done ? 'complete' : 'pending'} style={{ flexShrink: 0, color: r.done ? 'var(--brand)' : r.optional ? 'var(--muted)' : 'var(--accent-ink)', background: r.done ? 'var(--brand-soft)' : r.optional ? 'var(--bg)' : 'var(--accent-soft)', padding: '5px 10px', borderRadius: 20, fontSize: 13 }}><L en={r.done ? 'Complete' : r.awaitingApproval ? 'Awaiting approval' : r.optional ? 'Optional' : 'Pending'} ar={r.done ? 'مكتمل' : r.awaitingApproval ? 'بانتظار الاعتماد' : r.optional ? 'اختياري' : 'قيد الانتظار'} /></span></summary>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlock: '12px 20px' }}><L en={r.n === 1 ? 'From venue details' : r.n === 3 ? 'From the Medical Director invitation' : key === '7' && w.level === 1 ? 'From Medical team' : r.clinical ? (r.n === 15 ? 'Medical Director' : r.n === 20 ? 'Each EMS agency' : 'Medical Director or EMS agency') : 'Organizer'} ar={r.n === 1 ? 'من تفاصيل الموقع' : r.n === 3 ? 'من دعوة المدير الطبي' : key === '7' && w.level === 1 ? 'من الفريق الطبي' : r.clinical ? (r.n === 15 ? 'المدير الطبي' : r.n === 20 ? 'كل جهة إسعاف' : 'المدير الطبي أو جهة الإسعاف') : 'المنظّم'} /><InfoNote><L en={r.valueEn} ar={r.valueAr} /></InfoNote></div>
        {(!canEdit || doneForMe) && visibleAnswers.length && (!r.clinical || r.receipts.length || !w.editable) ? <dl style={{ display: 'grid', gap: 12 }}>{visibleAnswers.map(f => <div key={f.key}><dt style={{ color: 'var(--muted)', fontSize: 13 }}><L en={f.en} ar={f.ar} /></dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{values[f.key]}</dd></div>)}</dl> : null}
        {file ? <p><a href={`/api/venue-documents/${id}/${fileKey}`} target="_blank" rel="noreferrer"><L en="View attached file" ar="عرض الملف المرفق" /> · {file.fileName}</a></p> : null}
        {r.receipts.map(c => { const data = JSON.parse(c.answers); return <p key={c.invitation_token} style={{ fontSize: 13, color: 'var(--muted)' }}><L en="Completed by" ar="أكمله" /> {c.display_name} · {c.completed_at.slice(0, 10)} {r.n === 20 && data.fileKey ? <a href={`/api/venue-documents/${id}/${data.fileKey}`} target="_blank" rel="noreferrer"><L en="View declaration" ar="عرض الإقرار" /></a> : null}</p>; })}
        {r.n === 2 && w.approval ? <p><L en="Medical Director approval" ar="اعتمدها" /> {w.approval.display_name} · {w.approval.approved_at.slice(0, 10)}</p> : null}
        {canEdit ? (doneForMe ? <details style={{ marginBlockStart: 20 }}><summary style={{ cursor: 'pointer', color: 'var(--brand)', marginBlockEnd: 16 }}><L en="Update these answers" ar="تعديل هذه الإجابات" /></summary>{fields}</details> : fields) : null}
        {!r.done && role === 'organizer' && r.clinical ? <p><L en={r.awaitingApproval ? 'Waiting for the Medical Director’s approval.' : 'Your medical team completes this item.'} ar={r.awaitingApproval ? 'بانتظار اعتماد المدير الطبي.' : 'يستكمل الفريق الطبي هذا البند.'} /> <Link href={`/venues/${id}/team`}><L en="View team" ar="عرض الفريق" /></Link></p> : null}
        {r.n === 1 && !r.done && role === 'organizer' ? <Link href={`/venues/${id}/details`}><L en="Complete contact details" ar="إكمال بيانات الاتصال" /></Link> : null}
        {key === '7' && w.level === 1 && !r.done && role === 'organizer' ? <Link href={`/venues/${id}/team`}><L en="Confirm EMS contact" ar="تأكيد جهة الاتصال بالإسعاف"/></Link> : null}
        {r.n === 3 && role === 'organizer' && !r.done ? <Link href={`/venues/${id}/team`}><L en="Invite Medical Director" ar="دعوة المدير الطبي" /></Link> : null}
        {r.awaitingApproval && role === 'director' && w.editable ? <form action={approveVenuePlanAction.bind(null, id)}><input type="hidden" name="assessmentVersion" value={w.assessmentVersion ?? ''} /><input type="hidden" name="workRevision" value={w.workRevision} /><label style={{ display: 'flex', gap: 10, marginBlock: 18 }}><input type="checkbox" name="confirm" value="yes" required /><L en="I have reviewed and approve this plan and the medical arrangements." ar="راجعت هذه الخطة والترتيبات الطبية وأعتمدها." /></label><button style={button}><L en="Approve medical plan" ar="اعتماد الخطة الطبية" /></button></form> : null}
      </details>;
    })}</div>
  </section> : null)}</>;
}
