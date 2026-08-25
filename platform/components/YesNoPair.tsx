import { L } from './L';

/**
 * A Yes button and a No button (reviewer instruction, Slice 5 review): two controls,
 * not one flipping between the answers. Unanswered is its own state -- neither is
 * pre-selected, because a default "No" asserts an answer nobody gave.
 *
 * Non-negotiable #0 depends on it: with a real null the derivation returns
 * "incomplete" naming the field; with a seeded false it silently derives a level
 * from a question nobody was asked.
 */
const pillOff: React.CSSProperties = {
  height: 36,
  paddingInline: 18,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--muted)',
  borderRadius: 18,
  fontSize: 14,
  cursor: 'pointer',
};
const pillOn: React.CSSProperties = {
  ...pillOff,
  border: '1px solid var(--brand)',
  background: 'var(--brand-soft)',
  color: 'var(--brand)',
};

export function YesNoPair({
  value,
  onPick,
}: {
  value: boolean | null;
  onPick: (v: boolean) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button type="button" data-yesno="yes" aria-pressed={value === true} onClick={() => onPick(true)} style={value === true ? pillOn : pillOff}>
        <L en="Yes" ar="نعم" />
      </button>
      <button type="button" data-yesno="no" aria-pressed={value === false} onClick={() => onPick(false)} style={value === false ? pillOn : pillOff}>
        <L en="No" ar="لا" />
      </button>
    </span>
  );
}
