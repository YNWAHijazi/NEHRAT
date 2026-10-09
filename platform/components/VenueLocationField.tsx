'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { L } from './L';
import { LangInput, useDocumentLang } from './OptionText';
import type { HostingVenueOption } from '../lib/hosting-venues';
import { matchHostingVenues, textNamesVenue } from '../lib/hosting-venue-match';

/** The venue name to write into the location field, in the language the screen is read in. */
export function venueNameIn(venue: HostingVenueOption, lang: 'en' | 'ar'): string {
  return lang === 'ar' ? venue.nameAr : venue.nameEn;
}

const showAllStyle: React.CSSProperties = {
  flex: 'none',
  minBlockSize: '44px',
  paddingInline: '16px',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: '22px',
  fontSize: '14px',
  color: 'var(--ink)',
  cursor: 'pointer',
};

const optionRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '4px 8px',
  minBlockSize: '44px',
  paddingBlock: '10px',
  paddingInline: '14px',
  boxSizing: 'border-box',
  cursor: 'pointer',
  textAlign: 'start',
};

function VenueLine({ venue }: { venue: HostingVenueOption }) {
  const detail = (lang: 'en' | 'ar') =>
    [lang === 'en' ? venue.districtEn : venue.districtAr, lang === 'en' ? venue.id : `⁦${venue.id}⁩`]
      .filter(Boolean)
      .join(' · ');
  return (
    <>
      <span style={{ fontSize: '15px', color: 'var(--ink)' }}>
        <L en={venue.nameEn} ar={venue.nameAr} />
      </span>
      <span style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        <L en={detail('en')} ar={detail('ar')} />
      </span>
    </>
  );
}

/**
 * "Venue, route, or location", with the registered venues behind it (platform owner,
 * 8 October 2026).
 *
 * Typing shows matching registered venues under the field -- an ARIA combobox: arrow
 * keys move, Enter chooses, Escape closes, a click chooses. "Show all registered
 * venues" opens the whole list in a modal dialog with its own search. Choosing a venue
 * in either place writes its name into the field and links the event to it by record
 * id; the link is never made by matching a typed name. Typed text stays typed text: a
 * route or an unregistered place links nothing, and editing the text away from the
 * chosen name removes the link. The link, when there is one, is stated in one line
 * with a Remove control.
 *
 * The component is controlled: the screen holds the text and the link, so the fixed-
 * venue selector further down the form reads and sets the same link -- one source of
 * truth. Inside a plain form, `textName` and `linkName` make both submit with it.
 */
