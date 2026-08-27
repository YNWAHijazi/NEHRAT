import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
  attachmentsFor,
  eventFor,
  submissionFor,
  unreadCountFor,
} from '../../../../lib/queries';
import { documentsForLevel, type Level } from '../../../../lib/rules';
import { PrintBar } from './PrintBar';

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
};

/**
 * Acknowledgment of receipt: a submission is considered received only when the organizer
 * receives the electronic acknowledgment and reference number (Protocol 9). The wallcard
 * carries the two jurisdiction limits verbatim.
 */
export default async function AcknowledgmentPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;
  const submission = submissionFor(account.id, id);
  const filed = submission?.filedAt != null && event.mophReference != null;
  const attachments = attachmentsFor(account.id, id);

  const receivedDocs = filed
    ? documentsForLevel((level ?? 1) as Level)
        .filter((d) => !d.optional)
        .map((d) => ({
          en: d.en,
          ar: d.ar,
          when: attachments.find((a) => a.docKey === d.key)?.attachedAt.slice(0, 10) ?? submission?.filedAt?.slice(0, 10) ?? '',
        }))
    : [];

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Acknowledgment of receipt" ar="إشعار الاستلام" />
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L
            en="A submission is considered received only when the organizer receives an electronic acknowledgment and reference number. This is the document you give to the authority authorizing your event."
            ar="يُعتبر التقديم مستلماً فقط عندما يتلقى المنظّم إشعاراً إلكترونياً ورقماً مرجعياً. وهذا هو المستند الذي تقدّمونه إلى السلطة المانحة لترخيص فعاليتكم."
          />
        </p>

        {!filed ? (
          /* A state gate, not an absence: the acknowledgment is coming once filing happens. */
          <div style={{ maxWidth: 820, marginBlock: 34, padding: '32px 36px', border: '1px dashed var(--line)', borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.7, color: 'var(--muted)' }}>
              <L
                en="No acknowledgment exists yet. It is issued at the moment the submission is filed, and the reference number it carries is what the authorising authority asks for."
                ar="لا يوجد إشعار بعد. يصدر لحظة تقديم الملف، والرقم المرجعي الذي يحمله هو ما تطلبه السلطة المرخِّصة."
              />
            </p>
          </div>
        ) : (
          <div data-wallcard="" style={{ maxWidth: 820, marginBlock: 34, padding: '57px 61px', background: 'var(--surface2)', borderRadius: 999, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBlockEnd: 26, borderBlockEnd: '2px solid var(--brand)' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, border: '1.25px solid var(--brand)', borderRadius: '50%', flex: 'none' }}>
                <span style={{ display: 'block', width: 17, height: 17, background: 'var(--brand)', clipPath: 'polygon(43% 0,57% 0,57% 43%,100% 43%,100% 57%,57% 57%,57% 100%,43% 100%,43% 57%,0 57%,0 43%,43% 43%)' }} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
                  <L en="Ministry of Public Health" ar="وزارة الصحة العامة" />
                </span>
                <span style={{ display: 'block', fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                  <L en="Republic of Lebanon · Event Health Readiness" ar="الجمهورية اللبنانية · التأهب الصحي للفعاليات" />
                </span>
              </span>
            </div>

            <div style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 8 }}>
                <L en="Ministry reference number" ar="الرقم المرجعي للوزارة" />
              </div>
              <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {event.mophReference}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 10 }}>
                <L en={`Issued ${submission?.filedAt?.slice(0, 10) ?? ''}`} ar={`صدر في ⁦${submission?.filedAt?.slice(0, 10) ?? ''}⁩`} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '28px 32px', paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              {[
                { en: 'Event', ar: 'الفعالية', vEn: event.nameEn, vAr: event.nameAr },
                { en: 'Record identifier', ar: 'معرّف السجل', vEn: event.id, vAr: event.id },
                { en: 'Event date', ar: 'تاريخ الفعالية', vEn: event.startDate ?? '—', vAr: event.startDate ?? '—' },
                { en: 'Final level', ar: 'المستوى النهائي', vEn: `Level ${level}`, vAr: `المستوى ${level}` },
                { en: 'Organizer', ar: 'المنظم', vEn: organization?.nameEn ?? '—', vAr: organization?.nameAr ?? '—' },
                ...(submission?.expedited
                  ? [{ en: 'Filing', ar: 'التقديم', vEn: 'Expedited submission — the standard timeline could not be met', vAr: 'تقديم مستعجل — تعذّر الالتزام بالمهلة الاعتيادية' }]
                  : []),
              ].map((f) => (
                <div key={f.en}>
                  <div style={{ ...upLabel, letterSpacing: '.06em', marginBlockEnd: 6 }}>
                    <L en={f.en} ar={f.ar} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}>
                    <L en={f.vEn} ar={f.vAr} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 14 }}>
                <L en="Documents received" ar="المستندات المستلمة" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {receivedDocs.map((d) => (
                  <div key={d.en} style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontSize: 15, lineHeight: 1.5 }}>
                    <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
                    <span style={{ flex: 1 }}>
                      <L en={d.en} ar={d.ar} />
                    </span>
                    <span style={{ flex: 'none', color: 'var(--muted)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>{d.when}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ paddingBlock: 30, borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ ...upLabel, marginBlockEnd: 12 }}>
                <L en="Current Ministry status" ar="الحالة الحالية لدى الوزارة" />
              </div>
              {/* Grey and quiet: an internal workflow state, not a determination. */}
              <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}>
                <L en="In queue for review" ar="في قائمة انتظار المراجعة" />
              </div>
            </div>

            <div data-region="limits" style={{ paddingBlockStart: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 500 }}>
                <L
                  en="This acknowledges receipt of a submission recording health and medical preparedness. It is not an authorization to hold the event."
                  ar="يُقرّ هذا باستلام تقديم يسجّل التأهب الصحي والطبي. وهو ليس ترخيصاً بإقامة الفعالية."
                />
              </p>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>
                <L
                  en="Authorization of the event remains with the Ministry of Interior and Municipalities, the municipality, the Governor or another legally competent authority."
                  ar="يبقى ترخيص الفعالية من صلاحية وزارة الداخلية والبلديات أو البلدية أو المحافظ أو أي سلطة مختصة قانوناً أخرى."
                />
              </p>
            </div>
          </div>
        )}

        {filed ? <PrintBar /> : null}

        <SequenceFooter
          labelEn="Where this record leads"
          labelAr="إلى أين يقود هذا السجل"
          steps={[
            {
              href: `/events/${id}`,
              en: 'Event record',
              ar: 'سجل الفعالية',
              descEn: 'Level, filing date and submission history.',
              descAr: 'المستوى وتاريخ التقديم وسجل التقديم.',
              primary: true,
            },
            ...(filed
              ? [
                  {
                    href: `/events/${id}/change`,
                    en: 'Report a material change',
                    ar: 'الإبلاغ عن تغيير جوهري',
                    descEn: 'After submission, any change to the enumerated list or a domain answer.',
                    descAr: 'بعد التقديم، أي تغيير في القائمة المحددة أو في إجابة مجال.',
                  },
                ]
              : []),
          ]}
        />
      </main>
    </>
  );
}
