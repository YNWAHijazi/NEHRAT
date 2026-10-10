'use client';

import { InfoNote } from '../../../components/InfoNote';

/**
 * The readiness confirmation (latest revision, 9 October 2026, section 6): the six
 * confirmations and the latest drill date, then the facility confirmation -- the statement
 * signed by the facility representative and dated by the platform (Asia/Beirut, never
 * typed). One form, one action (saveFacilityPlanAction): the readiness-confirmation step
 * while the registration is in preparation, the cardiac-readiness tab once submitted.
 * Recording it does not submit anything; the review step does.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { registerAutosave } from '../../../components/record/autosave';
import { autosaveFacilityConfirmationAction, saveFacilityPlanAction } from '../../actions';
import { FACILITY_CONTENT } from '../../../lib/rules';
import type { FacilityPlanConfirmation } from '../../../lib/queries';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};
const submitStyle = (ready: boolean): React.CSSProperties => ({ height: '46px', paddingInline: '24px', border: 0, borderRadius: '23px', background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6 });
const NOT_READY = { en: 'Available once the site map, the responsible contact and the required AEDs are complete.', ar: 'يتاح عند اكتمال خريطة الموقع وجهة الاتصال المسؤولة والأجهزة المطلوبة.' };

export function PrintButton() {
  return (
    <button
      type="button"
      data-noprint=""
      onClick={() => window.print()}
      style={{ height: 44, paddingInline: 18, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '13.5px', cursor: 'pointer' }}
    >
      <L en="Print for the AED cabinet" ar="اطبعها لخزانة الجهاز" />
    </button>
  );
}

interface Readiness {
  checks: Record<string, boolean>;
  toggle: (key: string) => void;
  drill: string;
  setDrill: (v: string) => void;
}
function useReadinessState(existing: FacilityPlanConfirmation | null): Readiness {
  const [checks, setChecks] = useState<Record<string, boolean>>(existing?.current ? existing.checks : {});
  const [drill, setDrill] = useState(existing?.drillDate ?? '');
  return { checks, toggle: (key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] })), drill, setDrill };
}

/** The six confirmations and the drill date. `form` names the form they post with when it is elsewhere on the page. */
function ReadinessFields({ readiness, form }: { readiness: Readiness; form?: string }) {
  const content = FACILITY_CONTENT;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
        {content.planChecks.map((c) => {
          const on = Boolean(readiness.checks[c.key]);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => readiness.toggle(c.key)}
              style={{ textAlign: 'start', display: 'flex', gap: 14, alignItems: 'center', minHeight: 44, padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}
            >
              <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', borderRadius: 4 }} />
              <span style={{ fontSize: '14.5px', lineHeight: 1.55 }}>
                <L en={c.en} ar={c.ar} />
              </span>
              {on ? <input type="hidden" name={`check_${c.key}`} value="on" form={form} /> : null}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBlockEnd: 24, maxWidth: 700 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={content.drillDateField.en} ar={content.drillDateField.ar} />
          </span>
          {/* Not `required` when it posts with a form in another step: a browser cannot focus a hidden field to say so. The review step names it instead. */}
          <input name="drillDate" required={!form} form={form} type="date" value={readiness.drill} onChange={(e) => readiness.setDrill(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
        </label>
      </div>
    </>
  );
}

function ReadinessHeading({ existing }: { existing: FacilityPlanConfirmation | null }) {
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Facility readiness confirmation" ar="تأكيد جاهزية المنشأة" />
        </h2>
        {existing ? (
          <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            <L en={`Last recorded ${existing.createdAt.slice(0, 10)}`} ar={`آخر تسجيل ⁦${existing.createdAt.slice(0, 10)}⁩`} />
          </span>
        ) : null}
      </div>
      {existing && !existing.current ? <p role="status"><L en="The facility or AED details changed. Review and confirm the updated plan." ar="تغيّرت بيانات المنشأة أو الأجهزة. راجعوا الخطة المحدّثة وأكّدوها."/></p>:null}
      <div className="secondary-help"><InfoNote><L
          en="Recording this confirmation restarts the annual clock on the validity record. The facility representative confirms it."
          ar="تسجيل هذا التأكيد يعيد بدء العدّ السنوي في سجل الصلاحية. ويؤكده ممثل المنشأة."
        /></InfoNote></div>
    </>
  );
}

/** The facility confirmation statement, the representative who signs it and the platform's date. */
function FacilityConfirmationFields({ representative, today }: { representative: string; today: string }) {
  const content = FACILITY_CONTENT;
  return (
    <div data-region="facility-confirmation" style={{ paddingBlockStart: 20, borderBlockStart: '1px solid var(--line)', marginBlockEnd: 20 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600 }}>
        <L en="Facility confirmation" ar="تأكيد المنشأة" />
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: '14.5px', lineHeight: 1.65, maxWidth: '70ch' }}>
        <L en={content.facilityConfirmation.en} ar={content.facilityConfirmation.ar} />
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 700 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={content.facilityConfirmation.representativeEn} ar={content.facilityConfirmation.representativeAr} />
          </span>
          {/* Keyed by the default: a contact changed on an earlier step is the signatory offered here. */}
          <input key={representative} name="representative" defaultValue={representative} required style={inputStyle} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={content.facilityConfirmation.dateEn} ar={content.facilityConfirmation.dateAr} />
          </span>
          <span style={{ ...inputStyle, display: 'inline-flex', alignItems: 'center', background: 'var(--surface2)', fontVariantNumeric: 'tabular-nums' }}>{today}</span>
        </div>
      </div>
    </div>
  );
}

/** The whole form, on a registered facility's page: re-confirming the plan. */
export function PlanConfirmation({
  facilityId,
  representative,
  today,
  existing,
  ready = true,
}: {
  facilityId: string;
  /** The default signatory: the responsible facility contact's name or position. */
  representative: string;
  /** Today, Asia/Beirut, ISO -- the confirmation's date, from the platform clock. */
  today: string;
  existing: FacilityPlanConfirmation | null;
  ready?: boolean;
}) {
  const readiness = useReadinessState(existing);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  // MOVING ON SAVES IT (owner, 10 October 2026: the step said moving on saves, and the
  // confirmation was lost). Untouched, nothing is sent. Complete, it is recorded as the button
  // records it. Started but not complete, the person stays on the step and is told what is missing.
  const touched = useRef(false);
  const [unsaved, setUnsaved] = useState(false);
  const total = FACILITY_CONTENT.planChecks.length;
  const state = useRef({ readiness, total }); state.current = { readiness, total };
  useEffect(() => {
    if (!form.current || !ready) return;
    return registerAutosave(form.current, async () => {
      if (!touched.current || !form.current) return true;
      const { readiness: r, total: n } = state.current;
      const complete = Object.values(r.checks).filter(Boolean).length === n && r.drill !== '';
      if (!complete) { setUnsaved(true); return false; }
      const result = await autosaveFacilityConfirmationAction(facilityId, new FormData(form.current));
      if ('error' in result) { setUnsaved(true); return false; }
      touched.current = false;
      setUnsaved(false);
      router.refresh();
      return true;
    });
  }, [facilityId, ready, router]);
  return (
    <form
      ref={form}
      action={saveFacilityPlanAction.bind(null, facilityId)}
      onChange={() => { touched.current = true; }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button[aria-pressed]')) touched.current = true; }}
      data-region="plan-confirmation"
      id="confirmation"
      style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 44 }}
    >
      <ReadinessHeading existing={existing} />
      <ReadinessFields readiness={readiness} />
      <FacilityConfirmationFields representative={existing?.current ? existing.coordinator || representative : representative} today={today} />
      <button type="submit" disabled={!ready} style={submitStyle(ready)}>
        <L en="Record the readiness confirmation" ar="تسجيل تأكيد الجاهزية" />
      </button>
      {unsaved ? (
        <p role="alert" data-region="confirmation-unsaved" style={{ margin: '12px 0 0', fontSize: '14px', color: 'var(--bad)' }}>
          <L en={`Not recorded yet. Tick all ${total} confirmations, enter the latest drill date (within the last 12 months) and the representative, then move on or press the button.`}
            ar={`لم يُسجَّل بعد. أكّدوا البنود الـ${total} كلها، وأدخلوا تاريخ آخر تمرين (خلال آخر 12 شهراً) واسم الممثل، ثم انتقلوا أو اضغطوا الزر.`} />
        </p>
      ) : null}
      {!ready ? (
        <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en={NOT_READY.en} ar={NOT_READY.ar} />
        </p>
      ) : null}
    </form>
  );
}
