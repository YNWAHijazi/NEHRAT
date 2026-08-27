import { L } from '../../../../components/L';
import { MinistryFooter, MinistryShell } from '../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../lib/ministry-auth';
import { ministryConfig } from '../../../../lib/queries';
import { FACILITY_CONTENT, MINISTRY_CONTENT } from '../../../../lib/rules';
import { publishConfigAction } from '../../../ministry-actions';

/**
 * Cardiac-arrest configuration: the ten Ministry powers from the source, each
 * carrying the values operators are told they are waiting for. A value's unset
 * state is a first-class answer; set-and-publish records it with an effective
 * date and notifies the operators it reaches.
 *
 * ELEVEN ROWS, TEN POWERS. PAD 11.3 is one power with two limbs -- remote or
 * difficult-access facilities, and other individual facilities -- exercised
 * separately, so it renders as two rows carrying the same number 3.
 *
 * The Slice 4 provisional cycles sat under power ten, which was wrong: PAD 11
 * does not name a device-check cadence, and the policy states no cycle or lapse
 * window anywhere. They now sit under power 5 and are LABELLED as not one of
 * the ten, from the data -- never from a number in this file.
 */
export default async function CardiacConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('configureCardiac');
  const { notice, error } = await searchParams;
  const config = ministryConfig();
  const powers = MINISTRY_CONTENT.cardiacPowers;
  const pub = MINISTRY_CONTENT.publicationStates;

  const valueKeysOf = (p: (typeof powers)[number]): string[] =>
    ('valueKeys' in p && Array.isArray(p.valueKeys) ? (p.valueKeys as string[]) : [p.key]);
  /** The keys this power carries that are NOT among the source's ten. From the data. */
  const outsideOf = (p: (typeof powers)[number]): string[] =>
    'outsideTheTen' in p && Array.isArray(p.outsideTheTen) ? (p.outsideTheTen as string[]) : [];
  /** A key running on a provisional figure until the Ministry publishes one. */
  const isProvisional = (key: string): boolean =>
    key === 'checkCycleDays' || key === 'lapseWindowDays';
  const labelFor = (p: (typeof powers)[number], key: string): { en: string; ar: string } => {
    const labels = ('valueLabels' in p ? p.valueLabels : undefined) as
      | Record<string, { en: string; ar: string }>
      | undefined;
    if (labels?.[key]) return labels[key];
    return {
      en: ('valueLabelEn' in p ? p.valueLabelEn : '') as string,
      ar: ('valueLabelAr' in p ? p.valueLabelAr : '') as string,
    };
  };
  const stateOf = (p: (typeof powers)[number]) => {
    if (p.kind === 'act') return { ...pub.caseByCase, bg: 'var(--surface2)', color: 'var(--muted)' };
    const keys = valueKeysOf(p);
    const set = keys.filter((k) => config.has(k)).length;
    if (set === keys.length) return { ...pub.published, bg: 'var(--brand-soft)', color: 'var(--brand)' };
    if (set > 0) return { ...pub.part, bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
    // Provisional, not merely unset: a figure IS in use until the Ministry publishes one.
    if (keys.some(isProvisional)) return { ...pub.provisional, bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
    return { ...pub.unset, bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
  };
  const values = powers.filter((p) => p.kind === 'value');
  const publishedCount = values.filter((p) => valueKeysOf(p).every((k) => config.has(k))).length;
  const partCount = values.filter((p) => {
    const keys = valueKeysOf(p);
    const set = keys.filter((k) => config.has(k)).length;
    return set > 0 && set < keys.length;
  }).length;
  const unsetCount = values.length - publishedCount - partCount;
  const provisionalCycles = FACILITY_CONTENT.ledger.cycles;

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }} consoleEn="Administration" consoleAr="الإدارة">
      {notice === 'published' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="Set and published. The operators the value reaches have been notified, effective on the date named." ar="حُدِّدت ونُشرت. وأُبلغ المشغّلون الذين تصلهم القيمة، وتسري بالتاريخ المسمّى." />
        </div>
      ) : null}
      {error === 'incomplete' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="A value and an effective date are both required to publish." ar="القيمة وتاريخ السريان مطلوبان معاً للنشر." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Cardiac-arrest configuration" ar="إعدادات الجاهزية لتوقف القلب" />
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)', maxWidth: '84ch', lineHeight: 1.6 }}>
        <L
          en="The ten Ministry powers, per the source. The counters below describe publication, not force: a value is published or it is not, and nothing regulatory is hard-coded behind it."
          ar="صلاحيات الوزارة العشر، وفق المصدر. والعدّادات أدناه تصف النشر لا السريان: فالقيمة إما منشورة أو لا، ولا شيء تنظيمي مثبَّت خلفها."
        />
      </p>

      <div data-region="pub-counters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockEnd: 16 }}>
        {[
          { n: publishedCount, en: pub.published.en, ar: pub.published.ar, color: 'var(--brand)' },
          { n: partCount, en: pub.part.en, ar: pub.part.ar, color: 'var(--accent-ink)' },
          { n: unsetCount, en: pub.unset.en, ar: pub.unset.ar, color: 'var(--accent-ink)' },
          { n: powers.length - values.length, en: pub.caseByCase.en, ar: pub.caseByCase.ar, color: 'var(--muted)' },
        ].map((c) => (
          <div key={c.en} style={{ background: 'var(--bg)', padding: '16px 18px' }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: c.color }}>{c.n}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
              <L en={c.en} ar={c.ar} />
            </div>
          </div>
        ))}
      </div>

      <div data-region="in-force-note" style={{ padding: '14px 18px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 24, fontSize: '13px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '86ch' }}>
        <L en={MINISTRY_CONTENT.inForceWithoutValue.en} ar={MINISTRY_CONTENT.inForceWithoutValue.ar} />
      </div>

      <div data-region="powers" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {powers.map((p) => {
          const s = stateOf(p);
          const keys = valueKeysOf(p);
          return (
            <div key={p.key} style={{ padding: '20px 24px', background: 'var(--surface2)', borderInlineStart: `3px solid ${s.color}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 10 }}>
                <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 280 }}>
                  <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{p.n}</span>
                  <span style={{ fontSize: '15.5px', fontWeight: 500, lineHeight: 1.45 }}>
                    <L en={p.en} ar={p.ar} />
                  </span>
                </span>
                <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, fontSize: '12.5px' }}>
                  <L en={s.en} ar={s.ar} />
                </span>
              </div>

              {/* Why this row repeats a number: one power, two limbs (PAD 11.3). */}
              {'limbEn' in p ? (
                <div style={{ marginInlineStart: 30, marginBlockEnd: 10, fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '80ch', paddingInlineStart: 12, borderInlineStart: '2px solid var(--line)' }}>
                  <L en={(p.limbEn ?? '') as string} ar={(('limbAr' in p ? p.limbAr : '') ?? '') as string} />
                </div>
              ) : null}

              {p.kind === 'act' ? (
                <div style={{ marginInlineStart: 30, fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
                  <L en={('actNoteEn' in p ? p.actNoteEn : '') as string} ar={('actNoteAr' in p ? p.actNoteAr : '') as string} />
                </div>
              ) : (
                <div style={{ marginInlineStart: 30 }}>
                  <div style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch', marginBlockEnd: 12 }}>
                    <L en={('unsetNoteEn' in p ? p.unsetNoteEn : '') as string} ar={('unsetNoteAr' in p ? p.unsetNoteAr : '') as string} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {keys.map((key) => {
                      const row = config.get(key);
                      return (
                        <div key={key} style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: row ? 0 : 10 }}>
                            <span style={{ fontSize: '13.5px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <L en={labelFor(p, key).en} ar={labelFor(p, key).ar} />
                              {outsideOf(p).includes(key) ? (
                                <span style={{ flex: 'none', padding: '2px 8px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                                  <L en="Not one of the ten" ar="ليست من العشر" />
                                </span>
                              ) : null}
                            </span>
                            {row ? (
                              <span style={{ fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                                <L en={`${row.value} · effective ${row.effective ?? ''} · published ${row.publishedAt} by ${row.publishedBy}`} ar={`${row.value} · يسري من ⁦${row.effective ?? ''}⁩ · نُشر في ⁦${row.publishedAt}⁩ بواسطة ${row.publishedBy}`} />
                              </span>
                            ) : (
                              <span style={{ fontSize: '12.5px', color: 'var(--accent-ink)' }}>
                                {isProvisional(key) ? (
                                  <L
                                    en={`Not set — the provisional figure ${key === 'checkCycleDays' ? provisionalCycles.checkCycleDays : provisionalCycles.lapseWindowDays} days is in use`}
                                    ar={`غير محددة — الرقم المؤقت ${key === 'checkCycleDays' ? provisionalCycles.checkCycleDays : provisionalCycles.lapseWindowDays} يوماً مستخدم`}
                                  />
                                ) : (
                                  <L en="Not set — nothing is in force under this value" ar="غير محددة — لا يسري شيء بموجب هذه القيمة" />
                                )}
                              </span>
                            )}
                          </div>
                          {!row ? (
                            <form action={publishConfigAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
                              <input type="hidden" name="key" value={key} />
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
                                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                  <L en="Value" ar="القيمة" />
                                </span>
                                <input name="value" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }} />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                  <L en={MINISTRY_CONTENT.setAndPublish.effectiveEn} ar={MINISTRY_CONTENT.setAndPublish.effectiveAr} />
                                </span>
                                <input name="effective" type="date" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
                              </label>
                              <button type="submit" style={{ height: 34, paddingInline: 14, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                                <L en={MINISTRY_CONTENT.setAndPublish.en} ar={MINISTRY_CONTENT.setAndPublish.ar} />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {/* Values grouped here that the source does not name as a power. */}
                  {outsideOf(p).length > 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBlockStart: 10, lineHeight: 1.65, maxWidth: '80ch', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
                      <L en={(('outsideTheTenEn' in p ? p.outsideTheTenEn : '') ?? '') as string} ar={(('outsideTheTenAr' in p ? p.outsideTheTenAr : '') ?? '') as string} />
                    </div>
                  ) : null}
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBlockStart: 8, lineHeight: 1.6 }}>
                    <L en={MINISTRY_CONTENT.setAndPublish.notifyEn} ar={MINISTRY_CONTENT.setAndPublish.notifyAr} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <MinistryFooter steps={[
        { href: '/ministry/admin/configuration', en: 'Configuration and versioning', ar: 'الإعدادات والإصدارات', descEn: 'The mass-gathering instrument and its versions.', descAr: 'إطار الفعاليات الجماهيرية وإصداراته.' },
        { href: '/ministry/facilities', en: 'Facility oversight', ar: 'الرقابة على المرافق', descEn: 'Where the published timelines take effect.', descAr: 'حيث تسري المهل المنشورة.' },
      ]} />
    </MinistryShell>
  );
}
