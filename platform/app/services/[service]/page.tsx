import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { L } from '../../../components/L';
import { PublicShell } from '../../../components/PublicShell';
import { currentAccount } from '../../../lib/auth';
import { AdFooter } from '../../../components/AdFooter';
import { InfoNote } from '../../../components/InfoNote';
import { capabilityConfigFor, ministryConfig } from '../../../lib/queries';
import { ShowMoreList, ShowMoreText } from '../../../components/ShowMore';
import { publishedCycles } from '../../../lib/queries';
import {
  DOMAINS,
  PUBLIC_LANDING,
  filingDeadlineRule,
  effectiveFlag,
  facilityCategoryText,
  serviceFeeLines,
  type FeeService,
} from '../../../lib/rules';

/**
 * THE TWO SERVICE DETAIL SCREENS (owner, 9 October 2026: two services -- register an event;
 * register a facility/site). Hosting venue registration is replaced by Facility/Site
 * registration: the old venue page's address leads to the facility/site page.
 *
 * One route with two subjects rather than two routes, because they answer the same
 * question about two instruments: what is this, what does it ask of you, and what
 * happens between registering and being done.
 *
 * THE FACTS ARE DERIVED, NOT DESCRIBED. The document counts come from the attachments
 * catalogue, the requirement counts from the requirements matrix, the domains from the
 * assessment data, the categories from the facility data. A public page that describes
 * the regulation in its own words is a second copy of the regulation, and the two drift
 * -- which is the defect this build has spent a week finding in smaller forms. What a
 * person reads here is what the platform will actually ask them for.
 */

const SERVICES = ['certify-an-event', 'register-a-facility'] as const;
type Service = (typeof SERVICES)[number];

/**
 * DYNAMIC, DELIBERATELY (deployment fix, 2026-09-04). The fee line reads the
 * capability configuration from the database, so this page stopped being
 * prerenderable the day the fee rule landed: at build time the deployment's
 * volume is not mounted, the database cannot open, and the prerender fails the
 * whole build -- which is exactly what happened on the first deploy after the
 * fees commit. Static rendering was also quietly wrong: a prerendered fee line
 * would freeze at build and never reflect a configuration change.
 */
export const dynamic = 'force-dynamic';

