import { notFound } from 'next/navigation';
import Link from 'next/link';
import { L } from '../../../../../components/L';
import { MinistryShell } from '../../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../../lib/ministry-auth';
import { capabilityActs, capabilityChecks, capabilityConfigFor, ministryConfig } from '../../../../../lib/queries';
import { ALL_FLAGS, effectiveFlag, flagDetail, flagGroup, groupTitle, missingForEnable, type FeatureFlag } from '../../../../../lib/rules/flags';
import { saveCapabilityConfigAction, setFeatureFlagAction } from '../../../../ministry-actions';

/**
 * One capability, one page: what it is and what turning it on changes, the
 * toggle, and the configuration beneath (partner ruling, 2026-09-02). The
 * toggle asks one rule -- a capability with no configuration cannot be enabled
 * -- and while it is disabled it names every missing item: a dependency, a
 * field, a readiness check, or an unmade decision. Turning off is always
 * allowed. Either act is recorded with who, when, and the configuration at
 * that moment, and the record renders at the foot of this page.
 *
 * Platform-owner surface: manageFlags is held by no Ministry role, so the
 * Ministry administrator's request 404s here like any route above a role's
 * permission.
 */
export default async function CapabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ flag: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const account = await requireMinistryPage('manageFlags');
  const { flag: rawFlag } = await params;
  const { notice, error } = await searchParams;
  if (!ALL_FLAGS.includes(rawFlag as FeatureFlag)) notFound();
  const flag = rawFlag as FeatureFlag;

  const config = new Map([...ministryConfig()].map(([k, v]) => [k, v.value]));
  const stored = capabilityConfigFor(flag);
  const checks = capabilityChecks();
  const detail = flagDetail(flag);
  const group = groupTitle(flagGroup(flag));
  const on = effectiveFlag(flag, config);
  const missing = missingForEnable(flag, stored, { flagOn: (dep) => effectiveFlag(dep, config), checks });
  const acts = capabilityActs(flag);

  return (
    <MinistryShell account={account} back={{ href: '/platform/admin', en: 'Master admin', ar: 'الإدارة العليا' }} consoleEn="Platform owner" consoleAr="مالك المنصة">
      {notice === 'on' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The capability is on. The act is recorded below — who, when, and the configuration at that moment." ar="القدرة مشغّلة. والإجراء مسجَّل أدناه — مَن ومتى وما كان الإعداد في تلك اللحظة." />
        </div>
      ) : null}
      {notice === 'off' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The capability is off. The act is recorded below." ar="القدرة مطفأة. والإجراء مسجَّل أدناه." />
        </div>
      ) : null}
      {notice === 'config' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The configuration has been stored." ar="حُفظ الإعداد." />
        </div>
      ) : null}
      {error === 'missing' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="It cannot be enabled yet. What is missing is named beside the toggle." ar="لا يمكن تشغيلها بعد. وما ينقصها مسمّى بجانب المفتاح." />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 8 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBlockEnd: 6 }}>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--surface2)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: '11.5px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              <L en={group.en} ar={group.ar} />
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: on ? 'var(--brand-soft)' : 'var(--surface2)', border: on ? 0 : '1px solid var(--line)', color: on ? 'var(--brand)' : 'var(--muted)', fontSize: '12.5px', letterSpacing: '.04em' }}>
              {on ? <L en="ON" ar="مشغّلة" /> : <L en="OFF" ar="مطفأة" />}
            </span>
          </div>
          <h1 data-sec-h1="" style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
            <L en={detail.titleEn} ar={detail.titleAr} />
          </h1>
        </div>

        {/* The toggle, top right. Disabled-with-the-reasons while anything is
            missing (gating behaviour one: it will become available); off is
            always available. */}
        <div data-region="capability-toggle" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', maxWidth: 380 }}>
          {on ? (
            <form action={setFeatureFlagAction}>
              <input type="hidden" name="flag" value={flag} />
              <input type="hidden" name="state" value="off" />
              <button type="submit" style={{ height: 36, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Turn off" ar="إطفاء" />
              </button>
            </form>
          ) : missing.length === 0 ? (
            <form action={setFeatureFlagAction}>
              <input type="hidden" name="flag" value={flag} />
              <input type="hidden" name="state" value="on" />
              <button type="submit" style={{ height: 36, paddingInline: 16, border: 0, borderRadius: 18, background: 'var(--brand)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <L en="Turn on" ar="تشغيل" />
              </button>
            </form>
          ) : (
            <button type="button" disabled style={{ height: 36, paddingInline: 16, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>
              <L en="Turn on" ar="تشغيل" />
            </button>
          )}
          {!on && missing.length > 0 ? (
            <div data-region="enable-blockers" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {missing.map((m) => (
                <span key={m.en} style={{ fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.55, textAlign: 'end' }}>
                  <L en={m.en} ar={m.ar} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.65, maxWidth: '84ch' }}>
        <L en={detail.whatEn} ar={detail.whatAr} />
      </p>
      <p style={{ margin: '0 0 24px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '84ch' }}>
        <L
          en="Turning this on or off is recorded: who, when, and the configuration at that moment."
          ar="يُسجَّل تشغيلها أو إطفاؤها: مَن ومتى وما كان الإعداد في تلك اللحظة."
        />
      </p>

      {/* An unmade decision, surfaced, not resolved. */}
      {detail.blocked ? (
        <div data-region="open-decision" style={{ padding: '16px 20px', background: 'var(--accent-soft)', borderInlineStart: '3px solid var(--accent-ink)', borderRadius: 10, marginBlockEnd: 24, maxWidth: 860 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 4 }}>
            <L en="Open decision" ar="قرار مفتوح" />
          </div>
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.7, maxWidth: '80ch' }}>
            <L en={detail.blocked.reasonEn} ar={detail.blocked.reasonAr} />
          </p>
        </div>
      ) : null}

      {detail.dependsOn ? (
        <div data-region="dependency" style={{ padding: '13px 18px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 24, maxWidth: 860, fontSize: '13.5px', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            <L
              en={`Depends on ${flagDetail(detail.dependsOn).titleEn}.`}
              ar={`تعتمد على ${flagDetail(detail.dependsOn).titleAr}.`}
            />
          </span>
          <Link href={`/platform/admin/capabilities/${detail.dependsOn}`} style={{ color: 'var(--ink)', fontSize: '12.5px', border: '1px solid var(--line)', borderRadius: 15, height: 30, paddingInline: 12, display: 'inline-flex', alignItems: 'center' }}>
            <L en="Open it" ar="فتحها" />
          </Link>
        </div>
      ) : null}

      {detail.requiredConfig.length > 0 ? (
        <div data-region="capability-config" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, maxWidth: 860, marginBlockEnd: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Configuration" ar="الإعداد" />
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
            <L en="Every field is required before the capability can be enabled. Clearing a field returns it to unset." ar="كل حقل مطلوب قبل تشغيل القدرة. ومسح الحقل يعيده إلى غير محدد." />
          </p>
          <form action={saveCapabilityConfigAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="hidden" name="flag" value={flag} />
            {detail.requiredConfig.map((field) => {
              const value = stored.get(field.key) ?? '';
              return (
                <label key={field.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13.5px', flex: 1, minWidth: 220 }}>
                    <L en={field.labelEn} ar={field.labelAr} />
                  </span>
                  {field.kind === 'select' ? (
                    <select name={field.key} defaultValue={value} style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, minWidth: 180 }}>
                      <option value=""></option>
                      {(field.options ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      defaultValue={value}
                      type={field.kind === 'number' ? 'number' : 'text'}
                      step={field.kind === 'number' ? 'any' : undefined}
                      style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, minWidth: 180, fontVariantNumeric: 'tabular-nums' }}
                    />
                  )}
                </label>
              );
            })}
            <div>
              <button type="submit" style={{ height: 34, paddingInline: 16, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en="Store the configuration" ar="حفظ الإعداد" />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {(detail.requiredChecks ?? []).length > 0 ? (
        <div data-region="capability-checks" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, maxWidth: 860, marginBlockEnd: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="What it needs before it can be enabled" ar="ما تحتاجه قبل التشغيل" />
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockStart: 10 }}>
            {(detail.requiredChecks ?? []).map((check) => {
              const met = checks[check.key] === true;
              return (
                <div key={check.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px' }}>
                  <L en={check.labelEn} ar={check.labelAr} />
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: met ? 'var(--brand-soft)' : 'var(--accent-soft)', color: met ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12.5px' }}>
                    {met ? <L en="Met" ar="مستوفى" /> : <L en="Not yet met" ar="غير مستوفى بعد" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div data-region="capability-acts" style={{ maxWidth: 860 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
          <L en="Acts on this capability" ar="الإجراءات على هذه القدرة" />
        </h2>
        {acts.length === 0 ? (
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
            <L en="None recorded. This capability has never been turned on." ar="لا شيء مسجَّل. لم تُشغَّل هذه القدرة قط." />
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', marginBlockStart: 10 }}>
            {acts.map((act, i) => (
              <div key={`${act.at}-${i}`} style={{ background: 'var(--bg)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
                <span style={{ flex: '0 0 132px', fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{act.at}</span>
                <span style={{ flex: '0 0 90px', fontSize: '13px' }}>
                  {act.state === 'on' ? <L en="Turned on" ar="شُغِّلت" /> : <L en="Turned off" ar="أُطفئت" />}
                </span>
                <span style={{ flex: 1, minWidth: 200, fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                  {Object.entries(act.config).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                </span>
                <span style={{ flex: '0 0 auto', fontSize: '12.5px', color: 'var(--muted)' }}>{act.actor}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MinistryShell>
  );
}
