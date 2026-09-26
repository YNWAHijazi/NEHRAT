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
        <L en="Help" ar="المساعدة" />
      </h1>
      <p style={{ ...p, color: 'var(--muted)', marginBlockEnd: 4 }}>
        <L
          en="Find help with plans, documents and submission here."
          ar="تجدون هنا إرشادات حول الخطط والمستندات وتقديم الطلبات."
        />
      </p>

      <h2 id="plan" style={h2}>
        <L en="The event health and medical plan" ar="خطة التأهب الصحي والطبي للفعالية" />
      </h2>
      <p style={p}>
        <L
          en="Write the plan here, or upload a plan and confirm the sections it covers. For Levels 1 and 2, the organizer completes it. For Level 3, the confirmed Medical Director or EMS agency completes it. For Level 1, keep the written medical arrangements brief—usually one page."
          ar="اكتبوا الخطة هنا أو ارفعوها وأكّدوا الأقسام التي تغطيها. في المستويين 1 و2، يُعدّها المنظّم. في المستوى 3، يُعدّها المدير الطبي أو جهة الإسعاف المؤكّدة. في المستوى 1، تكفي ترتيبات طبية مكتوبة موجزة، عادةً صفحة واحدة."
        />
      </p>
      <p style={p}>
        <L
          en="This guide helps you prepare the plan. It adds no new requirements. Follow the Protocol and the minimum requirements for your event level."
          ar="يساعدكم هذا الدليل على إعداد الخطة، ولا يضيف متطلبات جديدة. اتبعوا البروتوكول والحدّ الأدنى للمتطلبات بحسب مستوى فعاليتكم."
        />
      </p>

      <h3 style={h3}>
        <L en="What to include in each section" ar="ما يجب إدراجه في كل قسم" />
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
          en="Level 3 requires the major-incident checklist. The confirmed Medical Director or EMS agency completes it. For Level 2, it is recommended, not required. Level 1 does not require it."
          ar="تُلزم القائمة الخاصة بالحوادث الجسيمة للمستوى 3، ويستكملها المدير الطبي أو جهة الإسعاف المؤكّدة. وهي موصى بها وليست إلزامية للمستوى 2، وغير مطلوبة للمستوى 1."
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
        <L en="Steps to prepare your plan" ar="خطوات إعداد الخطة" />
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {GUIDANCE_WORKFLOW.steps.map((w) => (
          <div key={w.n} style={cell}>
            {w.n}. <L en={w.en} ar={w.ar} />
          </div>
        ))}
      </div>

      <h3 style={h3}>
        <L en="Optional plan outline" ar="نموذج اختياري للخطة" />
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
        <L en="What to include at each level" ar="ما يجب إدراجه في كل مستوى" />
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
          en="For Level 3, each EMS agency completes and signs its own declaration. By signing, the agency agrees to the following:"
          ar="في المستوى 3، تستكمل كل جهة إسعاف إقرارها وتوقّعه بشكل منفصل. بالتوقيع، توافق الجهة على ما يلي:"
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
            en="If the English and Arabic source documents differ, the English text applies. The Ministry can review the difference."
            ar="إذا اختلف النصان الإنكليزي والعربي في المستندات الأصلية، يُعتمد النص الإنكليزي. ويمكن للوزارة مراجعة الاختلاف."
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
          en="Fill in all fields unless marked optional. Your answers save as you type. Complete the pending items to submit. Each pending item links to the page you need."
          ar="املؤوا كل الحقول ما لم تكن اختيارية. تُحفظ الإجابات أثناء الكتابة. أكملوا البنود المعلّقة لتقديم الطلب. يرتبط كل بند معلّق بالصفحة المطلوبة."
        />
      </p>

      <h2 id="referenced-facility" style={h2}>
        <L en="Referencing a registered facility" ar="الإحالة إلى منشأة مسجّلة" />
      </h2>
      <p style={p}>
        <L
          en="You can link a registered facility’s AEDs, trained responders and response plan. Check that they will be available for this event. Add any extra cover your event needs. Facility registration alone does not confirm event readiness."
          ar="يمكنكم ربط أجهزة مزيل الرجفان والمسعفين المدرّبين وخطة الاستجابة لمنشأة مسجّلة. تحقّقوا من توافرها لهذه الفعالية وأضيفوا أي تغطية إضافية مطلوبة. تسجيل المنشأة وحده لا يؤكّد جاهزية الفعالية."
        />
      </p>
    </PublicShell>
  );
}
