'use client';

/**
 * The registry table and the device record card. The registration purpose determines
 * what is asked (the AED registration form's five purposes); the coordinator is shown
 * read-only from the facility record; the representative signs each save.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { saveFacilityDeviceAction } from '../../../actions';
import { FACILITY_CONTENT, addDaysIso } from '../../../../lib/rules';
import type { FacilityDevice } from '../../../../lib/queries';

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

function YesNo({ name, initial }: { name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setOn(true)}
        style={{ padding: '6px 14px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
      >
        <L en="Yes" ar="نعم" />
      </button>
      <button
        type="button"
        aria-pressed={!on}
        onClick={() => setOn(false)}
        style={{ padding: '6px 14px', border: `1px solid ${!on ? 'var(--brand)' : 'var(--line)'}`, background: !on ? 'var(--brand-soft)' : 'var(--bg)', color: !on ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
      >
        <L en="No" ar="لا" />
      </button>
      <input type="hidden" name={name} value={on ? 'yes' : 'no'} />
    </span>
  );
}

export function DeviceRegistry({
  facilityId,
  devices,
  coordinatorName,
  today,
}: {
  facilityId: string;
  devices: FacilityDevice[];
  coordinatorName: string;
  today: string;
}) {
  const content = FACILITY_CONTENT;
  const [selected, setSelected] = useState<string | null>(devices[0]?.label ?? null);
  const [purpose, setPurpose] = useState('initial');
  const device = devices.find((d) => d.label === selected) ?? null;
  const days = content.ledger.cycles.lapseWindowDays;

  const statusOf = (d: FacilityDevice): { en: string; ar: string; color: string; chipBg: string } => {
    // Out of service beats every date state: a device reported non-operational is
    // not ready whatever its expiry dates say. Until this branch existed, saving a
    // status change with Operational = No changed NOTHING anywhere on the screen.
    if (!d.operational) {
      return { en: 'Out of service — reported', ar: 'خارج الخدمة — مبلَّغ عنه', color: 'var(--bad)', chipBg: 'var(--bad-soft)' };
    }
    if (!d.accessibleHours) {
      return { en: 'Not accessible', ar: 'غير متاح للوصول', color: 'var(--bad)', chipBg: 'var(--bad-soft)' };
    }
    const dates = [d.padExpiry, d.batteryExpiry].filter((x): x is string => x !== null);
    if (!dates.length) return { ...content.statuses.notRecorded, color: 'var(--bad)', chipBg: 'var(--bad-soft)' };
    const min = dates.reduce((a, b) => (a < b ? a : b));
    if (min < today) return { ...content.statuses.lapsed, color: 'var(--bad)', chipBg: 'var(--bad-soft)' };
    if (addDaysIso(today, days) >= min) return { ...content.statuses.lapsing, color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' };
    return { ...content.statuses.current, color: 'var(--brand)', chipBg: 'var(--brand-soft)' };
  };

  const dateField = (key: string, en: string, ar: string, initial: string | null) => (
    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14 }}>
        <L en={en} ar={ar} />
      </span>
      <input name={key} type="date" defaultValue={initial ?? ''} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
    </label>
  );
  const textField = (key: string, en: string, ar: string, initial: string, dir?: 'rtl') => (
    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14 }}>
        <L en={en} ar={ar} />
      </span>
      <input name={key} defaultValue={initial} {...(dir ? { dir } : {})} style={inputStyle} />
    </label>
  );

  const purposeDef = content.devicePurposes.find((p) => p.key === purpose) ?? content.devicePurposes[0]!;
  const isInitial = purpose === 'initial';

  return (
    <div>
      <div data-region="registry-table" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 44 }}>
        {[
          { en: 'Device', ar: 'الجهاز' },
          { en: 'Location', ar: 'الموقع' },
          { en: 'Accessible', ar: 'متاح للوصول' },
          { en: 'Readiness', ar: 'الجاهزية' },
        ].map((h) => (
          <div key={h.en} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={h.en} ar={h.ar} />
          </div>
        ))}
        {devices.map((d) => {
          const st = statusOf(d);
          return [
            <button key={`${d.label}-a`} type="button" onClick={() => { setSelected(d.label); setPurpose('annual'); }} style={{ textAlign: 'start', border: 0, cursor: 'pointer', background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>
              {d.label} · {d.identification}
            </button>,
            <div key={`${d.label}-b`} style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px' }}>
              <L en={d.locationEn} ar={d.locationAr} />
            </div>,
            <div key={`${d.label}-c`} style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px', color: 'var(--muted)' }}>
              {d.accessibleHours ? (
                d.publiclyAccessible ? <L en="Yes · public" ar="نعم · للعموم" /> : <L en="Yes · staff assisted" ar="نعم · بمساعدة الموظفين" />
              ) : (
                <L en="No — reported not accessible" ar="لا — أُبلغ أنه غير متاح" />
              )}
            </div>,
            <div key={`${d.label}-d`} style={{ background: 'var(--bg)', padding: '16px 18px', fontSize: '13.5px' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: st.chipBg, color: st.color }}>
                <L en={st.en} ar={st.ar} />
              </span>
            </div>,
          ];
        })}
      </div>

      <form action={saveFacilityDeviceAction.bind(null, facilityId)}>
        <div data-region="device-card" style={{ maxWidth: 620, padding: 31, background: 'var(--surface2)', borderRadius: 16 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
            {isInitial || !device ? (
              <L en="New device record" ar="سجل جهاز جديد" />
            ) : (
              <L en={`Device record · ${device.label}`} ar={`سجل الجهاز · ${device.label}`} />
            )}
          </div>
          {!isInitial && device ? (
            <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={device.locationEn} ar={device.locationAr} />
            </h2>
          ) : (
            <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en="Register a device" ar="تسجيل جهاز" />
            </h2>
          )}
          <input type="hidden" name="label" value={!isInitial && device ? device.label : ''} />
          <input type="hidden" name="purpose" value={purpose} />

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en="Registration purpose" ar="غاية التسجيل" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 26 }}>
            {content.devicePurposes.map((p) => {
              const on = purpose === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPurpose(p.key)}
                  style={{ textAlign: 'start', padding: '12px 16px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 8, fontSize: '14.5px', cursor: 'pointer' }}
                >
                  <L en={p.en} ar={p.ar} />
                </button>
              );
            })}
          </div>

          {/* The "Asked for this purpose" kicker left the card (partner ruling,
              second sweep): the fields that follow are the answer. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 24 }}>
            {purpose === 'initial' ? (
              <>
                {textField('identification', content.deviceFields[0]!.en, content.deviceFields[0]!.ar, '')}
                {textField('location', content.deviceFields[1]!.en, content.deviceFields[1]!.ar, '')}
                {textField('locationAr', `${content.deviceFields[1]!.en} (Arabic)`, `${content.deviceFields[1]!.ar} (بالعربية)`, '', 'rtl')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={content.deviceFields[2]!.en} ar={content.deviceFields[2]!.ar} /></span>
                  <YesNo name="accessibleHours" initial={true} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={content.deviceFields[3]!.en} ar={content.deviceFields[3]!.ar} /></span>
                  <YesNo name="publiclyAccessible" initial={false} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={content.deviceFields[4]!.en} ar={content.deviceFields[4]!.ar} /></span>
                  <PediatricPick />
                </div>
                {dateField('padExpiry', content.deviceDates[1]!.en, content.deviceDates[1]!.ar, null)}
                {dateField('batteryExpiry', content.deviceDates[2]!.en, content.deviceDates[2]!.ar, null)}
                {dateField('latestCheck', content.deviceDates[0]!.en, content.deviceDates[0]!.ar, null)}
              </>
            ) : null}
            {purpose === 'annual' ? (
              <>
                {content.deviceReadinessChecks.map((c) => (
                  <div key={c.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, flex: 1, minWidth: 220 }}><L en={c.en} ar={c.ar} /></span>
                    <YesNo name={`check_${c.key}`} initial={true} />
                  </div>
                ))}
                {dateField('latestCheck', content.deviceDates[0]!.en, content.deviceDates[0]!.ar, today)}
              </>
            ) : null}
            {purpose === 'relocation' ? (
              <>
                {textField('location', 'New exact location', 'الموقع الدقيق الجديد', device?.locationEn ?? '')}
                {textField('locationAr', 'New exact location (Arabic)', 'الموقع الدقيق الجديد (بالعربية)', device?.locationAr ?? '', 'rtl')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={content.deviceFields[2]!.en} ar={content.deviceFields[2]!.ar} /></span>
                  <YesNo name="accessibleHours" initial={device?.accessibleHours ?? true} />
                </div>
              </>
            ) : null}
            {purpose === 'replacement' ? (
              <>
                {textField('identification', 'New barcode, QR code or serial number', 'الرمز الشريطي أو رمز الاستجابة السريعة أو الرقم التسلسلي الجديد', '')}
                {dateField('padExpiry', content.deviceDates[1]!.en, content.deviceDates[1]!.ar, null)}
                {dateField('batteryExpiry', content.deviceDates[2]!.en, content.deviceDates[2]!.ar, null)}
              </>
            ) : null}
            {purpose === 'statusChange' ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en="Operational" ar="صالح للتشغيل" /></span>
                  <YesNo name="operational" initial={device?.operational ?? true} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={content.deviceFields[2]!.en} ar={content.deviceFields[2]!.ar} /></span>
                  <YesNo name="accessibleHours" initial={device?.accessibleHours ?? true} />
                </div>
                {textField('reason', 'Reason for the change', 'سبب التغيير', '')}
              </>
            ) : null}
          </div>

          <div style={{ paddingBlockStart: 18, borderBlockStart: '1px solid var(--line)', marginBlockEnd: 18 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
              <L en="Coordinator" ar="المنسّق" />
            </div>
            <div style={{ fontSize: '14.5px', marginBlockEnd: 4 }}>{coordinatorName || '—'}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en="Read from the facility record." ar="يُقرأ من سجل المنشأة." />
            </div>
          </div>

          <div style={{ paddingBlockStart: 18, borderBlockStart: '1px solid var(--line)', marginBlockEnd: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <L en={content.deviceConfirmation.en} ar={content.deviceConfirmation.ar} />
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
              <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                <L en={content.deviceConfirmation.signatoryEn} ar={content.deviceConfirmation.signatoryAr} />
              </span>
              <input name="representative" required style={inputStyle} />
            </label>
          </div>

          <button
            type="submit"
            style={{ height: 46, paddingInline: 24, border: 0, borderRadius: 23, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            <L en={purposeDef.ctaEn} ar={purposeDef.ctaAr} />
          </button>
        </div>
      </form>
    </div>
  );
}

function PediatricPick() {
  const [v, setV] = useState<'yes' | 'no' | 'na'>('no');
  const opts: { k: 'yes' | 'no' | 'na'; en: string; ar: string }[] = [
    { k: 'yes', en: 'Yes', ar: 'نعم' },
    { k: 'no', en: 'No', ar: 'لا' },
    { k: 'na', en: 'Not applicable', ar: 'غير منطبق' },
  ];
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          aria-pressed={v === o.k}
          onClick={() => setV(o.k)}
          style={{ padding: '6px 14px', border: `1px solid ${v === o.k ? 'var(--brand)' : 'var(--line)'}`, background: v === o.k ? 'var(--brand-soft)' : 'var(--bg)', color: v === o.k ? 'var(--brand)' : 'var(--muted)', borderRadius: 16, fontSize: 13, cursor: 'pointer' }}
        >
          <L en={o.en} ar={o.ar} />
        </button>
      ))}
      <input type="hidden" name="pediatric" value={v} />
    </span>
  );
}
