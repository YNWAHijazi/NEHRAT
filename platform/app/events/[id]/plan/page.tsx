import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { SequenceFooter } from '../../../../components/SequenceFooter';
import { PlanForm } from './PlanForm';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import {
  assessmentsFor,
  eventFor,
  facilityById,
  facilityDevices,
  facilityPlanConfirmation,
  governanceFor,
  planFor,
  planVersionsFor,
  unreadCountFor,
} from '../../../../lib/queries';
import { GUIDANCE_DEPTH, GUIDANCE_TEMPLATE, GUIDANCE_WORKFLOW, MAJOR_INCIDENT_ITEMS, PLAN_SECTIONS, type Level } from '../../../../lib/rules';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(account.id, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;
  const priorVersions = planVersionsFor(account.id, id);
  const governance = governanceFor(id);
  if (level === null) redirect(`/events/${id}`);

  const plan = planFor(account.id, id);
  // Where the event stands in the Guidance's eight-step workflow, from real state:
  // assessed -> preparing the plan (4); filed -> conduct (7); the report ends it (8).
  const workflowStage = !versions[0]?.derivation.complete ? 2 : event.filed ? 7 : 4;
  // 12: renders only where the venue is itself a registered covered facility.
  const facility = event.venueFacilityId ? facilityById(account.id, event.venueFacilityId) : null;
  // What the reference block may point at, read from the facility record -- a
  // reference, never a copy. The shortfalls derive in lib/rules from these facts
  // plus the two event facts the organizer answers on the plan.
  const refDevices = facility ? facilityDevices(facility.id) : [];
  const referenceFacts = facility
    ? {
        count: refDevices.length,
        locationsEn: refDevices.map((d) => d.locationEn),
        locationsAr: refDevices.map((d) => d.locationAr),
        anyPediatric: refDevices.some((d) => d.pediatric === 'yes'),
        planConfirmed: facilityPlanConfirmation(facility.id) !== null,
      }
    : null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en={`${event.nameEn} · ${event.id} · Level ${level}`} ar={`${event.nameAr} · ${event.id} · المستوى ${level}`} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 14px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Event health and medical plan" ar="خطة التأهب الصحي والطبي للفعالية" />
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
          <L
            en="Two routes to the same obligation: write the plan in the platform, or attach the document you already hold and confirm its coverage. Either way, the sixteen items the Protocol sets are what the plan must address."
            ar="مساران إلى الموجب نفسه: كتابة الخطة في المنصة، أو إرفاق المستند الذي تملكونه وتأكيد تغطيته. وفي الحالين، البنود الستة عشر التي يحددها البروتوكول هي ما يجب أن تعالجه الخطة."
          />
        </p>

        <PlanForm
          eventId={id}
          level={level}
          sectionsDef={[...PLAN_SECTIONS]}
          miDef={[...MAJOR_INCIDENT_ITEMS]}
          template={[...GUIDANCE_TEMPLATE.sections]}
          workflow={[...GUIDANCE_WORKFLOW.steps]}
          workflowStage={workflowStage}
          depth={[...GUIDANCE_DEPTH.rows]}
          nonBindingEn={GUIDANCE_TEMPLATE.nonBindingEn}
          nonBindingAr={GUIDANCE_TEMPLATE.nonBindingAr}
          initial={plan}
          facility={facility}
          referenceFacts={referenceFacts}
          governance={governance}
        />

        {priorVersions.length > 0 ? (
          <section data-region="versions" style={{ marginBlockStart: 32 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en="Versions" ar="النسخ" />
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="Each save archives the version it replaced. The current version leads; earlier versions are read-only." ar="كل حفظ يؤرشف النسخة التي حلّ محلها. النسخة الحالية أولاً؛ والنسخ السابقة للقراءة فقط." />
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan ? (
                <div style={{ border: '1px solid var(--brand)', borderRadius: 10, padding: '10px 14px', fontSize: '13.5px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 500 }}>
                    <L en={`Version ${plan.version} — current`} ar={`النسخة ${plan.version} — الحالية`} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{plan.updatedAt.slice(0, 10)}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    <L
                      en={`${Array.from({ length: 16 }, (_, i) => {
                        const s = plan.sections[String(i + 1)];
                        return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
                      }).filter(Boolean).length} of 16 sections addressed`}
                      ar={`${Array.from({ length: 16 }, (_, i) => {
                        const s = plan.sections[String(i + 1)];
                        return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
                      }).filter(Boolean).length} من 16 قسماً مُعالَج`}
                    />
                  </span>
                </div>
              ) : null}
              {priorVersions.map((v) => {
                const addressed = Array.from({ length: 16 }, (_, i) => {
                  const s = v.sections[String(i + 1)];
                  return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
                }).filter(Boolean).length;
                return (
                  <details key={`${v.version}-${v.savedAt}`} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: '13.5px' }}>
                    <summary style={{ cursor: 'pointer', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>
                        <L en={`Version ${v.version}`} ar={`النسخة ${v.version}`} />
                      </span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v.savedAt.slice(0, 10)}</span>
                      <span style={{ color: 'var(--muted)' }}>
                        <L en={`${addressed} of 16 sections addressed`} ar={`${addressed} من 16 قسماً مُعالَج`} />
                      </span>
                    </summary>
                    <div style={{ marginBlockStart: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {PLAN_SECTIONS.map((s) => {
                        const sec = v.sections[String(s.n)];
                        if (!sec?.text && sec?.covered !== true) return null;
                        return (
                          <div key={s.n} style={{ borderInlineStart: '2px solid var(--line)', paddingInlineStart: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {s.n}. <L en={s.en} ar={s.ar} />
                            </div>
                            {sec?.text ? (
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{sec.text}</div>
                            ) : (
                              <div style={{ color: 'var(--muted)' }}>
                                <L en="Confirmed covered in the attached document" ar="مؤكَّد أنه مشمول في المستند المرفق" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${id}/requirements`,
              en: 'Requirements and attachments',
              ar: 'المتطلبات والمرفقات',
              descEn: 'Documents, named providers, requirements you certify to, inspections.',
              descAr: 'المستندات والمزوّدون المُسمّون والمتطلبات التي تصدّقون عليها والتفتيش.',
            },
            {
              href: `/events/${id}/submit`,
              en: 'Submission package',
              ar: 'حزمة التقديم',
              descEn: 'The compliance form and the package, completed on the platform.',
              descAr: 'نموذج الامتثال والحزمة، يُستكملان على المنصة.',
              primary: true,
            },
          ]}
        />
      </main>
    </>
  );
}
