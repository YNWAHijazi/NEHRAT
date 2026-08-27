import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { DeclarationForm } from './DeclarationForm';
import { currentAccount } from '../../../../lib/auth';
import { invitationForEvent, invitationsForAccount, roleProfileFor, unreadCountFor } from '../../../../lib/queries';
import { getDb } from '../../../../lib/db';
import { DECLARATION_ITEMS, ROLES_CONTENT, filingDeadline , emsDeclarationGate} from '../../../../lib/rules';

/**
 * The Level 3 EMS Readiness Declaration: ten items, signed by each participating
 * agency separately, blocked until all ten are confirmed. A draft is visible to the
 * agency alone; signing releases it into the organizer's package. The organizer
 * cannot file without it.
 */
export default async function DeclarationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'ems');
  if (!invitation) notFound();
  // The rule, not this screen's own test (rule 10 and "no screen implements its own
  // gating"). The invitation screen consults the same gate for its accept wording.
  if (emsDeclarationGate(invitation.eventLevel).behaviour !== 'enabled') {
    redirect(`/events/${id}/participation`);
  }
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.ems;
  const profile = roleProfileFor(account.id);
  void invitationsForAccount;

  const fileBy = invitation.eventStart
    ? filingDeadline(3, new Date(`${invitation.eventStart}T12:00:00+03:00`)).date
    : null;
  // The Director's name for item 7, read from the event's confirmed nomination.
  const director = getDb()
    .prepare(`SELECT name_en, name_ar, email FROM invitations WHERE event_id = ? AND kind = 'director' AND status = 'confirmed'`)
    .get(id) as { name_en: string; name_ar: string; email: string } | undefined;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L
              en={`${invitation.eventNameEn} · ${invitation.organizationNameEn} · ${invitation.eventStart ?? ''}`}
              ar={`${invitation.eventNameAr} · ${invitation.organizationNameAr} · ⁦${invitation.eventStart ?? ''}⁩`}
            />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="EMS Readiness Declaration" ar="إقرار جاهزية خدمات الطوارئ الطبية" />
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '72ch' }}>
            <L
              en={`Completed and signed by each participating agency separately.${fileBy ? ` The organizer files by ${fileBy} and cannot file without this.` : ''}`}
              ar={`تستكمله وتوقّعه كل جهة مشاركة على حدة.${fileBy ? ` يقدّم المنظّم بحلول ⁦${fileBy}⁩ ولا يمكنه التقديم من دونه.` : ''}`}
            />
          </p>

          <div data-region="responsibility" style={{ padding: '26px 30px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20, maxWidth: '80ch' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
              <L en="What your agency is accepting" ar="ما تقبله جهتكم" />
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.7 }}>
              <L en={content.responsibilitySentence.en} ar={content.responsibilitySentence.ar} />
            </div>
          </div>

          <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBlockEnd: 32 }}>
            <div style={{ padding: '24px 26px', background: 'var(--surface2)', borderRadius: 16 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="Event Medical Director — for item 7" ar="المدير الطبي للفعالية — للبند 7" />
              </div>
              {director ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBlockEnd: 6 }}>
                    <L en={director.name_en} ar={director.name_ar} />
                  </div>
                  <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6 }}>{director.email}</div>
                </>
              ) : (
                <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <L en="The Director's nomination has not been accepted yet." ar="لم يُقبل ترشيح المدير الطبي بعد." />
                </div>
              )}
            </div>
            <div style={{ padding: '24px 26px', background: 'var(--surface2)', borderRadius: 16 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
                <L en="Major-incident and mass-casualty plan — for item 10" ar="خطة الحوادث الجسيمة وحوادث الإصابات الجماعية — للبند 10" />
              </div>
              <div style={{ fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.6, marginBlockEnd: 14 }}>
                <L en="From the organizer's submission" ar="من ملف المنظّم" />
              </div>
              <a href={`/events/${id}/documents`} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                <L en="Open the shared documents" ar="فتح المستندات المشتركة" />
              </a>
            </div>
          </div>

          <DeclarationForm
            token={invitation.token}
            items={[...DECLARATION_ITEMS]}
            initialConfirmed={invitation.declarationItems}
            initialCertification={invitation.certification}
            signed={invitation.declaration === 'signed'}
            signedAt={invitation.signedAt}
            fileBy={fileBy}
            profileDefaults={{
              provider: profile['agencyName'] ?? invitation.nameEn,
              representative: profile['representative'] ?? '',
            }}
          />
        </div>
        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${id}/documents`,
              en: 'Shared documents',
              ar: 'المستندات المشتركة',
              descEn: 'One list, visible to your organization and to the organizer.',
              descAr: 'قائمة واحدة تظهر لمؤسستكم وللمنظّم.',
            },
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Events you have been named in.',
              descAr: 'الفعاليات التي سُمّيتم فيها.',
            },
          ]}
        />
      </main>
    </>
  );
}
