import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { DatasetForm } from './DatasetForm';
import { currentAccount } from '../../../../lib/auth';
import { unreadCountFor , ministryConfig } from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';

/**
 * The minimum cardiac-arrest reporting dataset: one report per patient, five
 * sections, no patient name, with the onsite device distinguished from the unit's
 * own. Two routes -- the platform form, or the unit's own patient-care report
 * attached where it captures everything required. Fields are the dataset's own; the
 * reporting timeframe is a Ministry value not yet set, and the form says so.
 */
export default async function DatasetReportPage() {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  if (account.role !== 'response') redirect('/dashboard');
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.firstResponse;
  const timeframe = ministryConfig().get('reportingProcedures') ?? null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en="First-response unit account" ar="حساب وحدة استجابة أولية" />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Minimum dataset" ar="الحد الأدنى للبيانات" />
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
            <L en={content.datasetIntro.en} ar={content.datasetIntro.ar} />
          </p>
          <DatasetForm />
          <div data-region="timeframe" style={{ marginBlockStart: 20, padding: '19px 23px', background: 'var(--surface2)', borderRadius: 12, fontSize: '13.5px', lineHeight: 1.7, color: 'var(--muted)', maxWidth: '80ch' }}>
            {timeframe ? (
              <L
                en={`The Ministry's published reporting timeframe applies: ${timeframe.value}${timeframe.effective ? ` — effective ${timeframe.effective}` : ''}.`}
                ar={`تسري مهلة الإبلاغ المنشورة من الوزارة: ${timeframe.value}${timeframe.effective ? ` — اعتباراً من ⁦${timeframe.effective}⁩` : ''}.`}
              />
            ) : (
              <L en={content.timeframeNote.en} ar={content.timeframeNote.ar} />
            )}
          </div>
        </div>
        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: '/first-response/readiness',
              en: 'First-response readiness',
              ar: 'جاهزية الاستجابة الأولية',
              descEn: 'Equipment, competence, operational readiness, the written procedure.',
              descAr: 'التجهيزات والكفاءة والجاهزية التشغيلية والإجراء المكتوب.',
            },
          ]}
        />
      </main>
    </>
  );
}
