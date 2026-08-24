import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import { ReadinessChecklist } from './ReadinessChecklist';
import { currentAccount } from '../../../lib/auth';
import { frReadinessFor, frReportsFor, unreadCountFor } from '../../../lib/queries';
import { ROLES_CONTENT } from '../../../lib/rules';

/**
 * First-response readiness (cardiac-arrest instrument): equipment, competence,
 * operational readiness and the written procedure -- English from the policy's own
 * lists, Arabic from the Arabic issue. A different actor from the participating EMS
 * provider; neither declaration substitutes for the other.
 */
export default async function FirstResponseReadinessPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'response') redirect('/dashboard');
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.firstResponse;
  const readiness = frReadinessFor(account.id);
  const reports = frReportsFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en={content.accountNote.en} ar={content.accountNote.ar} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="First-response readiness" ar="جاهزية الاستجابة الأولية" />
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
          <L
            en="A basic life support or designated first-response unit holds the equipment, the competence and the operational readiness to respond to a cardiac arrest, works to a written procedure, and reports what it does."
            ar="تملك وحدة الإنعاش الأساسي أو الاستجابة الأولية المعتمدة المعدات والكفاءة والجهوزية التشغيلية للاستجابة لتوقف القلب، وتعمل بإجراء مكتوب، وتُبلغ عمّا تقوم به."
          />
        </p>
        <div data-region="different-actor" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 40, maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
          <L en={content.differentActor.en} ar={content.differentActor.ar} />
        </div>

        <ReadinessChecklist
          initial={readiness?.confirmations ?? {}}
          signedAt={readiness?.signedAt ?? null}
        />

        <h2 style={{ margin: '40px 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Written cardiac-arrest response procedure" ar="إجراءات الاستجابة المكتوبة لحالات توقف القلب" />
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L
            en="Six steps, written and held by the unit. The non-transport rule beneath them governs the case where the unit does not transport."
            ar="ست خطوات مكتوبة تحتفظ بها الوحدة. وتحكم قاعدة عدم النقل أسفلها الحالة التي لا تنقل فيها الوحدة المريض."
          />
        </p>
        <div data-region="procedure" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 16 }}>
          <div data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Step" ar="الخطوة" />
          </div>
          <div data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="What the procedure states" ar="ما ينص عليه الإجراء" />
          </div>
          {content.procedure.map((s) => [
            <div key={`${s.n}-n`} style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--brand)' }}>{s.n}</div>,
            <div key={`${s.n}-t`} style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: 15, lineHeight: 1.6 }}>
              <L en={s.en} ar={s.ar} />
            </div>,
          ])}
        </div>
        <div data-region="non-transport" style={{ padding: '18px 22px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 40, fontSize: '14.5px', lineHeight: 1.7, maxWidth: '80ch' }}>
          <L en={content.nonTransportRule.en} ar={content.nonTransportRule.ar} />
        </div>

        <div data-region="reports" style={{ padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 14, maxWidth: '80ch' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                <L en="Dataset reports filed" ar="تقارير البيانات المقدَّمة" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{reports.length}</div>
            </div>
            <a href="/first-response/reports/new" style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
              <L en="File a dataset report" ar="تقديم تقرير بيانات" />
            </a>
          </div>
        </div>

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: '/first-response/reports/new',
              en: 'Minimum dataset',
              ar: 'الحد الأدنى للبيانات',
              descEn: 'One report per patient, five sections, no patient name.',
              descAr: 'تقرير واحد لكل مريض، خمسة أقسام، دون اسم المريض.',
            },
          ]}
        />
      </main>
    </>
  );
}
