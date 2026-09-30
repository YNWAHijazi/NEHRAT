/**
 * The workspace vocabulary the event screens established, named once so the venue
 * screens use the same pieces instead of browser defaults.
 */

/** A tab's own title, under the workspace header ("Submission package", "Venue details"). */
export const pageTitle: React.CSSProperties = { fontSize: 28, marginBlock: '0 24px' };

/** The primary action: filled, rounded, brand. */
export const primaryButton: React.CSSProperties = {
  height: 44,
  paddingInline: 22,
  border: 0,
  borderRadius: 22,
  background: 'var(--brand)',
  color: 'var(--bg)',
  fontSize: '14.5px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
};

/** A secondary action beside or under content: outlined, same shape. */
export const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink)',
};

/** A quiet state band -- read-only, missing details, saved. */
export const noticeBand: React.CSSProperties = {
  padding: '16px 22px',
  background: 'var(--surface2)',
  borderRadius: 12,
  marginBlockEnd: 20,
  fontSize: '14.5px',
  lineHeight: 1.6,
};

/** Something the user must fix before the action works. */
export const alertBand: React.CSSProperties = {
  ...noticeBand,
  background: 'var(--accent-soft)',
  border: '1px solid var(--accent)',
};

/** A text input or textarea. */
export const fieldInput: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'var(--bg)',
  fontFamily: 'inherit',
  fontSize: 15,
};

/** A status chip at the end of a row, in the three states a row can be in. */
export function chip(tone: 'done' | 'pending' | 'muted' | 'bad'): React.CSSProperties {
  const palette = {
    done: { color: 'var(--brand)', background: 'var(--brand-soft)' },
    pending: { color: 'var(--accent-ink)', background: 'var(--accent-soft)' },
    muted: { color: 'var(--muted)', background: 'var(--surface2)' },
    bad: { color: 'var(--bad)', background: 'var(--bad-soft)' },
  }[tone];
  return { ...palette, flexShrink: 0, padding: '4px 10px', borderRadius: 999, fontSize: 13 };
}
