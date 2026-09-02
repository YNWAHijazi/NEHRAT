import Link from 'next/link';
import { L } from './L';
import { FLAG_GROUPS, effectiveFlag, flagDescription, flagDetail, groupFlags, groupNote, groupTitle } from '../lib/rules/flags';
import { ministryConfig } from '../lib/queries';

/**
 * The capability list, and only a list (partner ruling, 2026-09-02): each row is
 * a capability, one line on what it is, its state, and where its page opens. No
 * control here -- the toggle lives on the capability's own page, beneath what it
 * is and above its configuration, because a capability with no configuration
 * cannot be enabled and a list-row switch cannot say what is missing.
 *
 * Two groups from the data: commercial (excluded by the readiness policy from
 * its own scope, permitted as licensed platform capability) and assistive.
 * Capability is not content (non-negotiable 12): the shipped defaults stay off,
 * and nothing commercial renders while they are.
 */
export function FlagsPanel() {
  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  return (
    <div data-region="flags" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860, marginBlockEnd: 28 }}>
      {FLAG_GROUPS.map((group) => {
        const title = groupTitle(group);
        const note = groupNote(group);
        return (
          <div key={group} data-region={`flags-${group}`}>
            <h2 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>
              <L en={title.en} ar={title.ar} />
            </h2>
            <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '84ch' }}>
              <L en={note.en} ar={note.ar} />
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupFlags(group).map((flag) => {
                const on = effectiveFlag(flag, config);
                const desc = flagDescription(flag);
                const detail = flagDetail(flag);
                return (
                  <div key={flag} style={{ padding: '15px 21px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 500 }}>
                        <L en={detail.titleEn} ar={detail.titleAr} />
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, lineHeight: 1.55 }}>
                        <L en={desc.en} ar={desc.ar} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: on ? 'var(--brand-soft)' : 'var(--surface2)', border: on ? 0 : '1px solid var(--line)', color: on ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px', letterSpacing: '.04em' }}>
                        {on ? <L en="ON" ar="مشغّلة" /> : <L en="OFF" ar="مطفأة" />}
                      </span>
                      <Link href={`/platform/admin/capabilities/${flag}`} style={{ height: 32, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--bg)', color: 'var(--ink)', fontSize: '12.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                        <L en="Open" ar="فتح" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
