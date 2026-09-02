import Link from 'next/link';
import { notFound } from 'next/navigation';
import { L } from '../../../components/L';
import { PublicShell } from '../../../components/PublicShell';
import { currentAccount } from '../../../lib/auth';
import { capabilityConfigFor, ministryConfig } from '../../../lib/queries';
import {
  DOMAINS,
  FACILITY_CONTENT,
  PUBLIC_LANDING,
  documentsForLevel,
  effectiveFlag,
  requirementsForLevel,
  serviceFeeLines,
  type FeeService,
} from '../../../lib/rules';

/**
 * THE THREE SERVICE DETAIL SCREENS — Slice 0, screens 2, 4 and 5.
 *
 * One route with three subjects rather than three routes, because they answer the same
 * question about three instruments: what is this, what does it ask of you, and what
 * happens between registering and being done.
 *
 * THE FACTS ARE DERIVED, NOT DESCRIBED. The document counts come from the attachments
 * catalogue, the requirement counts from the requirements matrix, the domains from the
 * assessment data, the categories from the facility data. A public page that describes
 * the regulation in its own words is a second copy of the regulation, and the two drift
 * -- which is the defect this build has spent a week finding in smaller forms. What a
 * person reads here is what the platform will actually ask them for.
 */

const SERVICES = ['certify-an-event', 'register-a-venue', 'register-a-facility'] as const;
type Service = (typeof SERVICES)[number];

