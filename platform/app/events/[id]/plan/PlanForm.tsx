'use client';

/**
 * The event health and medical plan (خطة التأهب الصحي والطبي للفعالية).
 *
 * Two routes -- write it here, or attach an existing document and confirm coverage
 * section by section. The sixteen items are the Protocol's mandatory checklist; the
 * Guidance material renders under a "Guidance" tag with the creates-no-requirements
 * label. At Level 1 the sixteen collapse behind the brief-written-arrangements note.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { savePlanAction, uploadPlanFileAction, type PlanPayload } from '../../../actions';
import { acceptAttribute, acceptHint } from '../../../../lib/rules/uploads';
import { FACILITY_CONTENT, referenceShortfalls, type ReferenceDeviceFacts , GOVERNANCE_LANDING } from '../../../../lib/rules';
import type { PlanRow, FacilityRow } from '../../../../lib/queries';

interface PlanSection {
  n: number;
  en: string;
  ar: string;
  bodyEn: string;
  bodyAr: string;
}

interface MiItem {
  n: number;
  en: string;
  ar: string;
}

interface TemplateSection {
  n: number;
  en: string;
  ar: string;
}

interface WorkflowStep {
  n: number;
  en: string;
  ar: string;
}

interface DepthRow {
  en: string;
  ar: string;
  l1En: string; l1Ar: string;
  l2En: string; l2Ar: string;
  l3En: string; l3Ar: string;
}

const chip = (state: 'done' | 'open'): { color: string; bg: string; en: string; ar: string } =>
  state === 'done'
    ? { color: 'var(--brand)', bg: 'var(--brand-soft)', en: 'Addressed', ar: 'معالَج' }
    : { color: 'var(--accent-ink)', bg: 'var(--accent-soft)', en: 'Open', ar: 'مفتوح' };

export function PlanForm({
  eventId,
  level,
  sectionsDef,
  miDef,
  template,
  workflow,
  workflowStage,
  depth,
  nonBindingEn,
  nonBindingAr,
  initial,
  facility,
  referenceFacts,
  governance,
}: {
  eventId: string;
  level: 1 | 2 | 3;
  sectionsDef: PlanSection[];
  miDef: MiItem[];
  template: TemplateSection[];
  workflow: WorkflowStep[];
  /** 1-8: where this event stands in the Guidance workflow; colours the step rail. */
  workflowStage: number;
  depth: DepthRow[];
  nonBindingEn: string;
  nonBindingAr: string;
  initial: PlanRow | null;
  facility: FacilityRow | null;
  referenceFacts: ReferenceDeviceFacts | null;
  /** The Event Medical Director's governance text: lands read-only in sections 10 and
   *  12 and beside the major-incident items -- exactly where the governance screen
   *  promises, and the organizer cannot overwrite it. */
  governance: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'write' | 'attach'>(initial?.mode ?? 'write');
  const [sections, setSections] = useState<Record<string, { text?: string; covered?: boolean }>>(
    initial?.sections ?? {},
  );
  const [mi, setMi] = useState<Record<string, { covered?: boolean }>>(initial?.majorIncident ?? {});
  const [attachedFile, setAttachedFile] = useState(initial?.attachedFile ?? '');
  // THE FILE ITSELF is stored, not its name (storage ruling, 2026-08-28), so the
  // picker uploads on change rather than waiting for Save: the plan payload is JSON
  // and a document does not travel in JSON. A refusal is shown where the picker is.
  const [uploadRefusal, setUploadRefusal] = useState<{ en: string; ar: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refConfirmed, setRefConfirmed] = useState(initial?.refConfirmed ?? false);
  const [refAdmitsChildren, setRefAdmitsChildren] = useState(initial?.refAdmitsChildren ?? false);
  const [refTemporaryAreas, setRefTemporaryAreas] = useState(initial?.refTemporaryAreas ?? false);
  const [open, setOpen] = useState<number>(-1);
  const [collapsed, setCollapsed] = useState(level === 1);
  const [saved, setSaved] = useState(false);

  const doneCount = useMemo(
    () =>
      sectionsDef.filter((s) => {
        const st = sections[String(s.n)];
        return mode === 'attach' ? st?.covered === true : Boolean(st?.text?.trim()) || st?.covered === true;
      }).length,
    [sections, sectionsDef, mode],
  );

  const save = () => {
    setSaved(false);
    startTransition(async () => {
      const payload: PlanPayload = {
        mode,
        refConfirmed,
        refAdmitsChildren,
        refTemporaryAreas,
        sections,
        attachedFile: mode === 'attach' ? attachedFile || null : null,
        majorIncident: mi,
      };
      const result = await savePlanAction(eventId, payload);
      if ('ok' in result) {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const routeCard = (
    which: 'write' | 'attach',
    titleEn: string,
    titleAr: string,
    bodyEn: string,
    bodyAr: string,
  ) => (
    <div style={{ padding: '26px 30px', border: `1px solid ${mode === which ? 'var(--brand)' : 'var(--line)'}`, background: mode === which ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en={titleEn} ar={titleAr} />
        </span>
        {mode === which ? (
          <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '12.5px' }}>
            <L en="In use" ar="مُستخدم" />
          </span>
        ) : null}
      </div>
      <p style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', flex: 1 }}>
        <L en={bodyEn} ar={bodyAr} />
      </p>
      <button
        type="button"
        onClick={() => setMode(which)}
        style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 21, fontSize: 14, cursor: 'pointer', alignSelf: 'start', marginBlockStart: 'auto' }}
      >
        <L en="Use this route" ar="اعتماد هذا المسار" />
      </button>
    </div>
  );

  return (
    <div>
      {level === 1 ? (
        <div style={{ padding: '32px 36px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 44, maxWidth: '84ch' }}>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 14 }}>
            <L en="At Level 1 the requirement is brief written arrangements — usually one page." ar="في المستوى 1 المطلوب ترتيبات مكتوبة موجزة — عادةً صفحة واحدة." />
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '15.5px', lineHeight: 1.75 }}>
            <L
              en="The requirements call this documented medical arrangements, not a plan. Do not turn a Level 1 arrangement into a lengthy manual."
              ar="تسمّيها المتطلبات ترتيبات طبية موثقة، لا خطة. ولا تحوّلوا ترتيب المستوى 1 إلى دليل مطوّل."
            />
          </p>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 21, fontSize: 14, cursor: 'pointer' }}
          >
            {collapsed ? <L en="Show the sixteen sections anyway" ar="إظهار البنود الستة عشر رغم ذلك" /> : <L en="Collapse the sixteen sections" ar="طي البنود الستة عشر" />}
          </button>
        </div>
      ) : null}

      <div data-wide="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBlockEnd: 44 }}>
        {routeCard('write', 'Write the plan here', 'كتابة الخطة هنا', 'Work through the sections below over time. The platform assembles them into the plan submitted with your package.', 'اعملوا على البنود أدناه على مدى الوقت. وتجمعها المنصة في الخطة المقدَّمة مع حزمتكم.')}
        {routeCard('attach', 'Attach an existing plan', 'إرفاق خطة قائمة', 'Attach the document you already hold and confirm which of the sections it covers.', 'أرفقوا المستند الذي تملكونه وأكّدوا أي البنود يغطيه.')}
      </div>

      {mode === 'attach' ? (
        <div style={{ padding: '29px 33px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 44 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 20 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                <L en="Attached plan" ar="الخطة المرفقة" />
              </div>
              <input
                type="file"
                accept={acceptAttribute()}
                disabled={uploading}
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (!chosen) return;
                  setUploadRefusal(null);
                  setUploading(true);
                  const data = new FormData();
                  data.set('file', chosen);
                  startTransition(async () => {
                    const result = await uploadPlanFileAction(eventId, data);
                    setUploading(false);
                    if ('ok' in result) {
                      setAttachedFile(result.fileName);
                      router.refresh();
                    } else {
                      setAttachedFile('');
                      setUploadRefusal({ en: result.en, ar: result.ar });
                    }
                  });
                }}
                aria-label="Attach the plan document"
                style={{ fontSize: 14, maxWidth: 380 }}
              />
              <div style={{ marginBlockStart: 6, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.55 }}>
                <L en={acceptHint().en} ar={acceptHint().ar} />
              </div>
              {uploadRefusal ? (
                <div
                  data-region="plan-upload-refused"
                  style={{ marginBlockStart: 8, padding: '10px 14px', background: 'var(--bad-soft)', border: '2px solid var(--bad)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.55 }}
                >
                  <L en={uploadRefusal.en} ar={uploadRefusal.ar} />
                </div>
              ) : null}
              {attachedFile ? (
                <div style={{ marginBlockStart: 8, fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                  <L en={`Attached: ${attachedFile}`} ar={`المرفق: ${attachedFile}`} />
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)' }}>
            <L
              en="Confirm coverage against each section below."
              ar="أكّدوا التغطية مقابل كل بند أدناه."
            />
          </div>
        </div>
      ) : null}

      {/* Guidance is guidance: tagged, and creates no requirements. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '17px 21px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20, maxWidth: '84ch' }}>
        <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <L en="Guidance" ar="إرشاد" />
        </span>
        <span style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)', flex: 1, minWidth: 240 }}>
          <L
            en="The Guidance for Preparing Event Health & Medical Plans is non-binding and creates no additional legal requirements. The Protocol and the minimum requirements define what is mandatory."
            ar="إرشادات إعداد خطط التأهب الصحي والطبي للفعاليات غير ملزمة ولا تنشئ أي متطلبات قانونية إضافية. والبروتوكول والحد الأدنى للمتطلبات هما ما يحدد الإلزامي."
          />
        </span>
      </div>

      {/* The eight-step planning workflow: Guidance, non-binding. */}
      <div data-region="workflow" style={{ background: 'var(--surface2)', borderRadius: 16, overflow: 'hidden', marginBlockEnd: 20, padding: 1 }}>
        <div style={{ padding: '14px 22px', background: 'var(--surface2)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Guidance" ar="إرشاد" />
          </span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <L en="Planning workflow" ar="مسار التخطيط" />
          </span>
        </div>
        <div style={{ padding: '24px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {workflow.map((w) => {
            const color = w.n < workflowStage ? 'var(--brand)' : w.n === workflowStage ? 'var(--accent)' : 'var(--line)';
            const ink = w.n <= workflowStage ? 'var(--ink)' : 'var(--muted)';
            return (
              <div key={w.n} style={{ paddingBlockStart: 12, borderBlockStart: `2px solid ${color}` }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: 5 }}>{w.n}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: ink }}>
                  <L en={w.en} ar={w.ar} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Planning depth by level: Guidance, non-binding. */}
      <div data-region="depth" style={{ background: 'var(--surface2)', borderRadius: 16, overflow: 'hidden', marginBlockEnd: 52, padding: 1 }}>
        <div style={{ padding: '14px 22px', background: 'var(--surface2)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Guidance" ar="إرشاد" />
          </span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <L en="Planning depth by event level" ar="عمق التخطيط بحسب مستوى الفعالية" />
          </span>
        </div>
        <div data-stack="" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)' }}>
          {(
            [
              ['Planning element', 'عنصر التخطيط'],
              ['Level 1', 'المستوى 1'],
              ['Level 2', 'المستوى 2'],
              ['Level 3', 'المستوى 3'],
            ] as const
          ).map(([enH, arH]) => (
            <div key={enH} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              <L en={enH} ar={arH} />
            </div>
          ))}
          {depth.map((d) => {
            const cell = (bodyEn: string, bodyAr: string, active: boolean) => (
              <div style={{ background: active ? 'var(--brand-soft)' : 'var(--bg)', padding: '14px 18px', fontSize: '13.5px', lineHeight: 1.5, color: active ? 'var(--ink)' : 'var(--muted)' }}>
                <L en={bodyEn} ar={bodyAr} />
              </div>
            );
            return (
              <div key={d.en} style={{ display: 'contents' }}>
                <div style={{ background: 'var(--bg)', padding: '14px 18px', fontSize: 14, lineHeight: 1.45 }}>
                  <L en={d.en} ar={d.ar} />
                </div>
                {cell(d.l1En, d.l1Ar, level === 1)}
                {cell(d.l2En, d.l2Ar, level === 2)}
                {cell(d.l3En, d.l3Ar, level === 3)}
              </div>
            );
          })}
        </div>
      </div>

      {/* The fourteen-section template: non-binding structure, labelled as such. */}
      <div style={{ background: 'var(--surface2)', borderRadius: 16, overflow: 'hidden', marginBlockEnd: 52, padding: 1 }}>
        <div style={{ padding: '14px 22px', background: 'var(--surface2)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en="Guidance" ar="إرشاد" />
          </span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <L en="A fourteen-section structure you may follow" ar="هيكل من أربعة عشر قسماً يمكنكم اتباعه" />
          </span>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '84ch' }}>
            <L en={nonBindingEn} ar={nonBindingAr} />
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {template.map((t) => (
              <div key={t.n} style={{ paddingBlockStart: 12, borderBlockStart: '2px solid var(--line)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: 5 }}>{t.n}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <L en={t.en} ar={t.ar} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 12: only where the venue is itself a registered covered facility. */}
      {facility ? (
        <div style={{ marginBlockEnd: 44 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Arrangements already registered at this venue" ar="الترتيبات المسجّلة أصلاً في هذا الموقع" />
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.6, color: 'var(--muted)', maxWidth: '76ch' }}>
            <L
              en={`${facility.nameEn} is a registered covered facility. Its defibrillators, trained responders and cardiac arrangements can be referenced in this plan rather than entered again.`}
              ar={`${facility.nameAr} مرفق مشمول مسجَّل. ويمكن الإحالة في هذه الخطة إلى أجهزته ومستجيبيه المدرَّبين وترتيباته القلبية بدلاً من إدخالها مجدداً.`}
            />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 16 }}>
            {[
              {
                en: 'Registered defibrillators', ar: 'أجهزة إزالة الرجفان المسجّلة',
                detailEn: `${facility.devices} registered devices${referenceFacts && referenceFacts.locationsEn.length ? ` — ${referenceFacts.locationsEn.join(', ')}` : ''}. Readiness dates live on the facility record.`,
                detailAr: `${facility.devices} أجهزة مسجّلة${referenceFacts && referenceFacts.locationsAr.length ? ` — ${referenceFacts.locationsAr.join('، ')}` : ''}. تواريخ الجاهزية في سجل المرفق.`,
              },
              {
                en: 'Facility readiness standing', ar: 'الحالة القائمة لجاهزية المرفق',
                detailEn: facility.stateEn, detailAr: facility.stateAr,
              },
              {
                en: 'Next readiness lapse', ar: 'أقرب انتهاء للجاهزية',
                detailEn: facility.nextLapse ?? '—', detailAr: facility.nextLapse ?? '—',
              },
            ].map((r) => (
              <div key={r.en} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: '15.5px', lineHeight: 1.45 }}>
                    <L en={r.en} ar={r.ar} />
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.5 }}>
                    <L en={r.detailEn} ar={r.detailAr} />
                  </div>
                </div>
                <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
                  <L en="Referenced" ar="مُحال إليه" />
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={refConfirmed}
            onClick={() => setRefConfirmed((v) => !v)}
            style={{ textAlign: 'start', width: '100%', display: 'flex', gap: 16, alignItems: 'start', padding: '22px 26px', background: refConfirmed ? 'var(--brand-soft)' : 'var(--surface)', border: `1px solid ${refConfirmed ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 16, cursor: 'pointer' }}
          >
            <span style={{ flex: 'none', width: 20, height: 20, border: `1.5px solid ${refConfirmed ? 'var(--brand)' : 'var(--muted)'}`, background: refConfirmed ? 'var(--brand)' : 'transparent', borderRadius: 4, marginBlockStart: 3 }} />
            <span>
              <span style={{ display: 'block', fontSize: 16, lineHeight: 1.55 }}>
                <L en="I confirm the referenced arrangements will remain accessible and operational throughout the event." ar="أؤكد أن الترتيبات المُحال إليها ستبقى متاحة للوصول وصالحة للعمل طوال الفعالية." />
              </span>
              <span style={{ display: 'block', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)', marginBlockStart: 6 }}>
                <L
                  en="This is yours to confirm for this event; it is not inherited from the facility's registration. Unconfirming and saving withdraws the reference from your plan."
                  ar="هذا التأكيد عليكم لهذه الفعالية؛ ولا يُورَث من تسجيل المرفق. وإلغاء التأكيد مع الحفظ يسحب الإحالة من خطتكم."
                />
              </span>
            </span>
          </button>

          {/* The two event facts the shortfalls derive from (ROADMAP 2e condition 2).
              Where the event requires more than the facility provides, the shortfall
              surfaces by name and the higher requirement governs -- derived, never
              asserted by hand. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockStart: 16 }}>
            {FACILITY_CONTENT.reference.questions.map((q) => {
              const on = q.key === 'admitsChildren' ? refAdmitsChildren : refTemporaryAreas;
              const toggle = q.key === 'admitsChildren' ? setRefAdmitsChildren : setRefTemporaryAreas;
              return (
                <button
                  key={q.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle((v) => !v)}
                  style={{ textAlign: 'start', display: 'flex', gap: 14, alignItems: 'center', padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}
                >
                  <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', borderRadius: 4 }} />
                  <span style={{ fontSize: '14.5px', lineHeight: 1.55 }}>
                    <L en={q.en} ar={q.ar} />
                  </span>
                </button>
              );
            })}
          </div>
          {referenceFacts
            ? referenceShortfalls(referenceFacts, {
                admitsChildren: refAdmitsChildren,
                temporaryAreas: refTemporaryAreas,
              }).map((s) => {
                const def = FACILITY_CONTENT.reference.shortfalls[s.key];
                return (
                  <div
                    key={s.key}
                    data-region="shortfall"
                    style={{ marginBlockStart: 12, padding: '20px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'start' }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 600, lineHeight: 1.45 }}>
                        <L en={def.en} ar={def.ar} />
                      </div>
                      <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 4, lineHeight: 1.5 }}>
                        <L en={def.detailEn} ar={def.detailAr} />
                      </div>
                      <div style={{ fontSize: '14.5px', marginBlockStart: 10, lineHeight: 1.6 }}>
                        <L en={def.bodyEn} ar={def.bodyAr} />
                      </div>
                    </div>
                    <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent-ink)', fontSize: 13 }}>
                      <L en={FACILITY_CONTENT.reference.chips.short.en} ar={FACILITY_CONTENT.reference.chips.short.ar} />
                    </span>
                  </div>
                );
              })
            : null}
        </div>
      ) : null}

      {/* The sixteen mandatory items. */}
      {!collapsed ? (
        <div data-region="sections">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en="What the plan must address" ar="ما يجب أن تعالجه الخطة" />
            </h2>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              <L en={`${doneCount} of 16 addressed`} ar={`عولج ${doneCount} من 16`} />
            </span>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '76ch' }}>
            <L en="Sixteen items, set by the Protocol." ar="ستة عشر بنداً يحددها البروتوكول." />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 44 }}>
            {sectionsDef.map((s) => {
              const st = sections[String(s.n)];
              // Write mode is done by WRITTEN text alone: a coverage confirmation
              // belongs to the attach route and does not survive switching modes.
              const done = mode === 'attach' ? st?.covered === true : Boolean(st?.text?.trim());
              const c = chip(done ? 'done' : 'open');
              const isOpen = open === s.n;
              return (
                <div key={s.n} style={{ background: 'var(--surface2)', borderInlineStart: `3px solid ${c.color}`, borderRadius: 12, overflow: 'hidden', paddingBlock: 1, paddingInlineEnd: 1 }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : s.n)}
                    style={{ width: '100%', textAlign: 'start', padding: '18px 22px', background: 'none', border: 0, cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 240 }}>
                      <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{s.n}</span>
                      <span style={{ fontSize: '15.5px', lineHeight: 1.45 }}>
                        <L en={s.en} ar={s.ar} />
                      </span>
                    </span>
                    <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 13 }}>
                      <L en={c.en} ar={c.ar} />
                    </span>
                  </button>
                  {isOpen ? (
                    <div style={{ padding: '0 22px 20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'start', padding: '14px 18px', background: 'var(--bg)', borderRadius: 10, marginBlockEnd: 16 }}>
                        <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                          <L en="Guidance" ar="إرشاد" />
                        </span>
                        <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', flex: 1, minWidth: 240 }}>
                          <L en={s.bodyEn} ar={s.bodyAr} />
                        </span>
                      </div>
                      {(s.n === GOVERNANCE_LANDING.clinicalSection && (governance['clinical']?.trim() || governance['command']?.trim())) ||
                      (s.n === GOVERNANCE_LANDING.incidentSection && governance['incidentRole']?.trim()) ? (
                        <div style={{ marginBlockEnd: 14, padding: '12px 16px', border: '1px solid var(--brand)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, background: 'var(--brand-soft)' }}>
                          <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
                            <L en="From the Event Medical Director — part of this section, not overwritable" ar="من المدير الطبي للفعالية — جزء من هذا البند وغير قابل للتعديل" />
                          </div>
                          {(s.n === GOVERNANCE_LANDING.clinicalSection ? ['clinical', 'command'] : ['incidentRole']).map((k) =>
                            governance[k]?.trim() ? (
                              <div key={k} style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.65, marginBlockEnd: 6 }}>
                                {governance[k]}
                              </div>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                      {mode === 'write' ? (
                        <textarea
                          rows={4}
                          value={st?.text ?? ''}
                          onChange={(e) =>
                            setSections((prev) => ({ ...prev, [String(s.n)]: { ...prev[String(s.n)], text: e.target.value } }))
                          }
                          style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.65, resize: 'vertical' }}
                        />
                      ) : (
                        <button
                          type="button"
                          aria-pressed={st?.covered === true}
                          onClick={() =>
                            setSections((prev) => ({ ...prev, [String(s.n)]: { ...prev[String(s.n)], covered: !(st?.covered === true) } }))
                          }
                          style={{ height: 38, paddingInline: 18, border: `1px solid ${st?.covered ? 'var(--brand)' : 'var(--line)'}`, background: st?.covered ? 'var(--brand-soft)' : 'var(--bg)', color: st?.covered ? 'var(--brand)' : 'var(--ink)', borderRadius: 19, fontSize: 14, cursor: 'pointer' }}
                        >
                          <L en="Confirm the attached plan covers this" ar="تأكيد أن الخطة المرفقة تغطي هذا" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* The eleven major-incident items: Level 2 and 3 only; absent below. */}
      {level >= 2 ? (
        <>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="What the major-incident and mass-casualty plan must identify" ar="ما يجب أن تحدده خطة الحوادث الجسيمة وحوادث الإصابات الجماعية" />
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '76ch' }}>
            <L en="Eleven items, set by the Protocol. Confirm each is identified in your plan." ar="أحد عشر بنداً يحددها البروتوكول. أكّدوا أن كلاً منها محدد في خطتكم." />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 28 }}>
            {governance['incidentRole']?.trim() ? (
              <div style={{ marginBlockEnd: 6, padding: '12px 16px', border: '1px solid var(--brand)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, background: 'var(--brand-soft)' }}>
                <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
                  <L en="From the Event Medical Director — their role under items 2 and 10" ar="من المدير الطبي للفعالية — دوره في البندين 2 و10" />
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.65 }}>{governance['incidentRole']}</div>
              </div>
            ) : null}
            {miDef.map((item) => {
              const covered = mi[String(item.n)]?.covered === true;
              return (
                <button
                  key={item.n}
                  type="button"
                  aria-pressed={covered}
                  onClick={() => setMi((prev) => ({ ...prev, [String(item.n)]: { covered: !covered } }))}
                  style={{ textAlign: 'start', display: 'flex', gap: 14, alignItems: 'center', padding: '14px 18px', border: `1px solid ${covered ? 'var(--brand)' : 'var(--line)'}`, background: covered ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}
                >
                  <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${covered ? 'var(--brand)' : 'var(--muted)'}`, background: covered ? 'var(--brand)' : 'transparent', borderRadius: 3 }} />
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{item.n}</span>
                  <span style={{ fontSize: '14.5px', lineHeight: 1.55 }}>
                    <L en={item.en} ar={item.ar} />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {saved ? (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--brand)' }}>
          <L en="Saved. A new version was recorded; earlier versions remain readable." ar="حُفظت. سُجّلت نسخة جديدة، وتبقى النسخ السابقة قابلة للقراءة." />
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}
      >
        <L en="Save the plan" ar="حفظ الخطة" />
      </button>
    </div>
  );
}
