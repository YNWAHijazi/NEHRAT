'use client';

/**
 * The plan's own forms: the responsible persons (one coordinator record, stamped on
 * review -- the ledger's coordinator row reads that stamp) and the plan's own
 * readiness confirmation, signed by the coordinator.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { saveFacilityPersonsAction, saveFacilityPlanAction } from '../../../actions';
import { FACILITY_CONTENT } from '../../../../lib/rules';
import type { FacilityPerson, FacilityPlanConfirmation } from '../../../../lib/queries';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export function PrintButton() {
  return (
    <button
      type="button"
      data-noprint=""
      onClick={() => window.print()}
      style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'none', borderRadius: 19, fontSize: '13.5px', cursor: 'pointer' }}
    >
      <L en="Print for the AED cabinet" ar="اطبعها لخزانة الجهاز" />
    </button>
  );
}

export function PersonsForm({ facilityId, persons }: { facilityId: string; persons: FacilityPerson[] }) {
  const content = FACILITY_CONTENT;
  const byRole = new Map(persons.map((p) => [p.role, p]));
  return (
    <form action={saveFacilityPersonsAction.bind(null, facilityId)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {content.persons.map((p) => {
        const row = byRole.get(p.key as FacilityPerson['role']);
        return (
          <div key={p.key} style={{ paddingBlockStart: 10, borderBlockStart: '1px solid var(--line)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 8 }}>
              <L en={p.en} ar={p.ar} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
              <input name={`${p.key}Name`} defaultValue={row?.nameOrPosition ?? ''} aria-label={p.en} style={inputStyle} />
              <input name={`${p.key}Phone`} defaultValue={row?.phone ?? ''} style={inputStyle} />
              <input name={`${p.key}Email`} defaultValue={row?.email ?? ''} style={inputStyle} />
            </div>
          </div>
        );
      })}
      <button
        type="submit"
        style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 21, fontSize: 14, cursor: 'pointer', alignSelf: 'start' }}
      >
        <L en="Review and record the details" ar="مراجعة البيانات وتسجيلها" />
      </button>
    </form>
  );
}

export function PlanConfirmation({
  facilityId,
  coordinatorName,
  existing,
}: {
  facilityId: string;
  coordinatorName: string;
  existing: FacilityPlanConfirmation | null;
}) {
  const content = FACILITY_CONTENT;
  const [checks, setChecks] = useState<Record<string, boolean>>(existing?.checks ?? {});

  return (
    <form
      action={saveFacilityPlanAction.bind(null, facilityId)}
      data-region="plan-confirmation"
      style={{ padding: '31px 35px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 44 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Readiness confirmation" ar="التحقق من جاهزية المرفق" />
        </h2>
        {existing ? (
          <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            <L en={`Last recorded ${existing.createdAt.slice(0, 10)}`} ar={`آخر تسجيل ⁦${existing.createdAt.slice(0, 10)}⁩`} />
          </span>
        ) : null}
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
        <L
          en="Recording this confirmation restarts the annual clock on the validity ledger. It is signed by the coordinator — the device records are signed by the facility representative."
          ar="تسجيل هذا التأكيد يعيد بدء العدّ السنوي في سجل الصلاحية. ويوقّعه المنسّق — أما سجلات الأجهزة فيوقّعها ممثل المرفق."
        />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
        {content.planChecks.map((c) => {
          const on = Boolean(checks[c.key]);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setChecks((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
              style={{ textAlign: 'start', display: 'flex', gap: 14, alignItems: 'center', padding: '14px 18px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', borderRadius: 10, cursor: 'pointer' }}
            >
              <span style={{ flex: 'none', width: 18, height: 18, border: `1.5px solid ${on ? 'var(--brand)' : 'var(--muted)'}`, background: on ? 'var(--brand)' : 'transparent', borderRadius: 4 }} />
              <span style={{ fontSize: '14.5px', lineHeight: 1.55 }}>
                <L en={c.en} ar={c.ar} />
              </span>
              {on ? <input type="hidden" name={`check_${c.key}`} value="on" /> : null}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBlockEnd: 20, maxWidth: 700 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en={content.drillDateField.en} ar={content.drillDateField.ar} />
          </span>
          <input name="drillDate" type="date" defaultValue={existing?.drillDate ?? ''} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="Facility cardiac-readiness coordinator" ar="منسق الجاهزية للاستجابة لحالات توقف القلب في المرفق" />
          </span>
          <input name="coordinator" defaultValue={coordinatorName} required style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
            <L en="Position" ar="المسمى الوظيفي" />
          </span>
          <input name="position" defaultValue={existing?.position ?? ''} style={inputStyle} />
        </label>
      </div>
      <button
        type="submit"
        style={{ height: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
      >
        <L en="Record the readiness confirmation" ar="تسجيل تأكيد الجاهزية" />
      </button>
    </form>
  );
}
