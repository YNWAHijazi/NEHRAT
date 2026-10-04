import {eventPlanApproval} from '../../../../lib/plan-approval';
import Link from 'next/link';
import { SharedPlanSync } from '../../../../components/SharedPlanSync';
import { notFound, redirect } from 'next/navigation';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { eventFor, invitationsFor, invitationByToken, sharedDocumentsFor, governanceFor, planFor, planLastEditorFor, derivedLevelFor, unreadCountFor, attachmentsFor, addedMeasuresFor } from '../../../../lib/queries';
import { GovernmentBand, Header } from '../../../../components/Header';
import { EventWorkspaceHeader } from '../../../../components/EventWorkspaceHeader';
import { DocumentViewer } from '../../../../components/DocumentViewer';
import { L } from '../../../../components/L';
import { DECLARATION_ITEMS, ROLES_CONTENT, planIsComplete, medicalDirectorApplies } from '../../../../lib/rules';
import { planRequirement } from '../../../../lib/rules/plan-responsibility';

const states = {
  nominated: ['Invitation pending', 'الدعوة قيد الانتظار'], confirmed: ['Confirmed', 'مؤكّد'],
  declined: ['Declined', 'لم تُقبل الدعوة'], withdrawn: ['Withdrawn', 'مسحوب'], removed: ['Removed', 'تمت الإزالة'],
} as const;
const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, padding: 22, marginBlockEnd: 18 };

