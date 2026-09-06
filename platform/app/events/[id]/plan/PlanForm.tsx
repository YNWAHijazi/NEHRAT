'use client';

/**
 * The event health and medical plan (خطة التأهب الصحي والطبي للفعالية).
 *
 * FIELDS ONLY (partner ruling, 2026-09-04): the form is the sixteen items, the
 * eleven major-incident checkboxes, the route control, the facility reference
 * as one collapsed line, and Save. Every guidance block, the depth table, the
 * fourteen-section template and the planning workflow moved to the reference
 * page behind the footer's Need help link; the per-section explanations live
 * there too. The regulation's own words that ARE the fields stay: the sixteen
 * item titles and the eleven items are the Protocol's checklist.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../../components/L';
import { savePlanAction, uploadPlanFileAction, type PlanPayload } from '../../../actions';
import { acceptAttribute, acceptHint } from '../../../../lib/rules/uploads';
import { FACILITY_CONTENT, referenceShortfalls, type ReferenceDeviceFacts, GOVERNANCE_LANDING } from '../../../../lib/rules';
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

export function PlanForm({
  eventId,
  level,
  sectionsDef,
  miDef,
  initial,
  facility,
  referenceFacts,
  governance,
}: {
  eventId: string;
  level: 1 | 2 | 3;
  sectionsDef: PlanSection[];
  miDef: MiItem[];
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
  // picker uploads on change rather than waiting for Save.
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

  // WHAT IS STILL OUTSTANDING, on the button (partner ruling, 2026-09-05). The
  // plan counts as complete only when every section is addressed and, at Level 2
  // and 3, every major-incident item is ticked -- that rule already gates FILING
  // (lib/rules/submission.ts planIsComplete). It was simply invisible here. Save
  // still works at any time: a plan is written over sessions and each save keeps
  // its version.
  const miOutstanding = level >= 2 ? miDef.filter((i) => mi[String(i.n)]?.covered !== true).length : 0;
  const outstanding = sectionsDef.length - doneCount + miOutstanding;

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

  return (
    <div style={{ maxWidth: 860 }}>
      {/* THE TWO ROUTES, ONE LINE: write here or attach. */}
      <div data-region="plan-route" role="group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockEnd: 20 }}>
        {(
          [
            ['write', 'Write the plan here', 'كتابة الخطة هنا'],
            ['attach', 'Attach an existing plan', 'إرفاق خطة قائمة'],
          ] as const
        ).map(([which, en, ar]) => (
          <button
            key={which}
            type="button"
            aria-pressed={mode === which}
            onClick={() => setMode(which)}
            style={{ height: 40, paddingInline: 18, border: `1px solid ${mode === which ? 'var(--brand)' : 'var(--line)'}`, background: mode === which ? 'var(--brand-soft)' : 'var(--bg)', color: mode === which ? 'var(--brand)' : 'var(--ink)', borderRadius: 20, fontSize: 14, cursor: 'pointer' }}
          >
            <L en={en} ar={ar} />
          </button>
        ))}
      </div>

      {mode === 'attach' ? (
        <div data-region="plan-attach" style={{ padding: '18px 22px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 20 }}>
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
      ) : null}

      {/* THE FACILITY REFERENCE, ONE COLLAPSED LINE: the tick is the field; the
          two questions and any derived shortfall live inside. Renders only where
          the venue is itself a registered covered facility. */}
      {facility ? (
        <details data-region="facility-reference" style={{ background: 'var(--surface2)', borderRadius: 12, padding: '4px 0', marginBlockEnd: 20 }}>
          <summary style={{ cursor: 'pointer', padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: '14.5px', lineHeight: 1.5 }}>
            <span
              aria-hidden="true"
              style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${refConfirmed ? 'var(--brand)' : 'var(--muted)'}`, background: refConfirmed ? 'var(--brand)' : 'transparent', borderRadius: 4 }}
            />
            <L
              en={`${facility.nameEn} has ${facility.devices} registered ${facility.devices === 1 ? 'defibrillator' : 'defibrillators'} — use them in this plan?`}
              ar={`لدى ${facility.nameAr} ${facility.devices} من أجهزة إزالة الرجفان المسجّلة — استخدامها في هذه الخطة؟`}
            />
          </summary>
          <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              aria-pressed={refConfirmed}
              onClick={() => setRefConfirmed((v) => !v)}
              style={{ textAlign: 'start', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', border: `1px solid ${refConfirmed ? 'var(--brand)' : 'var(--line)'}`, background: refConfirmed ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}
            >
              <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${refConfirmed ? 'var(--brand)' : 'var(--muted)'}`, background: refConfirmed ? 'var(--brand)' : 'transparent', borderRadius: 3 }} />
              <span style={{ fontSize: '14px', lineHeight: 1.55 }}>
                <L en="I confirm the referenced arrangements will remain accessible and operational throughout the event." ar="أؤكد أن الترتيبات المُحال إليها ستبقى متاحة للوصول وصالحة للعمل طوال الفعالية." />
              </span>
            </button>
            {FACILITY_CONTENT.reference.questions.map((q) => {
              const on = q.key === 'admitsChildren' ? refAdmitsChildren : refTemporaryAreas;
              const toggle = q.key === 'admitsChildren' ? setRefAdmitsChildren : setRefTemporaryAreas;
              return (
                <button
                  key={q.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle((v) => !v)}
                  style={{ textAlign: 'start', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}
                >
                  <span style={{ flex: 'none', width: 16, height: 16, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', borderRadius: 3 }} />
                  <span style={{ fontSize: '14px', lineHeight: 1.55 }}>
                    <L en={q.en} ar={q.ar} />
                  </span>
                </button>
              );
            })}
            {referenceFacts
              ? referenceShortfalls(referenceFacts, {
                  admitsChildren: refAdmitsChildren,
                  temporaryAreas: refTemporaryAreas,
                }).map((s) => {
                  const def = FACILITY_CONTENT.reference.shortfalls[s.key];
                  return (
                    <div key={s.key} data-region="shortfall" style={{ padding: '12px 16px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, fontSize: '13.5px', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600 }}>
                        <L en={def.en} ar={def.ar} />
                      </span>{' '}
                      <L en={def.bodyEn} ar={def.bodyAr} />
                    </div>
                  );
                })
              : null}
          </div>
        </details>
      ) : null}

      {/* Level 1's sixteen stay collapsed behind one control line. */}
      {level === 1 ? (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: '13.5px', cursor: 'pointer', marginBlockEnd: 20 }}
        >
          {collapsed ? <L en="Show the sixteen sections" ar="إظهار البنود الستة عشر" /> : <L en="Collapse the sixteen sections" ar="طي البنود الستة عشر" />}
        </button>
      ) : null}

      {/* THE SIXTEEN ITEMS: each opens to its field. The titles are the
          Protocol's checklist -- the fields themselves. */}
      {!collapsed ? (
        <div data-region="sections" style={{ marginBlockEnd: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 8 }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {doneCount > 0 ? <L en={`${doneCount} of 16 addressed`} ar={`عولج ${doneCount} من 16`} /> : null}
            </span>
            {/* SELECT ALL (partner ruling, 2026-09-05): confirming an attached
                plan covers all sixteen is one decision, not sixteen clicks. Only
                in attach mode -- written sections are written, not ticked. */}
            {mode === 'attach' ? (
              <button
                type="button"
                data-region="sections-all"
                onClick={() => {
                  const all = doneCount === sectionsDef.length;
                  setSections((prev) => {
                    const next = { ...prev };
                    for (const s of sectionsDef) next[String(s.n)] = { ...next[String(s.n)], covered: !all };
                    return next;
                  });
                }}
                style={{ height: 32, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}
              >
                {doneCount === sectionsDef.length ? <L en="Clear all" ar="مسح الكل" /> : <L en="Select all" ar="تحديد الكل" />}
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sectionsDef.map((s) => {
              const st = sections[String(s.n)];
              // Write mode is done by WRITTEN text alone: a coverage confirmation
              // belongs to the attach route and does not survive switching modes.
              const done = mode === 'attach' ? st?.covered === true : Boolean(st?.text?.trim());
              const isOpen = open === s.n;
              return (
                <div key={s.n} style={{ background: 'var(--surface2)', borderInlineStart: `3px solid ${done ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : s.n)}
                    style={{ width: '100%', textAlign: 'start', padding: '13px 18px', background: 'none', border: 0, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'baseline' }}
                  >
                    <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{s.n}</span>
                    <span style={{ fontSize: '14.5px', lineHeight: 1.45, flex: 1 }}>
                      <L en={s.en} ar={s.ar} />
                    </span>
                    {done ? (
                      <span style={{ flex: 'none', padding: '2px 9px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 12 }}>
                        <L en="Addressed" ar="معالَج" />
                      </span>
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div style={{ padding: '0 18px 16px' }}>
                      {(s.n === GOVERNANCE_LANDING.clinicalSection && (governance['clinical']?.trim() || governance['command']?.trim())) ||
                      (s.n === GOVERNANCE_LANDING.incidentSection && governance['incidentRole']?.trim()) ? (
                        <div style={{ marginBlockEnd: 12, padding: '10px 14px', border: '1px solid var(--brand)', borderInlineStart: '3px solid var(--brand)', borderRadius: 8, background: 'var(--brand-soft)' }}>
                          <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
                            <L en="From the Event Medical Director" ar="من المدير الطبي للفعالية" />
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
                          style={{ width: '100%', padding: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.65, resize: 'vertical' }}
                        />
                      ) : (
                        <button
                          type="button"
                          aria-pressed={st?.covered === true}
                          onClick={() =>
                            setSections((prev) => ({ ...prev, [String(s.n)]: { ...prev[String(s.n)], covered: !(st?.covered === true) } }))
                          }
                          style={{ height: 36, paddingInline: 16, border: `1px solid ${st?.covered ? 'var(--brand)' : 'var(--line)'}`, background: st?.covered ? 'var(--brand-soft)' : 'var(--bg)', color: st?.covered ? 'var(--brand)' : 'var(--ink)', borderRadius: 18, fontSize: '13.5px', cursor: 'pointer' }}
                        >
                          <L en="The attached plan covers this" ar="الخطة المرفقة تغطي هذا" />
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

      {/* THE ELEVEN MAJOR-INCIDENT ITEMS: a plain checkbox list. Level 2 and 3
          only; absent below. */}
      {level >= 2 ? (
        <div data-region="major-incident" style={{ marginBlockEnd: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en="Major-incident and mass-casualty plan" ar="خطة الحوادث الجسيمة وحوادث الإصابات الجماعية" />
            </h2>
            <button
              type="button"
              data-region="mi-all"
              onClick={() => {
                const all = miDef.every((i) => mi[String(i.n)]?.covered === true);
                setMi(() => Object.fromEntries(miDef.map((i) => [String(i.n), { covered: !all }])));
              }}
              style={{ height: 32, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}
            >
              {miDef.every((i) => mi[String(i.n)]?.covered === true) ? <L en="Clear all" ar="مسح الكل" /> : <L en="Select all" ar="تحديد الكل" />}
            </button>
          </div>
          {governance['incidentRole']?.trim() ? (
            <div style={{ marginBlockEnd: 8, padding: '10px 14px', border: '1px solid var(--brand)', borderInlineStart: '3px solid var(--brand)', borderRadius: 8, background: 'var(--brand-soft)' }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--brand)', marginBlockEnd: 6 }}>
                <L en="From the Event Medical Director" ar="من المدير الطبي للفعالية" />
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.65 }}>{governance['incidentRole']}</div>
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {miDef.map((item) => {
              const covered = mi[String(item.n)]?.covered === true;
              return (
                <button
                  key={item.n}
                  type="button"
                  aria-pressed={covered}
                  onClick={() => setMi((prev) => ({ ...prev, [String(item.n)]: { covered: !covered } }))}
                  style={{ textAlign: 'start', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', border: `1px solid ${covered ? 'var(--brand)' : 'var(--line)'}`, background: covered ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}
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
        </div>
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
        {outstanding > 0 ? (
          <L en={`Save the plan — ${outstanding} outstanding`} ar={`حفظ الخطة — ${outstanding} غير مستوفى`} />
        ) : (
          <L en="Save the plan — complete" ar="حفظ الخطة — مكتملة" />
        )}
      </button>
    </div>
  );
}
