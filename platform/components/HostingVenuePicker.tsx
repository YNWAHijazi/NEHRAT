'use client';

import { useId, useMemo, useState } from 'react';
import { L } from './L';
import { InfoNote } from './InfoNote';
import { LangInput, OptionText } from './OptionText';
import type { HostingVenueOption } from '../lib/hosting-venues';

const control: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
  width: '100%',
  minWidth: 0,
  color: 'var(--ink)',
};

/**
 * The registered venue an event at a fixed venue names (platform owner, 8 October 2026).
 * A search box narrows a native select: the select is what a phone shows as its own
 * picker and what a screen reader announces as a list; the search only shortens it.
 * The options carry the name, the district and the record id -- nothing else about a
 * venue reaches this screen. An empty register is one line, and the organizer carries on.
 */
export function HostingVenuePicker({
  options,
  value,
  defaultValue,
  onChange,
  name,
}: {
  options: HostingVenueOption[];
  /** Controlled: the parent holds the choice. */
  value?: string;
  /** Uncontrolled, inside a plain form: the stored choice to open on. */
  defaultValue?: string;
  onChange?: (venueId: string) => void;
  /** Set when the picker sits inside a plain form, so the choice submits with it. */
  name?: string;
}) {
  const selectId = useId();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(defaultValue ?? '');
  const current = value !== undefined ? value : chosen;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return options;
    return options.filter(
      (o) =>
        o.id === current ||
        [o.nameEn, o.nameAr, o.districtEn, o.districtAr, o.id].some((t) => t.toLowerCase().includes(q)),
    );
  }, [options, query, current]);

  if (options.length === 0) {
    return (
      <p data-region="hosting-venue" data-empty="" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
        <L
          en="No hosting venue is registered on the platform yet. You can continue without choosing one."
          ar="لا يوجد موقع مستضيف للفعاليات مسجّل على المنصة بعد. يمكنكم المتابعة دون اختيار موقع."
        />
      </p>
    );
  }

  const label = (o: HostingVenueOption, lang: 'en' | 'ar') =>
    [lang === 'en' ? o.nameEn : o.nameAr, lang === 'en' ? o.districtEn : o.districtAr, o.id].filter(Boolean).join(' · ');

  return (
    <div data-region="hosting-venue" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13.5px', color: 'var(--muted)' }}>
        <label htmlFor={selectId}>
          <L en="Hosting venue" ar="الموقع المستضيف" />
        </label>
        <InfoNote labelEn="About the hosting venue" labelAr="حول الموقع المستضيف">
          <L
            en="The list shows the hosting venues registered on the platform. If the venue is not listed, it may not be registered yet; you can continue without choosing one."
            ar="تعرض القائمة مواقع استضافة الفعاليات المسجّلة على المنصة. إذا لم يكن الموقع مدرجاً فقد لا يكون مسجّلاً بعد، ويمكنكم المتابعة دون اختيار موقع."
          />
        </InfoNote>
      </div>
      {options.length > 1 ? (
        <LangInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholderEn="Search by name, district or record ID"
          placeholderAr="ابحثوا بالاسم أو القضاء أو معرّف السجل"
          labelEn="Search the registered venues"
          labelAr="البحث في المواقع المسجّلة"
          data-field="hostingVenueSearch"
          style={control}
        />
      ) : null}
      <select
        id={selectId}
        name={name}
        data-field="hostingVenueId"
        value={current}
        onChange={(e) => {
          setChosen(e.target.value);
          onChange?.(e.target.value);
        }}
        style={{ ...control, appearance: 'auto' }}
      >
        <option value="">
          <OptionText en="Choose the registered venue" ar="اختاروا الموقع المسجّل" />
        </option>
        {visible.map((o) => (
          <option key={o.id} value={o.id}>
            <OptionText en={label(o, 'en')} ar={label(o, 'ar')} />
          </option>
        ))}
      </select>
      {query.trim() !== '' && visible.length === 0 ? (
        <p role="status" style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en="No registered venue matches the search." ar="لا يوجد موقع مسجّل يطابق البحث." />
        </p>
      ) : null}
    </div>
  );
}
