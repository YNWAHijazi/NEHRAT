import { InfoNote } from '../../../../components/InfoNote';
import { planAccess } from '../../../../lib/plan-access';
import { PLAN_DOC_KEY } from '../../../../lib/rules/uploads';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
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
import { GOVERNANCE_LANDING, MAJOR_INCIDENT_ITEMS, PLAN_SECTIONS, type Level } from '../../../../lib/rules';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const access = planAccess(account, id);
  if (!access) notFound();
  const ownerId = access.ownerId;
  const isEms = access.editor === 'ems';
  const event = eventFor(ownerId, id);
  if (!event) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = assessmentsFor(ownerId, id);
  const level = (versions[0]?.derivation.finalLevel ?? event.level) as Level | null;
  const priorVersions = isEms ? [] : planVersionsFor(ownerId, id);
  const fullGovernance = governanceFor(id);
  const governance = isEms ? { incidentRole: fullGovernance.incidentRole ?? '' } : fullGovernance;
  if (level === null) redirect(`/events/${id}`);

  const fullPlan = planFor(ownerId, id);
  const plan = isEms && fullPlan ? { ...fullPlan, mode: 'write' as const, sections: { '12': fullPlan.sections['12'] ?? {} }, attachedFile: null, attachedHasFile: false, refConfirmed: false, refAdmitsChildren: false, refTemporaryAreas: false } : fullPlan;
  const requiredSections = PLAN_SECTIONS.filter(s => isEms ? s.n === GOVERNANCE_LANDING.incidentSection : level === 3 || s.n !== GOVERNANCE_LANDING.incidentSection);
  // 12: renders only where the venue is itself a registered covered facility.
  const facility = !isEms && event.venueFacilityId ? facilityById(ownerId, event.venueFacilityId) : null;
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
        planConfirmed: facilityPlanConfirmation(facility.id)?.current === true,
      }
    : null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en={`${event.nameEn} · ${event.id} · Level ${level}`} ar={`${event.nameAr} · ${event.id} · المستوى ${level}`} />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 14px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en={isEms ? "Major-incident arrangements" : "Event health and medical plan"} ar={isEms ? "ترتيبات الحوادث الجسيمة" : "خطة التأهب الصحي والطبي للفعالية"} />
        </h1>
        {level === 3 ? <div className="secondary-help"><InfoNote><L en="The Medical Director leads medical planning. You share this plan; the organizer submits the package." ar="يقود المدير الطبي التخطيط الطبي. تعملون على خطة مشتركة، ويقدّم المنظّم الملف." /></InfoNote></div> : null}
        <PlanForm
          eventId={id}
          level={level}
          editor={access.editor}
          sectionsDef={requiredSections}
          miDef={[...MAJOR_INCIDENT_ITEMS]}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan ? (
                <div style={{ border: '1px solid var(--brand)', borderRadius: 10, padding: '10px 14px', fontSize: '13.5px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 500 }}>
                    <L en={`Version ${plan.version} — current`} ar={`النسخة ${plan.version} — الحالية`} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{plan.updatedAt.slice(0, 10)}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    <L
                      en={`${requiredSections.map((section) => {
                        const s = plan.sections[String(section.n)];
                        return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
                      }).filter(Boolean).length} of ${requiredSections.length} sections complete`}
                      ar={`${requiredSections.map((section) => {
                        const s = plan.sections[String(section.n)];
                        return Boolean(s?.text && s.text.trim() !== '') || s?.covered === true;
                      }).filter(Boolean).length} من ${requiredSections.length} أقسام مكتملة`}
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
                  <details key={`${v.version}-${v.savedAt}`} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 15px', fontSize: '13.5px' }}>
                    <summary style={{ cursor: 'pointer', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>
                        <L en={`Version ${v.version}`} ar={`النسخة ${v.version}`} />
                      </span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v.savedAt.slice(0, 10)}</span>
                      {v.savedBy ? <span>{v.savedBy}</span> : null}
                      <span style={{ color: 'var(--muted)' }}>
                        <L en={`${addressed} sections complete`} ar={`${addressed} أقسام مكتملة`} />
                      </span>
                    </summary>
                    <div style={{ marginBlockStart: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {v.attachedHasFile ? <a href={`/api/documents/${id}/${PLAN_DOC_KEY}?version=${v.version}`} target="_blank" rel="noopener noreferrer"><L en="Open this version’s attachment" ar="فتح مرفق هذه النسخة" /></a> : null}
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

      </main>
    </>
  );
}
