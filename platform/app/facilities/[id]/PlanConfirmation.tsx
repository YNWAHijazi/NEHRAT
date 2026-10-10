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
import { confirmationRefusalMessages, type ConfirmationRefusal } from '../../../lib/rules/confirmation-refusal';

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
  // Why the last attempt was not recorded, each reason by name (lib/rules/confirmation-refusal.ts).
  // The form is never reloaded on a refusal: what was ticked and typed stays (owner, 10 October 2026).
  const [why, setWhy] = useState<ConfirmationRefusal[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!form.current || !ready) return;
    return registerAutosave(form.current, async () => {
      if (!touched.current || !form.current) return true;
      const result = await autosaveFacilityConfirmationAction(facilityId, new FormData(form.current));
      if ('error' in result) { setWhy(result.why); return false; }
      touched.current = false;
      setWhy([]);
      router.refresh();
      return true;
    });
  }, [facilityId, ready, router]);
  const record = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    try {
      const result = await autosaveFacilityConfirmationAction(facilityId, new FormData(e.currentTarget));
      if ('error' in result) { setWhy(result.why); return; }
      touched.current = false;
      setWhy([]);
      router.push(result.next);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      ref={form}
      action={saveFacilityPlanAction.bind(null, facilityId)}
      onSubmit={record}
      onChange={() => { touched.current = true; }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button[aria-pressed]')) touched.current = true; }}
      data-region="plan-confirmation"
      id="confirmation"
      style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 44 }}
    >
      <ReadinessHeading existing={existing} />
      <ReadinessFields readiness={readiness} />
      <FacilityConfirmationFields representative={existing?.current ? existing.coordinator || representative : representative} today={today} />
      <button type="submit" disabled={!ready || saving} style={submitStyle(ready)}>
        <L en="Record the readiness confirmation" ar="تسجيل تأكيد الجاهزية" />
      </button>
      {why.length ? <ConfirmationRefused facilityId={facilityId} why={why} /> : null}
      {!ready ? (
        <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en={NOT_READY.en} ar={NOT_READY.ar} />
        </p>
      ) : null}
    </form>
  );
}

/** Not recorded: each reason, with the way to the place it is fixed where that is elsewhere. */
export function ConfirmationRefused({ facilityId, why }: { facilityId: string; why: readonly string[] }) {
  const lines = confirmationRefusalMessages(why);
  if (!lines.length) return null;
  const elsewhere: Partial<Record<ConfirmationRefusal, { href: string; en: string; ar: string }>> = {
    map: { href: `/facilities/${facilityId}/profile#map`, en: 'Place the pin', ar: 'ضعوا العلامة' },
    contact: { href: `/facilities/${facilityId}/profile#contact`, en: 'Edit the contact', ar: 'تعديل جهة الاتصال' },
    'aeds-none': { href: '#aeds', en: 'Go to the AEDs', ar: 'الانتقال إلى الأجهزة' },
    'aeds-not-ready': { href: '#aeds', en: 'Go to the AEDs', ar: 'الانتقال إلى الأجهزة' },
  };
  return (
    <div role="alert" data-region="confirmation-unsaved" style={{ margin: '12px 0 0', fontSize: '14px', color: 'var(--bad)', lineHeight: 1.55 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600 }}><L en="Not recorded yet:" ar="لم يُسجَّل بعد:" /></p>
      <ul style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lines.map((l) => {
          const go = elsewhere[l.code];
          return (
            <li key={l.code} data-why={l.code}>
              <L en={l.en} ar={l.ar} />
              {go ? <>{' '}<a href={go.href}><L en={go.en} ar={go.ar} /></a></> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