export default async function ServiceDetailPage({ params }: { params: Promise<{ service: string }> }) {
  const account = await currentAccount();
  const { service } = await params;
  // Hosting venue registration is replaced by Facility/Site registration: an old link lands there.
  if (service === 'register-a-venue') redirect('/services/register-a-facility');
  if (!(SERVICES as readonly string[]).includes(service)) notFound();
  const key = service as Service;
  const destination = key === 'certify-an-event' ? '/events/new' : '/facilities/new';
  const P = PUBLIC_LANDING;

  const def = P.services.find(
    (s) => (s.k === 'certify' && key === 'certify-an-event') || (s.k === 'facility' && key === 'register-a-facility'),
  )!;

  const h2: React.CSSProperties = { margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' };
  const section: React.CSSProperties = { paddingBlock: '28px', borderBlockStart: '1px solid var(--line)' };
  const dotRow: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'baseline', paddingBlock: 16, borderBlockEnd: '1px solid var(--line)', fontSize: 17, lineHeight: 1.5 };
  const dot = <span aria-hidden="true" style={{ flex: 'none', inlineSize: 10, blockSize: 10, borderRadius: 999, background: 'var(--accent)', transform: 'translateY(-1px)' }} />;

  // One flow per service, from the data. The end state differs; the shape does not.
  const flowKey = key === 'certify-an-event' ? 'certify' : 'facility';
  const flow = (P.flows as Record<string, { n: number; en: string; ar: string }[]>)[flowKey] ?? [];
  const flowTitle = (P.flowTitles as Record<string, { en: string; ar: string }>)[flowKey]!;
  const fees = serviceFeeLines(
    (key === 'certify-an-event' ? 'certifyEvent' : 'registerFacility') as FeeService,
    effectiveFlag('applicationFees', new Map([...ministryConfig()].map(([k, v]) => [k, v.value]))),
    capabilityConfigFor('applicationFees'),
  );

  // WHAT YOU WILL NEED (TAMM's "Required documents"): the service's own list, and for an event
  // what each level adds -- the level is set by the assessment, so the list says so.
  const needs = [
    ...def.needs.map((n) => <span key={n.en} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>{dot}<L en={n.en} ar={n.ar} /></span>),
    ...(key === 'certify-an-event'
      ? P.levelPackages.map((p) => (
        <span key={p.level} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          {dot}
          <span><strong style={{ fontWeight: 600 }}><L en={`Level ${p.level}: `} ar={`المستوى ${p.level}: `} /></strong><L en={p.en} ar={p.ar} /></span>
        </span>
      ))
      : []),
  ];

  // THE TIME LINE OF THE SUMMARY, from the configuration: the filing lead times by level for an
  // event, the drill cycle for a site. Never a fixed number in copy (non-negotiable 3).
  const leads = ([1, 2, 3] as const).map((l) => filingDeadlineRule(l).leadTimeDays);
  const months = publishedCycles().annualMonths;
  const timeLine = key === 'certify-an-event'
    ? { en: `File ${Math.min(...leads)} to ${Math.max(...leads)} days before the event, by level`, ar: `التقديم قبل الفعالية بـ${Math.min(...leads)} إلى ${Math.max(...leads)} يوماً بحسب المستوى` }
    : { en: `Kept up to date, with a practical drill every ${months} months`, ar: `يُحدَّث باستمرار، مع تمرين عملي كل ${months} شهراً` };
  const startHref = account ? destination : `/signin?next=${encodeURIComponent(destination)}`;

  const summary = (
    <div data-region="service-summary" data-noprint="" style={{ position: 'sticky', insetBlockEnd: 0, zIndex: 40, background: 'var(--surface2)', borderBlockStart: '1px solid var(--line)', boxShadow: '0 -6px 24px rgba(16,24,40,.06)' }}>
      <div data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '20px 32px 22px', display: 'flex', flexWrap: 'wrap', gap: '14px 32px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 8 }}><L en={def.en} ar={def.ar} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', fontSize: 15.5, color: 'var(--ink)' }}>
            <span data-summary="time" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <L en={timeLine.en} ar={timeLine.ar} />
            </span>
            <span data-summary="fee" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
              {fees.map((f) => <L key={f.en} en={f.en} ar={f.ar} />)}
            </span>
          </div>
        </div>
        <Link href={startHref} data-region="service-start" style={{ flex: '1 1 260px', maxWidth: 520, minHeight: 52, paddingInline: 28, borderRadius: 26, background: 'var(--brand)', color: '#fff', fontSize: 18, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <L en={account ? 'Start' : 'Sign in to start'} ar={account ? 'ابدأ' : 'سجّلوا الدخول للبدء'} />
        </Link>
      </div>
    </div>
  );

  return (
    <PublicShell signedIn={account !== null} bottomBar={summary}>
      <div style={{ maxWidth: 820 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, color: 'var(--brand)' }}>
          <svg aria-hidden="true" data-flip="" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          <L en="Services" ar="الخدمات" />
        </Link>
        <h1 data-sec-h1="" data-region="service-detail" style={{ margin: '18px 0 16px', fontSize: 40, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15 }}>
          <L en={def.en} ar={def.ar} />
        </h1>

        {/* THE SERVICE IN PLAIN WORDS (owner, 10 October 2026: "see how theirs is very
            straightforward"): what the service does for the person, in one paragraph. */}
        <ShowMoreText region="service-intro" lines={4}>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 600 }}><L en={`${def.en}: `} ar={`${def.ar}: `} /></strong>
            <L en={def.introEn} ar={def.introAr} />
          </p>
        </ShowMoreText>
        <p style={{ margin: '4px 0 0', fontSize: 15.5 }}>
          <Link href="/applicability" style={{ color: 'var(--brand)' }}><L en="Check whether this applies to you" ar="التحقق من انطباق هذا عليكم" /></Link>
        </p>

        {/* WHO ISSUES IT. */}
        <div data-region="service-authority" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBlock: '28px 0', paddingBlock: 20, borderBlockStart: '1px solid var(--line)' }}>
          <span aria-hidden="true" style={{ flex: 'none', inlineSize: 52, blockSize: 52, borderRadius: 999, background: 'var(--surface2)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 300 }}>+</span>
          <span style={{ fontSize: 18 }}><L en="Ministry of Public Health" ar="وزارة الصحة العامة" /></span>
        </div>

        {/* WHAT YOU WILL NEED. */}
        <section style={section}>
          <h2 style={h2}><L en="What you will need" ar="ما ستحتاجون إليه" /></h2>
          <p style={{ margin: '0 0 4px', fontSize: 17, lineHeight: 1.55 }}>
            {key === 'certify-an-event'
              ? <L en="The following are asked for during the application. What else is needed depends on the event’s level, which the assessment sets." ar="يُطلب ما يلي أثناء الطلب. ويتوقف ما يُطلب إضافةً إلى ذلك على مستوى الفعالية الذي يحدّده التقييم." />
              : <L en="The following are asked for during the application." ar="يُطلب ما يلي أثناء الطلب." />}
          </p>
          <ShowMoreList region={key === 'certify-an-event' ? 'documents-by-level' : 'service-needs'} items={needs.map((n, i) => <div key={i} style={dotRow}>{n}</div>)} />
          {key === 'certify-an-event' ? (
            <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--muted)' }}><L en={P.levelPackagesNoteEn} ar={P.levelPackagesNoteAr} /></p>
          ) : null}
        </section>

        {/* COST. The fee line derives (application-fees capability): while the capability is off
            -- the shipped state -- it reads `Fee: None.`, in exactly those words (non-negotiable 12). */}
        <section style={section}>
          <h2 style={h2}><L en="Cost" ar="التكلفة" /></h2>
          <div data-region="fee-lines">
            {fees.map((line) => (
              <p key={line.en} style={{ margin: 0, paddingBlock: 8, fontSize: 17 }}>
                <L en={line.en} ar={line.ar} />
              </p>
            ))}
          </div>
        </section>

        {/* THE STEPS, numbered, the line joining them -- the end state differs by service. */}
        <section style={section}>
          <h2 style={h2}><L en={flowTitle.en} ar={flowTitle.ar} /></h2>
          <ShowMoreList
            region="flow"
            items={flow.map((step, i) => (
              <div key={step.n} style={{ position: 'relative', display: 'flex', gap: 18, paddingBlockEnd: i === flow.length - 1 ? 4 : 26 }}>
                {i < flow.length - 1 ? <span aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 15, insetBlockStart: 38, insetBlockEnd: 4, inlineSize: 2, background: 'var(--line)' }} /> : null}
                <span style={{ flex: 'none', inlineSize: 32, blockSize: 32, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{step.n}</span>
                <span style={{ fontSize: 17, lineHeight: 1.55, paddingBlockStart: 3 }}><L en={step.en} ar={step.ar} /></span>
              </div>
            ))}
          />
        </section>

        {/* THE DETAIL, folded: the assessment's subjects for an event; for a site, who must
            register (each category with its rule) and what keeping it ready means. */}
        {key === 'certify-an-event' ? (
          <Folded titleEn="What the assessment covers" titleAr="ما يشمله التقييم">
            <div data-region="domains">
              {DOMAINS.map((d) => (
                <div key={d.number} style={{ display: 'flex', gap: 14, paddingBlock: 12, borderBlockEnd: '1px solid var(--line)', fontSize: 16 }}>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minInlineSize: 18 }}>{d.number}</span>
                  <L en={d.en} ar={d.ar} />
                </div>
              ))}
            </div>
          </Folded>
        ) : (
          <>
            <Folded titleEn={P.coveredTitleEn} titleAr={P.coveredTitleAr}>
              {/* CPR and AED defined once, at first use, behind an information control. */}
              <p data-region="term-definitions" style={{ margin: '0 0 8px', fontSize: '14.5px', lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
                {P.termDefinitions.map((t) => (
                  <span key={t.term}>
                    <L en={t.en} ar={t.ar} />
                    <InfoNote><L en={t.noteEn} ar={t.noteAr} /></InfoNote>
                  </span>
                ))}
              </p>
              <div data-region="facility-categories">
                {P.facilityCategories.map((c, i) => (
                  <div key={i} style={{ paddingBlock: 12, borderBlockEnd: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}><L en={facilityCategoryText(c).en} ar={facilityCategoryText(c).ar} /></div>
                    <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.6 }}><L en={c.ruleEn} ar={c.ruleAr} /></div>
                  </div>
                ))}
              </div>
            </Folded>
            <Folded titleEn={P.obligationsTitleEn} titleAr={P.obligationsTitleAr}>
              <div data-region="facility-obligations">
                {P.facilityObligations.map((o) => (
                  <div key={o.en} style={{ paddingBlock: 12, borderBlockEnd: '1px solid var(--line)', fontSize: 16 }}><L en={o.en} ar={o.ar} /></div>
                ))}
              </div>
            </Folded>
          </>
        )}
      </div>

      <AdFooter placement="serviceDetail" />
    </PublicShell>
  );
}

/** A section folded under its title with "View", as TAMM folds its terms of service. */
function Folded({ titleEn, titleAr, children }: { titleEn: string; titleAr: string; children: React.ReactNode }) {
  return (
    <details data-region="service-folded" style={{ paddingBlock: '28px 8px', borderBlockStart: '1px solid var(--line)' }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <span style={{ display: 'block', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', marginBlockEnd: 10 }}><L en={titleEn} ar={titleAr} /></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minBlockSize: 44, color: 'var(--brand)', fontSize: 16, fontWeight: 500 }}>
          <L en="View" ar="عرض" />
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
        </span>
      </summary>
      <div style={{ paddingBlockEnd: 12 }}>{children}</div>
    </details>
  );
}
