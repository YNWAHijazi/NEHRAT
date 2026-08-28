import Link from 'next/link';
import { AdminTabs } from '../../../../components/AdminTabs';
import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { adminRecords } from '../../../../lib/queries';
import { MINISTRY_CONTENT, bilingualMap } from '../../../../lib/rules';

/**
 * RECORDS — every submission on the platform, not the reviewer's working queue.
 *
 * The two are different questions. The queue asks what is waiting for me; this asks
 * what exists, which is the question an overseeing profile has and which nothing on
 * the platform could answer. Filed and unfiled alike: a record that never filed is a
 * fact about the platform too, and it is invisible in every reviewer-side surface.
 *
 * The filters are a GET form, so a filtered view has a URL — an administrator can
 * send somebody "every Level 3 filed with no determination" rather than describing it.
 */
export default async function AdminRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; status?: string; q?: string }>;
}) {
  const account = await requireMinistryPage('viewRegistry');
  const { level, status, q } = await searchParams;
  const A = MINISTRY_CONTENT.adminConsole;

  const records = adminRecords(account.isDemo, {
    level: level && level !== '' ? Number(level) : undefined,
    status: status && status !== '' ? status : undefined,
    search: q,
  });

  const outcomes = MINISTRY_CONTENT.outcomes;
  const field: React.CSSProperties = {
    height: 36,
    paddingInline: 10,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
  };

  return (
    <MinistryShell
      account={account}
      back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}
      consoleEn="Master administration"
      consoleAr="الإدارة العامة"
    >
      <h1 data-sec-h1="" style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={A.titleEn} ar={A.titleAr} />
      </h1>
      <AdminTabs current="/ministry/admin/records" />

      <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.65, maxWidth: '84ch' }}>
        <L en={A.recordsIntroEn} ar={A.recordsIntroAr} />
      </p>

      <form
        method="get"
        data-region="record-filters"
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', padding: '14px 18px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 18 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <L en={A.filterLevelEn} ar={A.filterLevelAr} />
          </span>
          <select name="level" defaultValue={level ?? ''} style={field}>
            <option value="">{A.anyEn}</option>
            {[1, 2, 3].map((l) => (
              <option key={l} value={l}>{`Level ${l}`}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <L en={A.filterStatusEn} ar={A.filterStatusAr} />
          </span>
          <select name="status" defaultValue={status ?? ''} style={field}>
            <option value="">{A.anyEn}</option>
            <option value="filed">{A.statusFiledEn}</option>
            <option value="unfiled">{A.statusUnfiledEn}</option>
            <option value="undetermined">{A.statusUndeterminedEn}</option>
            {outcomes.map((o) => (
              <option key={o.key} value={o.key}>{o.en}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            <L en={A.filterSearchEn} ar={A.filterSearchAr} />
          </span>
          <input name="q" defaultValue={q ?? ''} style={field} />
        </label>
        <button type="submit" style={{ height: 36, paddingInline: 16, border: 0, borderRadius: 18, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
          <L en={A.filterApplyEn} ar={A.filterApplyAr} />
        </button>
        <Link href="/ministry/admin/records" style={{ height: 36, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 18, fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
          <L en={A.filterClearEn} ar={A.filterClearAr} />
        </Link>
      </form>

      <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockEnd: 10 }}>
        <L
          en={A.countEn.replace('{n}', String(records.length))}
          ar={A.countAr.replace('{n}', String(records.length))}
        />
      </div>

      <div data-region="records" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.length === 0 ? (
          <div style={{ padding: '18px 22px', border: '1px dashed var(--line)', borderRadius: 12, fontSize: 14, color: 'var(--muted)' }}>
            <L en={A.noneEn} ar={A.noneAr} />
          </div>
        ) : null}
        {records.map((r) => {
          const def = outcomes.find((o) => o.key === r.outcome);
          return (
            <Link
              key={r.id}
              href={`/ministry/admin/records/${r.id}`}
              data-stack=""
              style={{ paddingBlock: '17px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px solid ${r.filed ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 12, display: 'grid', gridTemplateColumns: 'minmax(200px,1.5fr) 1fr 1.2fr auto', gap: 18, alignItems: 'center', color: 'var(--ink)' }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
                  <L en={r.nameEn} ar={r.nameAr} />
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                  <L en={r.organizationEn} ar={r.organizationAr} />
                  {r.municipalities !== '—' ? <span> · {r.municipalities}</span> : null}
                </div>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <div>{r.mophReference ?? r.id}</div>
                <div>{r.startDate ?? '—'}</div>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                {def ? (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: r.outcome === 'satisfied' ? 'var(--brand-soft)' : 'var(--accent-soft)', color: r.outcome === 'satisfied' ? 'var(--brand)' : 'var(--accent-ink)' }}>
                    <L en={def.en} ar={def.ar} />
                  </span>
                ) : (
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)' }}>
                    {r.filed ? (
                      <L en={A.statusUndeterminedEn} ar={A.statusUndeterminedAr} />
                    ) : (
                      <L en={A.statusUnfiledEn} ar={A.statusUnfiledAr} />
                    )}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: r.level ? `var(--l${r.level})` : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {r.level ?? '—'}
              </div>
            </Link>
          );
        })}
      </div>

      <MinistryFooter
        steps={[
          { href: '/ministry/queue', en: 'Review queue', ar: 'قائمة المراجعة', descEn: 'What is waiting for a reviewer.', descAr: 'ما ينتظر مراجعاً.' },
        ]}
      />
    </MinistryShell>
  );
}
