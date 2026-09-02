import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
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
export default async function FirstResponseReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'response') redirect('/dashboard');
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.firstResponse;
  const readiness = frReadinessFor(account.id);
  const reports = frReportsFor(account.id);
  const { notice } = await searchParams;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={false} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        {notice === 'reported' ? (
          <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
            <L en="The report has been submitted to the Ministry." ar="قُدِّم التقرير إلى الوزارة." />
          </div>
        ) : null}
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en={content.accountNote.en} ar={content.accountNote.ar} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 20px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="First-response readiness" ar="جاهزية الاستجابة الأولية" />
        </h1>
        {/* The unit-holds-everything overview sentence left this screen (partner
            ruling, second sweep): it narrated the three lists and the procedure
            that follow. */}
        <div data-region="different-actor" style={{ padding: '21px 25px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 40, maxWidth: '80ch', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
          <L en={content.differentActor.en} ar={content.differentActor.ar} />
        </div>

        <ReadinessChecklist
          initial={readiness?.confirmations ?? {}}
          signedAt={readiness?.signedAt ?? null}
        />

        <h2 style={{ margin: '40px 0 18px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Written cardiac-arrest response procedure" ar="إجراءات الاستجابة المكتوبة لحالات توقف القلب" />
        </h2>
        {/* The six-steps-and-the-rule-beneath-them sentence left this screen
            (partner ruling, second sweep): it narrated the table and the note
            that follow it. */}
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
        <div data-region="non-transport" style={{ padding: '19px 23px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 40, fontSize: '14.5px', lineHeight: 1.7, maxWidth: '80ch' }}>
          <L en={content.nonTransportRule.en} ar={content.nonTransportRule.ar} />
        </div>

        <div data-region="reports" style={{ padding: '25px 29px', background: 'var(--surface2)', borderRadius: 16, maxWidth: '80ch' }}>
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

      </main>
    </>
  );
}
