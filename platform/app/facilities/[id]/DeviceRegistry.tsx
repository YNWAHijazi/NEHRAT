'use client';

/**
 * The registry table and the device record card. LEAN BY THE PARTNER AUDIT
 * (2026-10-08): a record is the device identifier, its exact location, an optional
 * separate map pin, accessibility during operating hours, public accessibility,
 * operational state, pediatric capability, the registration or update purpose, an
 * optional photo of the installed device, and the facility confirmation signed by
 * the representative. No maintenance dates, no annual readiness confirmation, no
 * coordinator on the record. The status column derives from the record itself.
 */

import { LocationPicker } from '../../../components/maps/LocationPicker';
import { InfoNote } from '../../../components/InfoNote';
import type { MapPoint } from '../../../lib/rules/geolocation';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { registerAutosave } from '../../../components/record/autosave';
import { autosaveFacilityDeviceAction, saveFacilityDeviceAction } from '../../actions';
import { FACILITY_CONTENT, deviceStatus } from '../../../lib/rules';
import { imageAcceptAttribute, refuseImageUpload } from '../../../lib/rules/uploads';
import type { FacilityDevice } from '../../../lib/queries';

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
        style={{ minHeight: 44, padding: '6px 14px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 22, fontSize: 13, cursor: 'pointer' }}
      >
        <L en="Yes" ar="نعم" />
      </button>
      <button
        type="button"
        aria-pressed={!on}
        onClick={() => setOn(false)}
        style={{ minHeight: 44, padding: '6px 14px', border: `1px solid ${!on ? 'var(--brand)' : 'var(--line)'}`, background: !on ? 'var(--brand-soft)' : 'var(--bg)', color: !on ? 'var(--brand)' : 'var(--muted)', borderRadius: 22, fontSize: 13, cursor: 'pointer' }}
      >
        <L en="No" ar="لا" />
      </button>
      <input type="hidden" name={name} value={on ? 'yes' : 'no'} />
    </span>
  );
}

/** The registry status chip: the rule derives it (lib/rules/facility.ts); the screen only colours it. */
function statusChip(d: Pick<FacilityDevice, 'operational' | 'accessibleHours'>): { en: string; ar: string; color: string; chipBg: string } {
  const st = deviceStatus(d);
  return st.key === 'operational'
    ? { ...st, color: 'var(--brand)', chipBg: 'var(--brand-soft)' }
    : { ...st, color: 'var(--bad)', chipBg: 'var(--bad-soft)' };
}

/** A form's entries as one comparable string: what was typed, chosen or attached. */
function formSnapshot(form: HTMLFormElement): string {
  return [...new FormData(form).entries()].map(([k, v]) => `${k}=${typeof v === 'string' ? v : `file:${v.name}:${v.size}`}`).join('&');
}

