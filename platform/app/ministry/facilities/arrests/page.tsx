import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { arrestLocations } from '../../../../lib/queries';
import { can } from '../../../../lib/rules';
import { designateCoveredAction } from '../../../ministry-actions';

/**
 * Reported arrest locations: facility incident reports and first-response
 * dataset reports grouped by place and category, so a pattern is visible that
 * no single report shows. This is the mechanism by which a place with a
 * confirmed arrest becomes a covered facility (power eight) -- the designation
 * is recorded here, by a reviewer.
 */
export default async function ArrestLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await requireMinistryPage('viewFacilityLane');
  const { notice } = await searchParams;
  const groups = arrestLocations(account.isDemo);
  const mayDesignate = can(account.role, 'designateCovered');
  const total = groups.reduce((s, g) => s + g.count, 0);
  const byCategory = new Map<string, number>();
  for (const g of groups) byCategory.set(g.category || '—', (byCategory.get(g.category || '—') ?? 0) + g.count);

  return (
    <MinistryShell account={account} back={{ href: '/ministry/facilities', en: 'Facility oversight', ar: 'الرقابة على المرافق' }}>
      {notice === 'designated' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="Designated as covered. Its obligations run from the designation date, and its operator has been notified where a record exists." ar="حُدِّد كمشمول. وتسري موجباته من تاريخ التحديد، وأُبلغ مشغّله حيث يوجد سجل." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Reported arrest locations" ar="مواقع حوادث توقف القلب المبلَّغة" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', maxWidth: '82ch', lineHeight: 1.6 }}>
        <L
          en="Incidents grouped by place and category — the pattern no single report shows. No patient appears here; the reports carry none."
          ar="الحوادث مجمَّعة بحسب المكان والفئة — النمط الذي لا يُظهره تقرير واحد. ولا يظهر هنا أي مريض؛ فالتقارير لا تحمل أياً."
        />
      </p>

      <div data-split="" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
        <div data-region="groups" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => (
            <div key={g.placeEn} style={{ padding: '16px 20px', background: 'var(--surface2)', borderInlineStart: `3px solid ${g.count >= 3 ? 'var(--bad)' : g.count === 2 ? 'var(--accent-ink)' : 'var(--muted)'}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>
                    <L en={g.placeEn} ar={g.placeAr} />
                  </span>
                  <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>
                    {g.category || '—'}{g.municipality ? ` · ${g.municipality}` : ''} · {g.firstMonth === g.lastMonth ? g.firstMonth : `${g.firstMonth} — ${g.lastMonth}`}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
                  <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: g.count >= 3 ? 'var(--bad)' : g.count === 2 ? 'var(--accent-ink)' : 'var(--muted)' }}>{g.count}</span>
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: g.designated ? 'var(--brand-soft)' : 'var(--surface2)', color: g.designated ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px' }}>
                    {g.designated ? <L en="Already a covered facility" ar="مرفق مشمول أصلاً" /> : <L en="Not currently covered" ar="غير مشمول حالياً" />}
                  </span>
                  {mayDesignate && !g.designated ? (
                    <form action={designateCoveredAction}>
                      <input type="hidden" name="nameEn" value={g.placeEn} />
                      <input type="hidden" name="nameAr" value={g.placeAr} />
                      <input type="hidden" name="category" value={g.category} />
                      <input type="hidden" name="municipality" value={g.municipality} />
                      <input type="hidden" name="facilityId" value={g.facilityId ?? ''} />
                      <button type="submit" style={{ height: 32, paddingInline: 13, border: 0, borderRadius: 16, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                        <L en="Designate as covered" ar="تحديده كمشمول" />
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
          {groups.length === 0 ? (
            <div style={{ padding: '16px 20px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
              <L en="No arrest locations reported." ar="لا مواقع حوادث مبلَّغة." />
            </div>
          ) : null}
        </div>
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="By category" ar="بحسب الفئة" />
          </h2>
          <div data-region="by-category" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {[...byCategory.entries()].map(([cat, n]) => (
              <div key={cat} style={{ background: 'var(--bg)', padding: '13px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 14 }}>
                <span>{cat}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                  {n}{total > 0 ? ` · ${Math.round((n / total) * 100)}%` : ''}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginBlockStart: 16, padding: '14px 18px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, fontSize: '13px', lineHeight: 1.65, color: 'var(--accent-ink)' }}>
            <L
              en="Designating a place here is how a facility with a confirmed arrest becomes covered. Its readiness obligations run from the designation date."
              ar="تحديد مكان هنا هو الطريقة التي يصبح بها مرفق ذو توقف قلب مؤكَّد مشمولاً. وتسري موجبات جاهزيته من تاريخ التحديد."
            />
          </div>
        </div>
      </div>
      <MinistryFooter steps={[
        { href: '/ministry/facilities', en: 'Facility oversight', ar: 'الرقابة على المرافق', descEn: 'The lane the designation lands in.', descAr: 'المسار الذي يقع فيه التحديد.' },
        { href: '/ministry/determinations', en: 'Determinations and designations', ar: 'البت والتحديد', descEn: 'The register of designations made here.', descAr: 'سجل التحديدات المتخذة هنا.' },
      ]} />
    </MinistryShell>
  );
}
