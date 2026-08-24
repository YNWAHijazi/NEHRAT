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
  planFor,
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
        />

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