export function VenueLocationField({
  options,
  text,
  onTextChange,
  linkedId,
  onLinkedChange,
  labelEn,
  labelAr,
  labelStyle,
  inputStyle,
  textName,
  linkName,
}: {
  options: HostingVenueOption[];
  text: string;
  onTextChange: (text: string) => void;
  /** The linked venue's record id; '' when the event is linked to none. */
  linkedId: string;
  onLinkedChange: (venueId: string) => void;
  labelEn: string;
  labelAr: string;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  textName?: string;
  linkName?: string;
}) {
  const lang = useDocumentLang();
  const listboxId = useId();
  const optionPrefix = useId();
  const dialogTitleId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [dialogQuery, setDialogQuery] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreOverflow = useRef<string | null>(null);

  const linked = options.find((o) => o.id === linkedId) ?? null;
  const suggestions = useMemo(() => (text.trim() === '' ? [] : matchHostingVenues(options, text)), [options, text]);
  const shown = open && suggestions.length > 0;
  const dialogList = useMemo(
    () => matchHostingVenues(options, dialogQuery, { includeDistrict: true }),
    [options, dialogQuery],
  );

  const choose = (venue: HostingVenueOption) => {
    onTextChange(venueNameIn(venue, lang));
    onLinkedChange(venue.id);
    setOpen(false);
    setActive(-1);
  };

  const type = (value: string) => {
    onTextChange(value);
    // Editing the text away from the chosen name unlinks; nothing ever links by name.
    if (linked && !textNamesVenue(value, linked)) onLinkedChange('');
    setOpen(true);
    setActive(-1);
  };

  useEffect(() => {
    if (!shown || active < 0) return;
    document.getElementById(`${optionPrefix}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [shown, active, optionPrefix]);

  const unlockPage = () => {
    if (restoreOverflow.current !== null) {
      document.documentElement.style.overflow = restoreOverflow.current;
      restoreOverflow.current = null;
    }
  };
  // A dialog still open when the screen goes away must not leave the page locked.
  useEffect(() => unlockPage, []);

  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setDialogQuery('');
    // The page behind the dialog does not scroll while it is open.
    restoreOverflow.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
  };
  const closeDialog = () => dialogRef.current?.close();

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      if (!shown) {
        setOpen(true);
        setActive(0);
      } else setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      if (!shown) return;
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const venue = shown && active >= 0 ? suggestions[active] : undefined;
      if (venue) {
        e.preventDefault();
        choose(venue);
      }
    } else if (e.key === 'Escape') {
      if (shown) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const input = (
    <input
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={shown}
      aria-controls={listboxId}
      aria-activedescendant={shown && active >= 0 ? `${optionPrefix}-${active}` : undefined}
      autoComplete="off"
      name={textName}
      data-field="venueRoute"
      value={text}
      onChange={(e) => type(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        setOpen(false);
        setActive(-1);
      }}
      style={inputStyle}
    />
  );

  return (
    <div data-region="venue-location" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '8px' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelStyle}>
              <L en={labelEn} ar={labelAr} />
            </span>
            {input}
          </label>
          {shown ? (
            <ul
              id={listboxId}
              role="listbox"
              data-region="venue-suggestions"
              aria-label={lang === 'ar' ? 'المواقع المسجّلة المطابقة' : 'Matching registered venues'}
              style={{
                position: 'absolute',
                insetBlockStart: '100%',
                insetInlineStart: '0',
                insetInlineEnd: '0',
                zIndex: 20,
                marginBlock: '4px 0',
                marginInline: '0',
                padding: '4px 0',
                listStyle: 'none',
                maxBlockSize: '280px',
                overflowY: 'auto',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              }}
            >
              {suggestions.map((venue, i) => (
                <li
                  key={venue.id}
                  id={`${optionPrefix}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-venue-id={venue.id}
                  // Keep focus in the field, so choosing does not first blur and close the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(venue)}
                  onMouseMove={() => setActive(i)}
                  style={{ ...optionRow, background: i === active ? 'var(--surface2)' : 'var(--bg)' }}
                >
                  <VenueLine venue={venue} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {options.length > 0 ? (
          <button type="button" aria-haspopup="dialog" data-action="show-all-venues" onClick={openDialog} style={showAllStyle}>
            <L en="Show all registered venues" ar="عرض جميع المواقع المسجّلة" />
          </button>
        ) : null}
      </div>

      {linkName !== undefined ? <input type="hidden" name={linkName} value={linked ? linked.id : ''} /> : null}

      {linked ? (
        <p
          data-region="linked-venue"
          style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 10px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}
        >
          <span>
            <L
              en={`Registered venue: ${linked.nameEn} · ${linked.id}`}
              ar={`الموقع المسجّل: ${linked.nameAr} · ⁦${linked.id}⁩`}
            />
          </span>
          <button
            type="button"
            data-action="unlink-venue"
            onClick={() => onLinkedChange('')}
            style={{ minBlockSize: '44px', paddingInline: '8px', border: 0, background: 'transparent', color: 'var(--brand)', fontSize: '13.5px', textDecoration: 'underline', cursor: 'pointer' }}
          >
            <L en="Remove" ar="إزالة" />
          </button>
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        data-region="all-venues-dialog"
        onClose={unlockPage}
        style={{
          inlineSize: 'min(560px, calc(100vw - 32px))',
          maxBlockSize: 'min(640px, calc(100vh - 64px))',
          padding: '24px',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          background: 'var(--bg)',
          color: 'var(--ink)',
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 id={dialogTitleId} style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-.015em' }}>
            <L en="Registered venues" ar="المواقع المسجّلة" />
          </h2>
          <LangInput
            type="search"
            autoFocus
            value={dialogQuery}
            onChange={(e) => setDialogQuery(e.target.value)}
            // Enter in the search must not submit the form the field sits in.
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholderEn="Search by name, district or record ID"
            placeholderAr="ابحثوا بالاسم أو القضاء أو معرّف السجل"
            labelEn="Search the registered venues"
            labelAr="البحث في المواقع المسجّلة"
            data-field="allVenuesSearch"
            style={{ ...inputStyle, inlineSize: '100%', boxSizing: 'border-box' }}
          />
          <ul
            data-region="all-venues-list"
            style={{ margin: 0, padding: 0, listStyle: 'none', maxBlockSize: '50vh', overflowY: 'auto', overscrollBehavior: 'contain', border: '1px solid var(--line)', borderRadius: '10px' }}
          >
            {dialogList.map((venue) => (
              <li key={venue.id} style={{ borderBlockEnd: '1px solid var(--line)' }}>
                <button
                  type="button"
                  data-venue-id={venue.id}
                  aria-pressed={venue.id === linkedId}
                  onClick={() => {
                    choose(venue);
                    closeDialog();
                  }}
                  style={{ ...optionRow, inlineSize: '100%', border: 0, background: venue.id === linkedId ? 'var(--brand-soft)' : 'var(--bg)' }}
                >
                  <VenueLine venue={venue} />
                </button>
              </li>
            ))}
          </ul>
          {dialogList.length === 0 ? (
            <p role="status" style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en="No registered venue matches the search." ar="لا يوجد موقع مسجّل يطابق البحث." />
            </p>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'end' }}>
            <button type="button" data-action="close-all-venues" onClick={closeDialog} style={showAllStyle}>
              <L en="Close" ar="إغلاق" />
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
