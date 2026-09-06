import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import {
  DECLARATION_ITEMS,
  DECLARATION_ITEM_DIVERGENCES,
  ROLES_CONTENT,
  GUIDANCE_DEPTH,
  GUIDANCE_TEMPLATE,
  GUIDANCE_WORKFLOW,
  MAJOR_INCIDENT_ITEMS,
  PLAN_SECTIONS,
} from '../../lib/rules';

/**
 * THE ONE REFERENCE PAGE (fields-only ruling, 2026-09-04). An end-user page
 * carries the fields the user fills, the action they take, and nothing else;
 * everything explanatory that used to ride the forms lives here instead,
 * reached by the Need help link in the footer of every page. The content is
 * the same lib/rules data the forms used to render -- nothing was retyped, so
 * nothing can drift.
 */
export default async function HelpPage() {
  const account = await currentAccount();
  const h2: React.CSSProperties = { margin: '40px 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' };
  const h3: React.CSSProperties = { margin: '24px 0 8px', fontSize: 16, fontWeight: 600 };
  const p: React.CSSProperties = { margin: '0 0 10px', fontSize: '14.5px', lineHeight: 1.7, maxWidth: '74ch' };
  const cell: React.CSSProperties = { background: 'var(--bg)', padding: '12px 16px', fontSize: '13.5px', lineHeight: 1.5 };

  return (
    <PublicShell signedIn={account !== null}>
      <h1 data-sec-h1="" data-region="help" style={{ margin: '10px 0 10px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Reference" ar="المرجع" />
      </h1>
      <p style={{ ...p, color: 'var(--muted)', marginBlockEnd: 4 }}>
        <L
          en="Everything explanatory lives on this page, so the forms carry only their fields."
          ar="كل ما هو شرحي يقيم في هذه الصفحة، لتحمل النماذج حقولها فقط."
        />
      </p>

      <h2 id="plan" style={h2}>
        <L en="The event health and medical plan" ar="خطة التأهب الصحي والطبي للفعالية" />
      </h2>
      <p style={p}>
        <L
          en="Write the plan on the platform, or attach the document you already hold and confirm which sections it covers. At Level 1 the requirement is brief written arrangements — usually one page; the requirements call this documented medical arrangements, not a plan, and a Level 1 arrangement should not become a lengthy manual."
          ar="اكتبوا الخطة على المنصة، أو أرفقوا المستند الذي تملكونه وأكّدوا أي البنود يغطيه. في المستوى 1 المطلوب ترتيبات مكتوبة موجزة — عادةً صفحة واحدة؛ وتسمّيها المتطلبات ترتيبات طبية موثقة لا خطة، ولا ينبغي أن يصير ترتيب المستوى 1 دليلاً مطوّلاً."
        />
      </p>
      <p style={p}>
        <L
          en="The Guidance for Preparing Event Health & Medical Plans is non-binding and creates no additional legal requirements. The Protocol and the minimum requirements define what is mandatory."
          ar="إرشادات إعداد خطط التأهب الصحي والطبي للفعاليات غير ملزمة ولا تنشئ أي متطلبات قانونية إضافية. والبروتوكول والحد الأدنى للمتطلبات هما ما يحدد الإلزامي."
        />
      </p>

      <h3 style={h3}>
        <L en="What each of the sixteen sections asks for" ar="ما يطلبه كل بند من البنود الستة عشر" />
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {PLAN_SECTIONS.map((s) => (
          <div key={s.n} style={cell}>
            <div style={{ fontWeight: 500 }}>
              {s.n}. <L en={s.en} ar={s.ar} />
            </div>
            <div style={{ color: 'var(--muted)', marginBlockStart: 3, lineHeight: 1.6 }}>
              <L en={s.bodyEn} ar={s.bodyAr} />
            </div>
          </div>
        ))}
      </div>

      <h3 style={h3}>
        <L en="The major-incident and mass-casualty plan" ar="خطة الحوادث الجسيمة وحوادث الإصابات الجماعية" />
      </h3>
      <p style={p}>
        <L
          en="At Level 2 and 3 the plan must identify eleven items, set by the Protocol; the plan form lists them as checkboxes to confirm against your plan."
          ar="في المستويين 2 و3 يجب أن تحدد الخطة أحد عشر بنداً يقررها البروتوكول؛ ويعرضها نموذج الخطة كمربعات تأكيد مقابل خطتكم."
        />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {MAJOR_INCIDENT_ITEMS.map((m) => (
          <div key={m.n} style={cell}>
            {m.n}. <L en={m.en} ar={m.ar} />
          </div>
        ))}
      </div>

      <h3 style={h3}>
        <L en="A planning workflow you may follow" ar="مسار تخطيط يمكنكم اتباعه" />
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {GUIDANCE_WORKFLOW.steps.map((w) => (
          <div key={w.n} style={cell}>
            {w.n}. <L en={w.en} ar={w.ar} />
          </div>
        ))}
      </div>

      <h3 style={h3}>
        <L en="A fourteen-section structure you may follow" ar="هيكل من أربعة عشر قسماً يمكنكم اتباعه" />
      </h3>
      <p style={p}>
        <L en={GUIDANCE_TEMPLATE.nonBindingEn} ar={GUIDANCE_TEMPLATE.nonBindingAr} />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {GUIDANCE_TEMPLATE.sections.map((t) => (
          <div key={t.n} style={cell}>
            {t.n}. <L en={t.en} ar={t.ar} />
          </div>
        ))}
      </div>

      <h3 style={h3}>
        <L en="Planning depth by event level" ar="عمق التخطيط بحسب مستوى الفعالية" />
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden', minWidth: 640 }}>
          {([['Planning element', 'عنصر التخطيط'], ['Level 1', 'المستوى 1'], ['Level 2', 'المستوى 2'], ['Level 3', 'المستوى 3']] as const).map(([en, ar]) => (
            <div key={en} style={{ ...cell, background: 'var(--surface2)', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              <L en={en} ar={ar} />
            </div>
          ))}
          {GUIDANCE_DEPTH.rows.map((d) => (
            <div key={d.en} style={{ display: 'contents' }}>
              <div style={cell}><L en={d.en} ar={d.ar} /></div>
              <div style={{ ...cell, color: 'var(--muted)' }}><L en={d.l1En} ar={d.l1Ar} /></div>
              <div style={{ ...cell, color: 'var(--muted)' }}><L en={d.l2En} ar={d.l2Ar} /></div>
              <div style={{ ...cell, color: 'var(--muted)' }}><L en={d.l3En} ar={d.l3Ar} /></div>
            </div>
          ))}
        </div>
      </div>

      <h2 id="ems-declaration" style={h2}>
        <L en="The EMS Readiness Declaration" ar="إقرار جاهزية خدمات الطوارئ الطبية" />
      </h2>
      <p style={p}>
        <L
          en="Completed and signed by each participating agency separately. What the agency accepts by signing:"
          ar="تستكمله وتوقّعه كل جهة مشاركة على حدة. وما تقبله الجهة بتوقيعها:"
        />
      </p>
      <p style={{ ...p, fontWeight: 500 }}>
        <L en={ROLES_CONTENT.ems.responsibilitySentence.en} ar={ROLES_CONTENT.ems.responsibilitySentence.ar} />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockStart: 12 }}>
        {DECLARATION_ITEMS.map((item, i) => (
          <div key={i} style={cell}>
            {i + 1}. <L en={item.en} ar={item.ar} />
          </div>
        ))}
      </div>
      {DECLARATION_ITEM_DIVERGENCES.length > 0 ? (
        <p style={{ ...p, color: 'var(--muted)', fontSize: '12.5px', marginBlockStart: 12 }}>
          <L
            en="Where the two issues of the instrument differ on these items, the English governs and the difference is recorded for the Ministry."
            ar="حيث يختلف إصدارا الأداة في هذه البنود، يُعتمد النص الإنكليزي ويُسجَّل الفرق للوزارة."
          />
        </p>
      ) : null}

      <h2 id="director" style={h2}>
        <L en="The Event Medical Director" ar="المدير الطبي للفعالية" />
      </h2>
      <p style={p}>
        <L en={ROLES_CONTENT.director.govIntro.en} ar={ROLES_CONTENT.director.govIntro.ar} />
      </p>
      <p style={p}>
        <L en={ROLES_CONTENT.director.reportIntro.en} ar={ROLES_CONTENT.director.reportIntro.ar} />
      </p>

      <h2 id="submission" style={h2}>
        <L en="The submission package" ar="حزمة التقديم" />
      </h2>
      <p style={p}>
        <L
          en="Every field on the compliance and submission form is required unless marked optional. The form saves as you type; filing becomes available when every outstanding item on the package clears, and each outstanding item links to the screen that clears it."
          ar="كل حقل في نموذج الامتثال والتقديم مطلوب إلا ما وُسم اختيارياً. يُحفظ النموذج أثناء الكتابة؛ ويتاح التقديم عند استيفاء كل بند عالق في الحزمة، وكل بند عالق يقود إلى الشاشة التي تستوفيه."
        />
      </p>

      <h2 id="referenced-facility" style={h2}>
        <L en="Referencing a registered facility" ar="الإحالة إلى منشأة مسجّلة" />
      </h2>
      <p style={p}>
        <L
          en="Where the venue is itself a registered covered facility, its defibrillators, trained responders and cardiac arrangements can be referenced in the plan rather than entered again. The confirmation is yours for each event — it is not inherited from the facility's registration — and where the event requires more than the facility provides, the shortfall surfaces by name and the higher requirement governs."
          ar="حيث يكون الموقع نفسه منشأة مشمولة مسجّلة، يمكن الإحالة في الخطة إلى أجهزتها ومستجيبيها المدرَّبين وترتيباتها القلبية بدلاً من إدخالها مجدداً. والتأكيد عليكم لكل فعالية — ولا يُورَث من تسجيل المنشأة — وحيث تتطلب الفعالية أكثر مما توفره المنشأة، يظهر النقص باسمه ويسري المتطلب الأعلى."
        />
      </p>
    </PublicShell>
  );
}
