'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { L } from './L';
import { useDocumentLang } from './OptionText';
import { municipalityNamed, searchMunicipalities, type Municipality } from '../lib/rules/municipalities';

/**
 * THE MUNICIPALITY FIELD (owner, 9 October 2026): a searchable list like the site field on an
 * event. Focusing the field opens the list; typing narrows it, in English or Arabic. Each option
 * shows in the page's language only; both names are stored, in hidden fields `nameEn` and
 * `nameAr`. With `multiple`, each chosen municipality becomes a tag with a Remove control and
 * the stored value is the names joined by commas. An ARIA combobox: arrow keys move, Enter
 * chooses, Escape closes.
 *
 * Used only when the official list is loaded: while it is empty the screens keep their typed field.
 */
export function MunicipalityField({
  options,
  multiple = false,
  value,
  onChange,
  labelEn,
  labelAr,
  labelStyle,
  inputStyle,
  nameEn,
  nameAr,
  invalid,
}: {
  options: readonly Municipality[];
  multiple?: boolean;
  /** The chosen municipalities' English names. */
  value: string[];
  onChange: (chosen: Municipality[]) => void;
  labelEn: string;
  labelAr: string;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  nameEn?: string;
  nameAr?: string;
  invalid?: boolean;
}) {
  const lang = useDocumentLang();
  const listboxId = useId();
  const optionPrefix = useId();
  const chosen = value.map((v) => municipalityNamed(options, v)).filter((m): m is Municipality => m !== null);
  const label = (m: Municipality) => (lang === 'ar' ? m.ar : m.en);
  // A single choice shows its name in the field; a multiple choice keeps the field for searching.
  const [query, setQuery] = useState(!multiple && chosen[0] ? label(chosen[0]) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!multiple) setQuery(chosen[0] ? label(chosen[0]) : '');
    // Re-label when the page language changes or the choice changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, value.join('|')]);

  const searching = !multiple && chosen[0] && query === label(chosen[0]) ? '' : query;
  const suggestions = useMemo(
    () => searchMunicipalities(options, searching).filter((m) => !(multiple && chosen.some((c) => c.en === m.en))),
    [options, searching, multiple, chosen],
  );
  const shown = open && suggestions.length > 0;

  useEffect(() => {
    if (shown && active >= 0) document.getElementById(`${optionPrefix}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [shown, active, optionPrefix]);

  const choose = (m: Municipality) => {
    if (multiple) {
      onChange([...chosen, m]);
      setQuery('');
    } else {
      onChange([m]);
      setQuery(label(m));
      setOpen(false);
    }
    setActive(-1);
  };
  const remove = (m: Municipality) => onChange(chosen.filter((c) => c.en !== m.en));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (suggestions.length === 0 ? -1 : (i + 1) % suggestions.length));
    } else if (e.key === 'ArrowUp') {
      if (!shown) return;
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (shown) {
        e.preventDefault();
        const m = suggestions[active >= 0 ? active : 0];
        if (m) choose(m);
      }
    } else if (e.key === 'Escape' && shown) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Backspace' && multiple && query === '' && chosen.length > 0) {
      remove(chosen[chosen.length - 1]!);
    }
  };

  return (
    <div data-region="municipality-field" data-multiple={multiple || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}><L en={labelEn} ar={labelAr} /></span>
          <input
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={shown}
            aria-controls={listboxId}
            aria-activedescendant={shown && active >= 0 ? `${optionPrefix}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            data-field="municipality-search"
            value={query}
            placeholder={lang === 'ar' ? 'ابحثوا أو اختاروا من القائمة' : 'Search or choose from the list'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
              // Editing a single choice's name away from it clears the choice: only a listed name is stored.
              if (!multiple && chosen[0] && e.target.value !== label(chosen[0])) onChange([]);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => { setOpen(false); setActive(-1); }}
            onKeyDown={onKeyDown}
            style={inputStyle}
          />
        </label>
        {shown ? (
          <ul
            id={listboxId}
            role="listbox"
            data-region="municipality-options"
            aria-label={lang === 'ar' ? 'البلديات' : 'Municipalities'}
            style={{ position: 'absolute', insetBlockStart: '100%', insetInlineStart: 0, insetInlineEnd: 0, zIndex: 20, marginBlock: '4px 0', marginInline: 0, padding: '4px 0', listStyle: 'none', maxBlockSize: 280, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
          >
            {suggestions.map((m, i) => (
              <li
                key={m.en}
                id={`${optionPrefix}-${i}`}
                role="option"
                aria-selected={i === active}
                data-municipality={m.en}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(m)}
                onMouseMove={() => setActive(i)}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline', minBlockSize: 44, padding: '10px 14px', cursor: 'pointer', fontSize: 14.5, background: i === active ? 'var(--surface2)' : 'var(--bg)' }}
              >
                <span>{label(m)}</span>
                {m.districtEn ? <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{lang === 'ar' ? m.districtAr ?? m.districtEn : m.districtEn}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {multiple && chosen.length > 0 ? (
        <ul data-region="municipality-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
          {chosen.map((m) => (
            <li key={m.en} data-municipality-tag={m.en} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInlineStart: 12, borderRadius: 999, background: 'var(--surface2)', fontSize: 14 }}>
              <span>{label(m)}</span>
              <button type="button" onClick={() => remove(m)} aria-label={lang === 'ar' ? `إزالة ${m.ar}` : `Remove ${m.en}`}
                style={{ minBlockSize: 36, minInlineSize: 36, border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 16, cursor: 'pointer', borderRadius: 999 }}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {nameEn ? <input type="hidden" name={nameEn} value={chosen.map((m) => m.en).join(', ')} /> : null}
      {nameAr ? <input type="hidden" name={nameAr} value={chosen.map((m) => m.ar).join('، ')} /> : null}
    </div>
  );
}
