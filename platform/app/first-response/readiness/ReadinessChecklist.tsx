'use client';

/**
 * The three confirmable groups -- equipment (5), competence (7), operational (5) --
 * each row confirmed or not, saved as the unit's readiness record. Signing the
 * first-response readiness declaration is available once every row is confirmed;
 * until then the control is disabled with the outstanding count beside it.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { L } from '../../../components/L';
import { saveFrReadinessAction } from '../../actions';
import { ROLES_CONTENT } from '../../../lib/rules';

const GROUPS = [
  { key: 'equipment', en: 'Minimum equipment', ar: 'الحد الأدنى من التجهيزات', noteEn: 'Carried on every deployment.', noteAr: 'تُحمَل في كل انتشار.' },
  { key: 'competence', en: 'Personnel competence', ar: 'كفاءة أفراد الاستجابة', noteEn: 'Held by the responders the unit deploys, and evidenced on request.', noteAr: 'يحملها المستجيبون الذين تنشرهم الوحدة، وتُثبَت عند الطلب.' },
  { key: 'operational', en: 'Operational readiness', ar: 'الجاهزية التشغيلية', noteEn: 'Ongoing, not a one-time check.', noteAr: 'مستمرة لا فحصاً لمرة واحدة.' },
] as const;

export function ReadinessChecklist({
  initial,
  signedAt,
}: {
  initial: Partial<Record<string, boolean[]>>;
  signedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const content = ROLES_CONTENT.firstResponse;
  const [state, setState] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(
      GROUPS.map((g) => {
        const defs = content[g.key];
        return [g.key, defs.map((_, i) => initial[g.key]?.[i] ?? false)];
      }),
    ),
  );
  const outstanding = useMemo(
    () => GROUPS.reduce((sum, g) => sum + (state[g.key] ?? []).filter((v) => !v).length, 0),
    [state],
  );

  const save = (sign: boolean) => {
    startTransition(async () => {
      await saveFrReadinessAction({ confirmations: state, sign });
      router.refresh();
    });
  };

  return (
    <div>
      {GROUPS.map((g) => {
        const defs = content[g.key];
        return (
          <div key={g.key} data-region={`bls-${g.key}`}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en={g.en} ar={g.ar} />
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '74ch' }}>
              <L en={g.noteEn} ar={g.noteAr} />
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 40 }}>
              {defs.map((item, i) => {
                const on = Boolean(state[g.key]?.[i]);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        [g.key]: (prev[g.key] ?? []).map((v, j) => (j === i ? !v : v)),
                      }))
                    }
                    style={{ textAlign: 'start', paddingBlock: '17px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px solid ${on ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', gap: 14, alignItems: 'baseline', flex: 1, minWidth: 240 }}>
                      <span style={{ flex: 'none', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 15, lineHeight: 1.55 }}>
                        <L en={item.en} ar={item.ar} />
                      </span>
                    </span>
                    <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: on ? 'var(--brand-soft)' : 'var(--surface2)', color: on ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px' }}>
                      {on ? <L en="Confirmed" ar="مؤكَّد" /> : <L en="Not confirmed" ar="غير مؤكَّد" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={outstanding > 0 || pending}
          style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: outstanding > 0 ? 'var(--surface2)' : 'var(--brand)', color: outstanding > 0 ? 'var(--muted)' : 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: outstanding > 0 ? 'not-allowed' : 'pointer' }}
        >
          <L en="Sign the first-response readiness declaration" ar="توقيع إقرار جاهزية الاستجابة الأولية" />
        </button>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          {signedAt ? (
            <L en={`Signed ${signedAt.slice(0, 10)}`} ar={`وُقّع في ⁦${signedAt.slice(0, 10)}⁩`} />
          ) : outstanding > 0 ? (
            <L en={`${outstanding} items still to confirm`} ar={`بقي تأكيد ${outstanding} بنداً`} />
          ) : (
            <L en="Every item confirmed" ar="تم تأكيد كل البنود" />
          )}
        </span>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={pending}
          style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
        >
          <L en="Save without signing" ar="الحفظ دون توقيع" />
        </button>
      </div>
    </div>
  );
}