export function generateStaticParams(): { service: string }[] {
  return SERVICES.map((service) => ({ service }));
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ service: string }> }) {
  const account = await currentAccount();
  const { service } = await params;
  if (!(SERVICES as readonly string[]).includes(service)) notFound();
  const key = service as Service;
  const P = PUBLIC_LANDING;

  const def = P.services.find(
    (s) => (s.k === 'certify' && key === 'certify-an-event') ||
      (s.k === 'venue' && key === 'register-a-venue') ||
      (s.k === 'facility' && key === 'register-a-facility'),
  )!;

  const h2: React.CSSProperties = { margin: '36px 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' };
  const listBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden',
  };
  const row: React.CSSProperties = { background: 'var(--bg)', padding: '14px 18px', fontSize: '14.5px', lineHeight: 1.55 };

  // One flow per service, from the data. The end state differs; the shape does not.
  const flowKey = key === 'certify-an-event' ? 'certify' : key === 'register-a-venue' ? 'venue' : 'facility';
  const flow = (P.flows as Record<string, { n: number; en: string; ar: string }[]>)[flowKey] ?? [];
  const flowTitle = (P.flowTitles as Record<string, { en: string; ar: string }>)[flowKey]!;

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Overview" ar="نظرة عامة" />
      </Link>
      <h1 data-sec-h1="" data-region="service-detail" style={{ margin: '10px 0 12px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={def.en} ar={def.ar} />
      </h1>
      <p style={{ margin: '0 0 8px', fontSize: '17px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '70ch' }}>
        <L en={def.descEn} ar={def.descAr} />
      </p>
      {/* THE FEE LINE DERIVES (application-fees capability). While the capability
          is off -- the shipped state -- the rule returns the one line this page
          always carried: `Fee: None.`, in exactly those words (non-negotiable 12).
          With a fee in force the amount renders here, before an organizer starts,
          and again on the submission package as an amount due. */}
      <div data-region="fee-lines" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {serviceFeeLines(
          (key === 'certify-an-event' ? 'certifyEvent' : key === 'register-a-venue' ? 'registerVenue' : 'registerFacility') as FeeService,
          effectiveFlag('applicationFees', new Map([...ministryConfig()].map(([k, v]) => [k, v.value]))),
          capabilityConfigFor('applicationFees'),
        ).map((line) => (
          <p key={line.en} style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={line.en} ar={line.ar} />
          </p>
        ))}
      </div>

      {/* WHAT THE SERVICE COVERS. Each screen answers the same question in its own
          terms -- the event by its nine domains and its documents, the venue by the
          same nine answered for a routine session, the facility by category. All three
          then end with the same thing: a numbered flow from registration to the state
          the service produces. They had drifted into three different shapes, which
          made two of the three read as less considered than the first. */}
      {key === 'certify-an-event' ? (
        <>
          {/* The scoring-model paragraph left (partner ruling, second sweep): the
              assessment explains itself when taken, and a visitor reading the service
              needs the nine subjects, not the arithmetic. */}
          <h2 style={h2}>
            <L en="What the assessment covers" ar="ما يشمله التقييم" />
          </h2>
          <div data-region="domains" style={listBox}>
            {DOMAINS.map((d) => (
              <div key={d.number} style={row}>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 12 }}>{d.number}</span>
                <L en={d.en} ar={d.ar} />
              </div>
            ))}
          </div>

          <h2 style={h2}>
            <L en="Documents required at each level" ar="المستندات المطلوبة في كل مستوى" />
          </h2>
          <div data-region="documents-by-level" style={listBox}>
            {([1, 2, 3] as const).map((l) => (
              <div key={l} style={row}>
                <strong style={{ color: `var(--l${l})` }}>
                  <L en={`Level ${l}`} ar={`المستوى ${l}`} />
                </strong>
                <span style={{ color: 'var(--muted)' }}>
                  {' — '}
                  <L
                    en={`${documentsForLevel(l).filter((d) => !d.optional).length} documents, ${requirementsForLevel(l).length} requirements`}
                    ar={`⁦${documentsForLevel(l).filter((d) => !d.optional).length}⁩ مستندات، ⁦${requirementsForLevel(l).length}⁩ متطلباً`}
                  />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {key === 'register-a-venue' ? (
        <>
          <h2 style={h2}>
            <L en="Both conditions have to be met" ar="يجب استيفاء الشرطين معاً" />
          </h2>
          <div data-region="venue-conditions" style={listBox}>
            {P.venueConditions.slice(0, 2).map((c) => (
              <div key={c.k} style={row}>
                <L en={c.en} ar={c.ar} />
              </div>
            ))}
          </div>

          {/* The instrument-comparison paragraph left (partner ruling, second sweep):
              the nine subjects speak for themselves. */}
          <h2 style={h2}>
            <L en="What the assessment covers" ar="ما يشمله التقييم" />
          </h2>
          <div data-region="domains" style={listBox}>
            {DOMAINS.map((d) => (
              <div key={d.number} style={row}>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginInlineEnd: 12 }}>{d.number}</span>
                <L en={d.en} ar={d.ar} />
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '13.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
            <L en={P.venueFloorEn} ar={P.venueFloorAr} />
          </p>
        </>
      ) : null}

      {key === 'register-a-facility' ? (
        <>
          <h2 style={h2}>
            <L en={P.coveredTitleEn} ar={P.coveredTitleAr} />
          </h2>
          {/* The Ministry-configuration intro left (partner ruling, second sweep):
              each category row already says which Ministry value it turns on. */}
          {/* CATEGORY AND RULE TOGETHER. A list of categories alone tells an operator
              which box they are in and not what follows from it -- and for three of the
              six what follows is that the Ministry has not set a value yet. */}
          <div data-region="facility-categories" style={listBox}>
            {P.facilityCategories.map((c, i) => (
              <div key={i} style={row}>
                <div style={{ fontWeight: 500 }}>
                  <L en={c.en} ar={c.ar} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.6 }}>
                  <L en={c.ruleEn} ar={c.ruleAr} />
                </div>
              </div>
            ))}
          </div>

          <h2 style={h2}>
            <L en={P.obligationsTitleEn} ar={P.obligationsTitleAr} />
          </h2>
          <div data-region="facility-obligations" style={listBox}>
            {P.facilityObligations.map((o) => (
              <div key={o.en} style={row}>
                <L en={o.en} ar={o.ar} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* THE FLOW. Every service ends here, with the same table and a different end
          state: a reference number, a classification, a maintained record. */}
      <h2 style={h2}>
        <L en={flowTitle.en} ar={flowTitle.ar} />
      </h2>
      <div data-region="flow" style={listBox}>
        <div style={{ ...row, display: 'flex', gap: 16, background: 'var(--surface2)', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <span style={{ flex: 'none', minWidth: 40 }}>
            <L en={P.stepEn} ar={P.stepAr} />
          </span>
          <span>
            <L en={P.whatHappensEn} ar={P.whatHappensAr} />
          </span>
        </div>
        {flow.map((step) => (
          <div key={step.n} style={{ ...row, display: 'flex', gap: 16, alignItems: 'baseline' }}>
            <span style={{ flex: 'none', minWidth: 40, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{step.n}</span>
            <span>
              <L en={step.en} ar={step.ar} />
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBlockStart: 36 }}>
        <Link href="/applicability" style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', borderRadius: 22, fontSize: 14, display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en="Check whether this applies to you" ar="التحقق من انطباق هذا عليكم" />
        </Link>
        <Link href="/signin" style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
          <L en="Sign in to begin" ar="تسجيل الدخول للبدء" />
        </Link>
      </div>
    </PublicShell>
  );
}