export default async function MedicalTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  const tab = (await searchParams).tab === 'ems' ? 'ems' : 'director';
  // Invitation tokens come only from this owner's event, never from a request parameter.
  const parties = invitationsFor(account.id, id).filter(i => i.kind === tab).map(i => invitationByToken(i.token)).filter(i => i !== null);
  const level = derivedLevelFor(id);
  // No Director at Level 1: the tab is absent, and a direct link lands on the EMS agencies instead.
  if (tab === 'director' && !medicalDirectorApplies(level)) redirect(`/events/${id}/medical-team?tab=ems`);
  const plan = planFor(account.id, id);
  const lastEditor = planLastEditorFor(account.id, id);
  const complete = level ? planIsComplete(plan, level)&&(level!==3||Boolean(eventPlanApproval(id))) : false;
  const required = planRequirement(level, addedMeasuresFor(id).some(m => m.catalogKey === 'plan' && !m.clearedAt));
  const governance = governanceFor(id);
  const deployment = attachmentsFor(account.id, id).find(a => a.docKey === 'deploymentMap');
  const title = tab === 'ems' ? (['EMS agencies', 'جهات الإسعاف'] as const) : (['Medical Director', 'المدير الطبي'] as const);
  return <>
    <SharedPlanSync eventId={id} version={plan?.version ?? 0} />
    <GovernmentBand />
    <Header account={account} organization={organizationFor(account.id)} unreadCount={unreadCountFor(account.id)} showBack  />
    <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
      <EventWorkspaceHeader accountId={account.id} event={event} active={tab} />
      <h1><L en={title[0]} ar={title[1]} /></h1>
      {required !== 'notRequired' && <section data-region="shared-plan-summary" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div><h2 style={{ fontSize: 20, margin: '0 0 8px' }}><L en="Shared medical plan" ar="الخطة الطبية المشتركة" /></h2>
            <L en={complete ? 'Complete' : plan ? 'In progress' : 'Not started'} ar={complete ? 'مكتملة' : plan ? 'قيد الإعداد' : 'لم تبدأ بعد'} /> · <L en={required === 'required' ? 'Required' : 'Recommended'} ar={required === 'required' ? 'مطلوبة' : 'موصى بها'} />
            {lastEditor && <p style={{ marginBlock: 6 }}><L en="Last saved by" ar="آخر حفظ بواسطة" />: {lastEditor.name}</p>}
            {plan && <p style={{ color: 'var(--muted)', fontSize: 13 }}><L en={`Version ${plan.version} · Updated ${plan.updatedAt.slice(0, 16).replace('T', ' ')}`} ar={`النسخة ${plan.version} · آخر تحديث ${plan.updatedAt.slice(0, 16).replace('T', ' ')}`} /></p>}
          </div>
          <Link className="btn" href={`/events/${id}/plan`}><L en="View plan" ar="عرض الخطة" /></Link>
        </div>
      </section>}
      {parties.length === 0 && <section style={card}><p><L en={tab === 'ems' ? 'No EMS agency has been invited.' : 'No Medical Director has been invited.'} ar={tab === 'ems' ? 'لم تُدعَ أي جهة إسعاف بعد.' : 'لم يُدعَ مدير طبي بعد.'} /></p><Link href={`/events/${id}/requirements#medical-team`}><L en="Manage invitations" ar="إدارة الدعوات" /></Link></section>}
      {parties.map(p => <section key={p.token} data-region="medical-team-party" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: '0 0 6px', fontSize: 21 }}><L en={p.nameEn} ar={p.nameAr} /></h2><a href={`mailto:${p.email}`}>{p.email}</a></div>
          <span><L en={states[p.status][0]} ar={states[p.status][1]} /></span>
        </div>
        {p.responseNote && <p style={{ whiteSpace: 'pre-wrap' }}>{p.responseNote}</p>}
        {tab === 'ems' && <dl style={{ display: 'grid', gap: 16, marginBlockStart: 22 }}>
          {ROLES_CONTENT.ems.level2Fields.filter(f => p.opsDetail[f.key]?.trim()).map(f => <div key={f.key}><dt style={{ color: 'var(--muted)', fontSize: 13 }}><L en={f.en} ar={f.ar} /></dt><dd style={{ margin: '5px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.opsDetail[f.key]}</dd></div>)}
        </dl>}
        {tab === 'ems' && level === 3 && <details style={{ marginBlock: 18 }} data-region="team-declaration"><summary><L en="EMS readiness declaration" ar="إقرار جاهزية الإسعاف" /> — <L en={p.declaration === 'signed' ? 'Submitted' : 'Pending'} ar={p.declaration === 'signed' ? 'مقدّم' : 'قيد الانتظار'} /></summary>
          {p.declaration === 'signed' && <><p>{p.signedAt?.slice(0, 10)}</p>{DECLARATION_ITEMS.map((item, index) => <p key={index}><L en={item.en} ar={item.ar} /> — <L en={p.declarationItems[index] ? 'Confirmed' : 'Pending'} ar={p.declarationItems[index] ? 'مؤكّد' : 'قيد الانتظار'} /></p>)}<dl>{ROLES_CONTENT.ems.certificationFields.filter(f => p.certification[f.key]).map(f => <div key={f.key}><dt><L en={f.en} ar={f.ar} /></dt><dd>{p.certification[f.key]}</dd></div>)}</dl></>}
        </details>}
        {sharedDocumentsFor(p.token).map(d => <div key={d.id} style={{ paddingBlock: 12, borderBlockStart: '1px solid var(--line)' }}><strong><L en={d.nameEn} ar={d.nameAr} /></strong>{d.hasFile ? <DocumentViewer href={`/api/shared-documents/${d.id}`} hasFile contentType={d.contentType} label={d.nameEn} /> : <p><L en="Pending" ar="قيد الانتظار" /></p>}</div>)}
      </section>)}
      {tab === 'director' && level === 3 && <section style={card} data-region="team-governance"><h2 style={{ fontSize: 20 }}><L en="Medical arrangements" ar="الترتيبات الطبية" /></h2>
        {ROLES_CONTENT.director.govSections.map(s => <details key={s.key} style={{ paddingBlock: 12, borderBlockEnd: '1px solid var(--line)' }}><summary><L en={'readerEn' in s ? s.readerEn : s.en} ar={'readerAr' in s ? s.readerAr : s.ar} /></summary><p style={{ whiteSpace: 'pre-wrap' }}>{governance[s.key] || <L en="Pending" ar="قيد الانتظار" />}</p></details>)}
        <h3><L en="Medical deployment map" ar="خريطة الانتشار الطبي" /></h3>
        {deployment?.hasFile ? <DocumentViewer href={`/api/documents/${id}/deploymentMap`} hasFile contentType={deployment.contentType} label="Medical deployment map" /> : <p><L en="Pending" ar="قيد الانتظار" /></p>}
      </section>}
    </main>
  </>;
}
