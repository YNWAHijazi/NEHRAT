import { notFound } from 'next/navigation';
import Link from 'next/link';
import { L } from '../../../../../components/L';
import { MinistryShell } from '../../../../../components/MinistryShell';
import { requireMinistryPage } from '../../../../../lib/ministry-auth';
import { advertsAll, capabilityActs, capabilityChecks, capabilityConfigFor, listedVendors, ministryConfig, sponsorshipsAll, vendorsAll } from '../../../../../lib/queries';
import { ALL_FLAGS, adPlacements, assistiveNotBuilt, effectiveFlag, flagDetail, flagGroup, groupTitle, missingForEnable, vendorCategories, vendorDisclaimer, type FeatureFlag } from '../../../../../lib/rules/flags';
import { addAdvertAction, addSponsorshipAction, addVendorAction, endAdvertAction, endSponsorshipAction, saveCapabilityConfigAction, setFeatureFlagAction, setVendorListedAction } from '../../../../ministry-actions';

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
      {notice === 'vendor-added' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The vendor is listed." ar="أُدرج المزوّد." />
        </div>
      ) : null}
      {notice === 'vendor-updated' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The listing state has been recorded." ar="سُجّلت حالة الإدراج." />
        </div>
      ) : null}
      {notice === 'sponsorship-added' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The sponsorship is booked." ar="حُجزت الرعاية." />
        </div>
      ) : null}
      {notice === 'sponsorship-ended' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The period closes at the end of today." ar="تُغلق الفترة بنهاية اليوم." />
        </div>
      ) : null}
      {notice === 'advert-added' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The advert is booked." ar="حُجز الإعلان." />
        </div>
      ) : null}
      {notice === 'advert-ended' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The period closes at the end of today." ar="تُغلق الفترة بنهاية اليوم." />
        </div>
      ) : null}
      {error === 'advert' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="A placement from the list, an image, a link, its wording, a period, and a price with its currency are all required." ar="موضع من القائمة وصورة ورابط ونصه وفترة وسعر مع عملته، كلها مطلوبة." />
        </div>
      ) : null}
      {error === 'sponsorship' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="A listed vendor, a period with the first date not after the last, and a price with its currency are all required." ar="مزوّد مُدرج، وفترة لا يسبق آخرها أولها، وسعر مع عملته، كلها مطلوبة." />
        </div>
      ) : null}
      {error === 'vendor' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="Both names and a category from the list are required." ar="الاسمان معاً وفئة من القائمة مطلوبة." />
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

      {/* THE ASSISTANT IS DELIBERATELY NOT BUILT (non-negotiable 14): this
          governance precedes its existence, and the page says so rather than
          letting the toggle imply an assistant that is not there. */}
      {flagGroup(flag) === 'assistive' ? (
        <div data-region="not-built" style={{ padding: '16px 20px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--muted)', borderRadius: 10, marginBlockEnd: 24, maxWidth: 860 }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, maxWidth: '84ch' }}>
            <L en={assistiveNotBuilt().en} ar={assistiveNotBuilt().ar} />
          </p>
        </div>
      ) : null}

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

      {/* THE DIRECTORY'S CONTENT is its configuration: vendors, added here and
          never self-registered. Managing the list works while the capability is
          off -- the readiness check wants a listed vendor before it can turn on
          -- and nothing here is public until it is on. */}
      {flag === 'vendorDirectory' ? (
        <div data-region="vendor-manager" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, maxWidth: 860, marginBlockEnd: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Vendors" ar="المزوّدون" />
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
            <L
              en={`Added by the administrator, never self-registered. Delisting keeps the row. Every public listing states: ${vendorDisclaimer().en}`}
              ar={`يضيفهم المسؤول ولا يسجّلون أنفسهم. والشطب يُبقي الصف. وتذكر كل قائمة عامة: ${vendorDisclaimer().ar}`}
            />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 18 }}>
            {vendorsAll().length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                <L en="No vendor is listed yet." ar="لا مزوّد مُدرجاً بعد." />
              </p>
            ) : null}
            {vendorsAll().map((v) => {
              const cat = vendorCategories().find((c) => c.key === v.category);
              return (
                <div key={v.id} style={{ padding: '13px 17px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      <L en={v.nameEn} ar={v.nameAr} />
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                      <L en={cat?.en ?? v.category} ar={cat?.ar ?? v.category} />
                      {v.area ? <span> · {v.area}</span> : null}
                      {v.contact ? <span> · {v.contact}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: v.listed ? 'var(--brand-soft)' : 'var(--surface2)', border: v.listed ? 0 : '1px solid var(--line)', color: v.listed ? 'var(--brand)' : 'var(--muted)', fontSize: '12px' }}>
                      {v.listed ? <L en="Listed" ar="مُدرج" /> : <L en="Delisted" ar="مشطوب" />}
                    </span>
                    <form action={setVendorListedAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="listed" value={v.listed ? 'no' : 'yes'} />
                      <button type="submit" style={{ height: 30, paddingInline: 12, border: '1px solid var(--line)', borderRadius: 15, background: 'var(--bg)', color: 'var(--ink)', fontSize: '12px', cursor: 'pointer' }}>
                        {v.listed ? <L en="Delist" ar="شطب" /> : <L en="Relist" ar="إعادة إدراج" />}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
          <form action={addVendorAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              {[
                ['nameEn', 'Name (English)', 'الاسم (بالإنكليزية)'],
                ['nameAr', 'Name (Arabic)', 'الاسم (بالعربية)'],
                ['contact', 'Contact', 'جهة الاتصال'],
                ['area', 'Area served', 'المنطقة المخدومة'],
              ].map(([name, en, ar]) => (
                <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    <L en={en!} ar={ar!} />
                  </span>
                  <input name={name} style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }} />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <L en="Category" ar="الفئة" />
                </span>
                <select name="category" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }}>
                  <option value=""></option>
                  {vendorCategories().map((c) => (
                    <option key={c.key} value={c.key}>{c.en}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <button type="submit" style={{ height: 34, paddingInline: 16, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en="Add the vendor" ar="إضافة المزوّد" />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* SPONSORSHIPS are this capability's content: one listed vendor, one
          period. Booked here while off -- the readiness check wants one in
          period before the toggle is live -- and labelled wherever it renders. */}
      {flag === 'sponsoredListings' ? (
        <div data-region="sponsorship-manager" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, maxWidth: 860, marginBlockEnd: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Sponsorships" ar="الرعايات" />
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
            <L
              en="A sponsored vendor holds the top of its category for the period, labelled as sponsored wherever it appears — always. Ending one closes the period; the row stays."
              ar="يحتل المزوّد المموَّل صدارة فئته طوال الفترة، ويوسم بأنه مموَّل حيثما ظهر — دائماً. وإنهاء الرعاية يغلق الفترة؛ ويبقى الصف."
            />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 18 }}>
            {sponsorshipsAll().length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                <L en="No sponsorship is booked." ar="لا رعاية محجوزة." />
              </p>
            ) : null}
            {sponsorshipsAll().map((s) => (
              <div key={s.id} style={{ padding: '13px 17px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    <L en={s.vendorNameEn} ar={s.vendorNameAr} />
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {' '}· {s.starts} — {s.ends}
                    {s.amount ? ` · ${s.amount} ${s.currency}` : null}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {/* The booking's money state, from the one payment seam. */}
                  <span data-paystate="" style={{ padding: '3px 10px', borderRadius: 999, background: s.paidAt ? 'var(--brand-soft)' : 'var(--accent-soft)', color: s.paidAt ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12px' }}>
                    {s.paidAt ? <L en={`Paid ${s.paidAt}`} ar={`مسدَّد ⁦${s.paidAt}⁩`} /> : <L en="Unpaid" ar="غير مسدَّد" />}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: s.active ? 'var(--brand-soft)' : 'var(--surface2)', border: s.active ? 0 : '1px solid var(--line)', color: s.active ? 'var(--brand)' : 'var(--muted)', fontSize: '12px' }}>
                    {s.active ? <L en="In period" ar="ضمن الفترة" /> : <L en="Out of period" ar="خارج الفترة" />}
                  </span>
                  {s.active ? (
                    <form action={endSponsorshipAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" style={{ height: 30, paddingInline: 12, border: '1px solid var(--line)', borderRadius: 15, background: 'var(--bg)', color: 'var(--ink)', fontSize: '12px', cursor: 'pointer' }}>
                        <L en="End at close of today" ar="إنهاء بنهاية اليوم" />
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <form action={addSponsorshipAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <L en="Listed vendor" ar="مزوّد مُدرج" />
              </span>
              <select name="vendorId" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }}>
                <option value=""></option>
                {listedVendors().map((v) => (
                  <option key={v.id} value={v.id}>{v.nameEn}</option>
                ))}
              </select>
            </label>
            {[
              ['starts', 'From', 'من'],
              ['ends', 'To', 'إلى'],
            ].map(([name, en, ar]) => (
              <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <L en={en!} ar={ar!} />
                </span>
                <input name={name} type="date" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <L en="Price" ar="السعر" />
              </span>
              <input name="amount" type="number" step="any" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, width: 110, fontVariantNumeric: 'tabular-nums' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <L en="Currency" ar="العملة" />
              </span>
              <select name="currency" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }}>
                <option value=""></option>
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </label>
            <button type="submit" style={{ height: 34, paddingInline: 16, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
              <L en="Book the sponsorship" ar="حجز الرعاية" />
            </button>
          </form>
        </div>
      ) : null}

      {/* ADVERTS are this capability's content: image, link, period, placement.
          The placement select offers ONLY the structural list -- the foot of the
          public pages -- which is what keeps the constraint a constraint. */}
      {flag === 'advertising' ? (
        <div data-region="advert-manager" style={{ padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 12, maxWidth: 860, marginBlockEnd: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="Adverts" ar="الإعلانات" />
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
            <L
              en="An advert is an image, a link, a period and a placement — and the placements are the feet of the public pages, structurally: there is nowhere else one can go."
              ar="الإعلان صورة ورابط وفترة وموضع — والمواضع هي أسفل الصفحات العامة، بنيوياً: لا مكان آخر يذهب إليه."
            />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 18 }}>
            {advertsAll().length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                <L en="No advert is booked." ar="لا إعلان محجوزاً." />
              </p>
            ) : null}
            {advertsAll().map((ad) => {
              const pl = adPlacements().find((p) => p.key === ad.placement);
              return (
                <div key={ad.id} style={{ padding: '13px 17px', background: 'var(--surface2)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{ad.alt}</span>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                      <L en={pl?.en ?? ad.placement} ar={pl?.ar ?? ad.placement} />
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {ad.starts} — {ad.ends}{ad.amount ? ` · ${ad.amount} ${ad.currency}` : null}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span data-paystate="" style={{ padding: '3px 10px', borderRadius: 999, background: ad.paidAt ? 'var(--brand-soft)' : 'var(--accent-soft)', color: ad.paidAt ? 'var(--brand)' : 'var(--accent-ink)', fontSize: '12px' }}>
                      {ad.paidAt ? <L en={`Paid ${ad.paidAt}`} ar={`مسدَّد ⁦${ad.paidAt}⁩`} /> : <L en="Unpaid" ar="غير مسدَّد" />}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: ad.active ? 'var(--brand-soft)' : 'var(--surface2)', border: ad.active ? 0 : '1px solid var(--line)', color: ad.active ? 'var(--brand)' : 'var(--muted)', fontSize: '12px' }}>
                      {ad.active ? <L en="In period" ar="ضمن الفترة" /> : <L en="Out of period" ar="خارج الفترة" />}
                    </span>
                    {ad.active ? (
                      <form action={endAdvertAction}>
                        <input type="hidden" name="id" value={ad.id} />
                        <button type="submit" style={{ height: 30, paddingInline: 12, border: '1px solid var(--line)', borderRadius: 15, background: 'var(--bg)', color: 'var(--ink)', fontSize: '12px', cursor: 'pointer' }}>
                          <L en="End at close of today" ar="إنهاء بنهاية اليوم" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <form action={addAdvertAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <L en="Placement" ar="الموضع" />
                </span>
                <select name="placement" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }}>
                  <option value=""></option>
                  {adPlacements().map((p) => (
                    <option key={p.key} value={p.key}>{p.en}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <L en="Price" ar="السعر" />
                </span>
                <input name="amount" type="number" step="any" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <L en="Currency" ar="العملة" />
                </span>
                <select name="currency" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }}>
                  <option value=""></option>
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </label>
              {[
                ['imageUrl', 'Image address', 'عنوان الصورة'],
                ['linkUrl', 'Link address', 'عنوان الرابط'],
                ['alt', 'Image wording (alt text)', 'نص الصورة البديل'],
              ].map(([name, en, ar]) => (
                <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    <L en={en!} ar={ar!} />
                  </span>
                  <input name={name} style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13 }} />
                </label>
              ))}
              {[
                ['starts', 'From', 'من'],
                ['ends', 'To', 'إلى'],
              ].map(([name, en, ar]) => (
                <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    <L en={en!} ar={ar!} />
                  </span>
                  <input name={name} type="date" style={{ height: 34, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 17, fontSize: 13, fontVariantNumeric: 'tabular-nums' }} />
                </label>
              ))}
            </div>
            <div>
              <button type="submit" style={{ height: 34, paddingInline: 16, border: 0, borderRadius: 17, background: 'var(--brand)', color: 'var(--bg)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>
                <L en="Book the advert" ar="حجز الإعلان" />
              </button>
            </div>
          </form>
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
