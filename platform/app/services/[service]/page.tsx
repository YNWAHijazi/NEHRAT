import Link from 'next/link';
import { notFound } from 'next/navigation';
import { L } from '../../../components/L';
import { PublicShell } from '../../../components/PublicShell';
import { currentAccount } from '../../../lib/auth';
import {
  DOMAINS,
  FACILITY_CONTENT,
  PUBLIC_LANDING,
  documentsForLevel,
  requirementsForLevel,
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
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
        <L en="Fee: None." ar="الرسم: لا يوجد." />
      </p>

      {key === 'certify-an-event' ? (
        <>
          <h2 style={h2}>
            <L en="What the assessment covers" ar="ما يشمله التقييم" />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
            <L en={P.levelBodyEn} ar={P.levelBodyAr} />
          </p>
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

          <h2 style={h2}>
            <L en="From registration to reference number" ar="من التسجيل إلى الرقم المرجعي" />
          </h2>
          <ol data-region="sequence" style={{ margin: 0, paddingInlineStart: 22, fontSize: '14.5px', lineHeight: 1.9 }}>
            {[
              ['Register your organization', 'سجّلوا مؤسستكم'],
              ['Create the event and complete the assessment', 'أنشئوا الفعالية واستكملوا التقييم'],
              ['The level derives — it is never chosen', 'يُشتق المستوى — ولا يُختار أبداً'],
              ['Name the parties your level requires', 'سمّوا الأطراف التي يستلزمها مستواكم'],
              ['Attach what the level asks for and write the plan', 'أرفقوا ما يطلبه المستوى واكتبوا الخطة'],
              ['File before your deadline', 'قدّموا قبل انتهاء مهلتكم'],
              ['Receive a Ministry reference number', 'تستلمون رقماً مرجعياً من الوزارة'],
              ['The Ministry records a determination', 'تسجّل الوزارة نتيجة'],
            ].map(([en, ar]) => (
              <li key={en}>
                <L en={en!} ar={ar!} />
              </li>
            ))}
          </ol>
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
          <h2 style={h2}>
            <L en="From registration to classification" ar="من التسجيل إلى التصنيف" />
          </h2>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, maxWidth: '80ch' }}>
            <L
              en="A recurring venue is registered once and classified annually. The classification does not set the level of an individual event held there; each event carries its own assessment."
              ar="يُسجَّل الموقع المتكرر مرة واحدة ويُصنَّف سنوياً. ولا يحدد التصنيف مستوى أي فعالية فردية تُقام فيه؛ فلكل فعالية تقييمها الخاص."
            />
          </p>
        </>
      ) : null}

      {key === 'register-a-facility' ? (
        <>
          <h2 style={h2}>
            <L en="Which category does the place fall into" ar="في أي فئة يندرج المكان" />
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
            <L
              en="Facilities are not scored. The category decides the rule, and for some categories the Ministry has not yet set the value the rule turns on."
              ar="لا تُقيَّم المنشآت بالنتيجة. فالفئة تحدد القاعدة، وفي بعض الفئات لم تحدد الوزارة بعد القيمة التي تتوقف عليها القاعدة."
            />
          </p>
          <div data-region="facility-categories" style={listBox}>
            {FACILITY_CONTENT.categories.map((c) => (
              <div key={c.key} style={row}>
                <L en={c.en} ar={c.ar} />
              </div>
            ))}
          </div>
          <h2 style={h2}>
            <L en="Continuing obligations" ar="الموجبات المستمرة" />
          </h2>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, maxWidth: '80ch' }}>
            <L
              en="A covered facility registers the facility, its coordinator and each defibrillator, and keeps the cardiac emergency response plan current. Each device is one record, confirmed once a year."
              ar="تسجّل المنشأة المشمولة المنشأة ومنسّقها وكل جهاز إزالة رجفان، وتحفظ خطة الاستجابة لطوارئ القلب محدّثة. وكل جهاز سجل واحد يُؤكَّد مرة في السنة."
            />
          </p>
        </>
      ) : null}

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
