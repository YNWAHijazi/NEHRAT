'use client';

import { InfoNote } from '../../../components/InfoNote';

/**
 * The plan's own form: the facility readiness confirmation (six confirmations and
 * the latest drill date) and, under it, the facility confirmation -- the statement
 * that the plan is current, signed by the facility representative, dated by the
 * platform (Asia/Beirut, never typed). The responsible-persons form left this file
 * (partner audit, 2026-10-08): the one responsible contact is edited on the
 * facility record and shown read-only on the plan.
 *
 * TWO LAYOUTS, ONE FORM, ONE ACTION (owner, 9 October 2026). On a registered facility's
 * page the whole form sits in the response-plan section. While the registration is open
 * the readiness confirmation is the response-plan step and the facility confirmation is
 * the review step that completes the registration: the two halves share their state
 * through ReadinessProvider and post together, the plan step's inputs naming the review
 * step's form through the `form` attribute. saveFacilityPlanAction is unchanged.
 */

import { createContext, useContext, useState } from 'react';
import { L } from '../../../components/L';
import { saveFacilityPlanAction } from '../../actions';
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
const NOT_READY = { en: 'Available once the facility map, the responsible contact and the required AEDs are complete.', ar: 'يتاح عند اكتمال خريطة المنشأة وجهة الاتصال المسؤولة والأجهزة المطلوبة.' };

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
const ReadinessContext = createContext<Readiness | null>(null);

function useReadinessState(existing: FacilityPlanConfirmation | null): Readiness {
  const [checks, setChecks] = useState<Record<string, boolean>>(existing?.current ? existing.checks : {});
  const [drill, setDrill] = useState(existing?.drillDate ?? '');
  return { checks, toggle: (key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] })), drill, setDrill };
}

/** Holds the readiness confirmation across the plan step and the review step. */
export function ReadinessProvider({ existing, children }: { existing: FacilityPlanConfirmation | null; children: React.ReactNode }) {
  return <ReadinessContext.Provider value={useReadinessState(existing)}>{children}</ReadinessContext.Provider>;
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
  return (
    <form
      action={saveFacilityPlanAction.bind(null, facilityId)}
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
      {!ready ? (
        <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en={NOT_READY.en} ar={NOT_READY.ar} />
        </p>
      ) : null}
    </form>
  );
}

/** The registration form's id: the review step's form, which the plan step's fields post with. */
export const REGISTRATION_FORM_ID = 'confirmation';

/** The response-plan step's half: the readiness confirmation, posted with the review step's form. */
export function ReadinessChecks({ existing }: { existing: FacilityPlanConfirmation | null }) {
  const readiness = useContext(ReadinessContext);
  if (!readiness) return null;
  return (
    <div data-region="readiness-checks" style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 24 }}>
      <ReadinessHeading existing={existing} />
      <ReadinessFields readiness={readiness} form={REGISTRATION_FORM_ID} />
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        <L en="The facility representative signs this confirmation in the last step, which completes the registration." ar="يوقّع ممثل المنشأة هذا التأكيد في الخطوة الأخيرة، التي تُكمل التسجيل." />
      </p>
    </div>
  );
}

/**
 * The review step: what remains, with a link to each, then the facility confirmation that
 * completes the registration. The items the server knows arrive as `remaining`; the
 * readiness confirmations are read from the plan step as they are ticked.
 */
export function RegistrationReview({ facilityId, representative, today, remaining, refused }: {
  facilityId: string;
  representative: string;
  today: string;
  remaining: { key: string; en: string; ar: string; href: string }[];
  /** The server refused the confirmation (?error=readiness). */
  refused: boolean;
}) {
  const readiness = useContext(ReadinessContext);
  const [checked, setChecked] = useState(false);
  if (!readiness) return null;
  const content = FACILITY_CONTENT;
  const ticked = content.planChecks.filter((c) => readiness.checks[c.key]).length;
  const total = content.planChecks.length;
  const inPlan = [
    ...(ticked < total ? [{ key: 'checks', en: `Readiness confirmations in the response plan (${ticked} of ${total})`, ar: `تأكيدات الجاهزية في خطة الاستجابة (${ticked} من ${total})`, href: '#plan' }] : []),
    ...(readiness.drill ? [] : [{ key: 'drill', en: content.drillDateField.en, ar: content.drillDateField.ar, href: '#plan' }]),
  ];
  const open = [...remaining, ...inPlan];
  const ready = remaining.length === 0;
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '8px 14px', color: 'var(--ink)', borderBlockEnd: '1px solid var(--line)', borderInlineStart: '3px solid var(--accent)', textDecoration: 'none' };
  const cardStyle: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', marginBlockEnd: 16 };

  return (
    <div data-region="registration-review">
      {refused ? (
        <div role="alert" style={{ ...cardStyle, border: '1px solid var(--bad)', fontSize: '14.5px', lineHeight: 1.6 }}>
          <L en="Confirm all readiness items, add a drill date within the last 12 months, and check the facility map and AED status." ar="أكّدوا جميع بنود الجاهزية وأضيفوا تاريخ تمرين خلال آخر 12 شهراً وتحقّقوا من الخريطة وحالة الأجهزة." />
        </div>
      ) : null}
      {/* With nothing left the card goes, as on the venue's review. */}
      <div data-region="remaining" hidden={open.length === 0} style={cardStyle}>
        <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>
          <L en={open.length === 1 ? '1 item remaining' : `${open.length} items remaining`} ar={`${open.length} متبقٍ`} />
        </h3>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {open.map((c) => (
            <a key={c.key} href={c.href} data-remaining={c.key} style={rowStyle}>
              <span style={{ fontSize: '14.5px' }}><L en={c.en} ar={c.ar} /></span>
              <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}><L en="Pending" ar="قيد الانتظار" /></span>
            </a>
          ))}
        </div>
      </div>
      <form
        id={REGISTRATION_FORM_ID}
        action={saveFacilityPlanAction.bind(null, facilityId)}
        data-region="confirm-and-register"
        noValidate
        onSubmit={(e) => { if (inPlan.length > 0) { e.preventDefault(); setChecked(true); } }}
        style={cardStyle}
      >
        <FacilityConfirmationFields representative={representative} today={today} />
        {checked && inPlan.length > 0 ? (
          <p data-region="please-fill" role="alert" style={{ margin: '0 0 16px', padding: '12px 16px', border: '1px solid var(--bad)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.55 }}>
            <L en={`Please complete in the response plan: ${inPlan.map((c) => c.key === 'checks' ? 'the readiness confirmations' : 'the drill date').join(', ')}.`} ar={`يرجى إكمال ما يلي في خطة الاستجابة: ${inPlan.map((c) => c.key === 'checks' ? 'تأكيدات الجاهزية' : 'تاريخ التمرين').join('، ')}.`} />{' '}
            <a href="#plan" style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}><L en="Open the response plan" ar="فتح خطة الاستجابة" /></a>
          </p>
        ) : null}
        <button type="submit" disabled={!ready} style={submitStyle(ready)}>
          <L en="Complete the registration" ar="إكمال التسجيل" />
        </button>
        {!ready ? (
          <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={NOT_READY.en} ar={NOT_READY.ar} />
          </p>
        ) : null}
      </form>
    </div>
  );
}
