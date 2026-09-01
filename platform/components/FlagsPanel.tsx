import { L } from './L';
import { ALL_FLAGS, effectiveFlag, flagDescription } from '../lib/rules/flags';
import { ministryConfig } from '../lib/queries';
import { setFeatureFlagAction } from '../app/ministry-actions';

/**
 * The capability switches, once, for both consoles.
 *
 * The partner ruling has two halves and this panel is both: every flag is GENUINELY
 * CONTROLLABLE (a real switch recording a governance decision in ministry_config —
 * the screen used to report the states and refuse to touch them), and no flag sits
 * there off with no explanation — each carries a plain-language line saying what
 * turning it on does, from feature-flags.json beside the flag it describes.
 *
 * Rendered on the master administrator's Configuration tab and the platform owner's
 * console alike: the two see the same thing because they render the same component
 * over the same data, which is what "synced" means here.
 *
 * Capability is not content (non-negotiable 12): the shipped defaults stay off, and
 * nothing commercial renders while they are.
 */
export function FlagsPanel() {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  return (
    <div data-region="flags" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 860 }}>
      {ALL_FLAGS.map((flag) => {
        const on = effectiveFlag(flag, config);
        const desc = flagDescription(flag);
        return (
          <div key={flag} style={{ padding: '15px 21px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{flag}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, lineHeight: 1.55 }}>
                <L en={desc.en} ar={desc.ar} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: on ? 'var(--brand-soft)' : 'var(--surface2)', border: on ? 0 : '1px solid var(--line)', color: on ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px', letterSpacing: '.04em' }}>
                {on ? <L en="ON" ar="مشغّل" /> : <L en="OFF" ar="مطفأ" />}
              </span>
              <form action={setFeatureFlagAction}>
                <input type="hidden" name="flag" value={flag} />
                <input type="hidden" name="state" value={on ? 'off' : 'on'} />
                <button type="submit" style={{ height: 32, paddingInline: 14, border: on ? '1px solid var(--line)' : 0, borderRadius: 16, background: on ? 'var(--bg)' : 'var(--brand)', color: on ? 'var(--ink)' : 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                  {on ? <L en="Turn off" ar="إطفاء" /> : <L en="Turn on" ar="تشغيل" />}
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