export function DeviceRegistry({
  facilityId,
  devices,
  facilityLocation,
  deviceLocations,
  editable = true,
}: {
  facilityId: string;
  devices: FacilityDevice[];
  facilityLocation: MapPoint | null;
  deviceLocations: Record<string, MapPoint | null>;
  /** An archived record shows its registry and offers no form. */
  editable?: boolean;
}) {
  const content = FACILITY_CONTENT;
  const router = useRouter();
  // A new facility has no AED yet: the form opens on a first registration (owner, 9 October 2026).
  const [selected, setSelected] = useState<string | null>(devices[0]?.label ?? null);
  const [purpose, setPurpose] = useState('initial');
  // A managed registry opens its card on demand (owner, 9 October 2026): the add button or a row
  // opens it; a facility with no AED yet shows it open, since registering one is the task.
  const [cardOpen, setCardOpen] = useState(devices.length === 0);
  const device = devices.find((d) => d.label === selected) ?? null;

  // Next on the record page registers a device typed and not yet saved (components/record/autosave.ts);
  // a refusal keeps the person on the AED step with the reason under the form.
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const baseline = useRef('');
  const [autosaveRefused, setAutosaveRefused] = useState(false);
  // A saved form starts again blank, so the same device is never registered twice.
  const [saves, setSaves] = useState(0);
  useEffect(() => { if (form.current) baseline.current = formSnapshot(form.current); setAutosaveRefused(false); }, [selected, purpose, saves]);
  useEffect(() => {
    if (!editable || !root.current) return;
    return registerAutosave(root.current, async () => {
      const f = form.current;
      if (!f || formSnapshot(f) === baseline.current) return true;
      const result = await autosaveFacilityDeviceAction(facilityId, new FormData(f));
      if ('ok' in result) { setAutosaveRefused(false); setSaves((n) => n + 1); router.refresh(); return true; }
      setAutosaveRefused(true);
      return false;
    });
  }, [editable, facilityId, router]);
  const field = (key: string) => content.deviceFields.find((f) => f.key === key)!;

  const textField = (key: string, en: string, ar: string, initial: string, dir?: 'rtl') => (
    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14 }}>
        <L en={en} ar={ar} />
      </span>
      <input name={key} defaultValue={initial} {...(dir ? { dir } : {})} style={inputStyle} />
    </label>
  );
  const yesNoRow = (key: string, en: string, ar: string, initial: boolean) => (
    <div key={key} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
      <span style={{ fontSize: 14 }}><L en={en} ar={ar} /></span>
      <YesNo name={key} initial={initial} />
    </div>
  );

  const purposeDef = content.devicePurposes.find((p) => p.key === purpose) ?? content.devicePurposes[0]!;
  const isInitial = purpose === 'initial';
  const withMapAndPhoto = ['initial', 'relocation', 'replacement', 'ministryUpdate'].includes(purpose);

  return (
    <div ref={root} data-region="device-registry">
      <div data-region="registry-table" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 44 }}>
        {[
          { en: 'Device', ar: 'الجهاز' },
          { en: 'Location', ar: 'الموقع' },
          { en: 'Accessible', ar: 'متاح للوصول' },
          { en: 'Status', ar: 'الحالة' },
        ].map((h) => (
          <div key={h.en} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <L en={h.en} ar={h.ar} />
          </div>
        ))}
        {devices.length === 0 ? (
          <div data-region="registry-empty" style={{ gridColumn: '1 / -1', background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px', color: 'var(--muted)' }}>
            <L en="No AED registered yet." ar="لم يُسجَّل أي جهاز بعد." />
          </div>
        ) : null}
        {devices.map((d) => {
          const st = statusChip(d);
          return [
            <button key={`${d.label}-a`} type="button" disabled={!editable} onClick={() => { setSelected(d.label); setPurpose('statusChange'); setCardOpen(true); }} style={{ textAlign: 'start', border: 0, cursor: 'pointer', background: 'var(--bg)', padding: '16px 18px', fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>
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

      {editable ? <>
      {/* REGISTER ANOTHER (partner ruling, 2026-09-05): a facility has as many
          devices as it has; the registry needed a way to say "one more" without
          leaving the page. Selecting a row edits that device; this clears the
          card back to a blank initial registration. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockEnd: 16 }}>
        <button
          type="button"
          data-region="add-device"
          onClick={() => { setSelected(null); setPurpose('initial'); setCardOpen(true); }}
          style={{ height: 44, paddingInline: 18, border: `1px solid ${cardOpen && isInitial ? 'var(--brand)' : 'var(--line)'}`, background: cardOpen && isInitial ? 'var(--brand-soft)' : 'var(--bg)', color: cardOpen && isInitial ? 'var(--brand)' : 'var(--ink)', borderRadius: 22, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          {devices.length > 0 ? <L en="+ Register another device" ar="+ تسجيل جهاز آخر" /> : <L en="+ Register a device" ar="+ تسجيل جهاز" />}
        </button>
        {devices.length > 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            <L en={`${devices.length} registered`} ar={`${devices.length} مسجّل`} />
          </span>
        ) : null}
      </div>

      <form ref={form} key={`${selected}-${purpose}-${saves}`} action={saveFacilityDeviceAction.bind(null, facilityId)} hidden={!cardOpen}>
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
            <L en="Registration or update purpose" ar="غاية التسجيل أو التحديث" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockEnd: 26 }}>
            {content.devicePurposes.map((p) => {
              const on = purpose === p.key;
              // A device must exist before it can be updated: without one, only the
              // initial registration is offered (rule 10: absent, not greyed).
              if (p.key !== 'initial' && !device) return null;
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPurpose(p.key)}
                  style={{ textAlign: 'start', minHeight: 44, padding: '12px 16px', border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'var(--bg)', color: on ? 'var(--brand)' : 'var(--ink)', borderRadius: 8, fontSize: '14.5px', cursor: 'pointer' }}
                >
                  <L en={p.en} ar={p.ar} />
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 24 }}>
            {purpose === 'initial' ? (
              <>
                {textField('identification', field('identification').en, field('identification').ar, '')}
                {textField('location', field('location').en, field('location').ar, '')}
                {textField('locationAr', `${field('location').en} (Arabic)`, `${field('location').ar} (بالعربية)`, '', 'rtl')}
                {yesNoRow('accessibleHours', field('accessibleHours').en, field('accessibleHours').ar, true)}
                {yesNoRow('publiclyAccessible', field('publiclyAccessible').en, field('publiclyAccessible').ar, false)}
                {yesNoRow('operational', field('operational').en, field('operational').ar, true)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}><L en={field('pediatric').en} ar={field('pediatric').ar} /></span>
                  <PediatricPick />
                </div>
              </>
            ) : null}
            {purpose === 'relocation' ? (
              <>
                {textField('location', 'New exact location', 'الموقع الدقيق الجديد', device?.locationEn ?? '')}
                {textField('locationAr', 'New exact location (Arabic)', 'الموقع الدقيق الجديد (بالعربية)', device?.locationAr ?? '', 'rtl')}
                {yesNoRow('accessibleHours', field('accessibleHours').en, field('accessibleHours').ar, device?.accessibleHours ?? true)}
              </>
            ) : null}
            {purpose === 'replacement' ? (
              <>
                {textField('identification', 'New barcode, QR code or serial number', 'الرمز الشريطي أو رمز الاستجابة السريعة أو الرقم التسلسلي الجديد', '')}
              </>
            ) : null}
            {purpose === 'accessibility' ? (
              <>
                {yesNoRow('accessibleHours', field('accessibleHours').en, field('accessibleHours').ar, device?.accessibleHours ?? true)}
                {yesNoRow('publiclyAccessible', field('publiclyAccessible').en, field('publiclyAccessible').ar, device?.publiclyAccessible ?? false)}
              </>
            ) : null}
            {purpose === 'ministryUpdate' ? (
              <>
                {textField('identification', field('identification').en, field('identification').ar, device?.identification ?? '')}
                {textField('location', field('location').en, field('location').ar, device?.locationEn ?? '')}
                {textField('reason', 'What changed', 'ما الذي تغيّر', '')}
                {yesNoRow('operational', field('operational').en, field('operational').ar, device?.operational ?? true)}
                {yesNoRow('accessibleHours', field('accessibleHours').en, field('accessibleHours').ar, device?.accessibleHours ?? true)}
                {yesNoRow('publiclyAccessible', field('publiclyAccessible').en, field('publiclyAccessible').ar, device?.publiclyAccessible ?? false)}
              </>
            ) : null}
            {purpose === 'statusChange' ? (
              <>
                {yesNoRow('operational', field('operational').en, field('operational').ar, device?.operational ?? true)}
                {yesNoRow('accessibleHours', field('accessibleHours').en, field('accessibleHours').ar, device?.accessibleHours ?? true)}
                {textField('reason', 'Reason for the change', 'سبب التغيير', '')}
              </>
            ) : null}
          </div>

          {withMapAndPhoto ? <DeviceMap initial={deviceLocations[device?.label ?? ''] ?? null} facilityLocation={facilityLocation} /> : null}
          {/* The current photo is part of the record and shows on every purpose; a new
              one is taken only where the device itself is being registered or changed. */}
          {withMapAndPhoto || device?.hasPhoto ? <DevicePhoto facilityId={facilityId} device={device} allowUpload={withMapAndPhoto} /> : null}

          <div style={{ paddingBlockStart: 18, borderBlockStart: '1px solid var(--line)', marginBlockEnd: 20 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Facility confirmation" ar="تأكيد المنشأة" />
            </div>
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
          {autosaveRefused ? (
            <p role="alert" data-region="device-autosave-refused" style={{ margin: '12px 0 0', fontSize: '13.5px', color: 'var(--bad)', lineHeight: 1.55 }}>
              <L en="The device was not saved. Check the device ID, location, representative and map pin, then save again." ar="لم يُحفظ الجهاز. تحقّقوا من معرّف الجهاز وموقعه والممثل والعلامة على الخريطة ثم احفظوا مجدداً." />
            </p>
          ) : null}
        </div>
      </form>
      </> : null}
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
          style={{ minHeight: 44, padding: '6px 14px', border: `1px solid ${v === o.k ? 'var(--brand)' : 'var(--line)'}`, background: v === o.k ? 'var(--brand-soft)' : 'var(--bg)', color: v === o.k ? 'var(--brand)' : 'var(--muted)', borderRadius: 22, fontSize: 13, cursor: 'pointer' }}
        >
          <L en={o.en} ar={o.ar} />
        </button>
      ))}
      <input type="hidden" name="pediatric" value={v} />
    </span>
  );
}

function DeviceMap({ initial, facilityLocation }: { initial: MapPoint | null; facilityLocation: MapPoint | null }) {
  const pin = FACILITY_CONTENT.deviceMapPin;
  const [separate, setSeparate] = useState(Boolean(initial));
  return (
    <div style={{ marginBlock: 20 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}><L en="AED map location" ar="موقع الجهاز على الخريطة" /></h3>
      {/* The help sits beside the label, never inside it: a click on it must not tick the box. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 10, minHeight: 44, alignItems: 'center' }}>
          <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
          <L en={pin.en} ar={pin.ar} />
        </label>
        <InfoNote><L en={pin.noteEn} ar={pin.noteAr} /></InfoNote>
      </div>
      <input type="hidden" name="separatePin" value={separate ? 'yes' : 'no'} />
      {separate ? <LocationPicker prefix="aedMap" initial={initial} center={facilityLocation} /> : <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}><L en={pin.usesFacilityEn} ar={pin.usesFacilityAr} /></p>}
    </div>
  );
}

/** The optional photo of the installed AED. Checked in the screen; the server enforces the same allow-list. */
function DevicePhoto({ facilityId, device, allowUpload }: { facilityId: string; device: FacilityDevice | null; allowUpload: boolean }) {
  const copy = FACILITY_CONTENT.devicePhoto;
  const [error, setError] = useState<{ en: string; ar: string } | null>(null);
  return (
    <div data-region="device-photo" style={{ marginBlock: 20 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}><L en={allowUpload ? copy.en : copy.currentEn} ar={allowUpload ? copy.ar : copy.currentAr} /></h3>
      {device?.hasPhoto ? (
        <figure style={{ margin: '0 0 12px' }}>
          <img
            src={`/api/facility-device-photos/${facilityId}/${device.label}`}
            alt=""
            style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 8, border: '1px solid var(--line)' }}
          />
          <figcaption style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 6 }}><L en={copy.currentEn} ar={copy.currentAr} /></figcaption>
        </figure>
      ) : null}
      {!allowUpload ? null : <><input
        type="file"
        name="photo"
        accept={imageAcceptAttribute()}
        aria-invalid={error ? true : undefined}
        style={{ display: 'block', minHeight: 44, fontSize: 14 }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          const refusal = file ? refuseImageUpload(file) : null;
          setError(refusal);
          event.currentTarget.setCustomValidity(refusal ? (document.documentElement.lang === 'ar' ? refusal.ar : refusal.en) : '');
        }}
      />
      {error ? (
        <p role="alert" style={{ margin: '8px 0 0', color: 'var(--bad)', fontSize: 13 }}><L en={error.en} ar={error.ar} /></p>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}><L en={copy.hintEn} ar={copy.hintAr} /></p>
      )}</>}
    </div>
  );
}
