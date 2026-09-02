import { L } from '../../../components/L';
import { MinistryShell } from '../../../components/MinistryShell';
import { requireMinistryPage } from '../../../lib/ministry-auth';
import { correctiveActions, facilitiesForOversight } from '../../../lib/queries';
import { FACILITY_CONTENT, can } from '../../../lib/rules';
import { ministryConfig } from '../../../lib/queries';
import { markCorrectiveDoneAction, recordFacilityCorrectiveAction, requestReadinessConfirmationAction } from '../../ministry-actions';

/**
 * Facility oversight -- the cardiac lane, carrying no event outcome. Corrective
 * actions are raised and tracked here; while the corrective-action timeline is
 * an unset Ministry value, no due date is computed and the row says so.
 */
export default async function FacilityOversightPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await requireMinistryPage('viewFacilityLane');
  const { notice } = await searchParams;
  const facilities = facilitiesForOversight(account.isDemo);
  const corrective = correctiveActions(account.isDemo);
  const mayCorrect = can(account.role, 'recordCorrective');
  const timeline = ministryConfig().get('correctiveTimelines');

  const shortEn = (key: string): string =>
    (FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortEn?: string } | undefined)?.shortEn ?? key;
  const shortAr = (key: string): string =>
    (FACILITY_CONTENT.categories.find((c) => c.key === key) as { shortAr?: string } | undefined)?.shortAr ?? key;

  return (
    <MinistryShell account={account} back={{ href: '/ministry', en: 'Operational dashboard', ar: 'اللوحة التشغيلية' }}>
      {notice === 'raised' ? (
        <div style={{ padding: '16px 22px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 10, marginBlockEnd: 20, fontSize: 14 }}>
          <L en="The corrective action has been raised and the operator notified." ar="أُثير الإجراء التصحيحي وأُبلغ المشغّل." />
        </div>
      ) : null}
      <h1 data-sec-h1="" style={{ margin: '0 0 24px', fontSize: 30, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Facility oversight" ar="الرقابة على المرافق" />
      </h1>

      <div data-region="facilities" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 32 }}>
        {facilities.map((f) => (
          <div key={f.id} style={{ paddingBlock: '16px', paddingInlineStart: '20px', paddingInlineEnd: '21px', background: 'var(--surface2)', borderInlineStart: `3px solid ${f.standingKind === 'met' ? 'var(--brand)' : f.standingKind === 'lapsing' ? 'var(--accent)' : 'var(--bad)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                <L en={f.nameEn} ar={f.nameAr} />
              </span>
              <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                <L en={`${shortEn(f.categoryKey)} · ${f.municipality} · ${f.devices} devices`} ar={`${shortAr(f.categoryKey)} · ${f.municipality} · ${f.devices} أجهزة`} />
              </span>
            </span>
            <span style={{ padding: '3px 9px', borderRadius: 999, background: f.standingKind === 'met' ? 'var(--brand-soft)' : f.standingKind === 'lapsing' ? 'var(--accent-soft)' : 'var(--bad-soft)', color: f.standingKind === 'met' ? 'var(--brand)' : f.standingKind === 'lapsing' ? 'var(--accent-ink)' : 'var(--bad)', fontSize: '12.5px' }}>
              {f.standingKind === 'met' ? <L en="Obligations being met" ar="الموجبات مستوفاة" /> : f.standingKind === 'lapsing' ? <L en="Items lapsing — the operator's to renew" ar="بنود تقترب من الانتهاء — تجديدها على المشغّل" /> : <L en="Obligations not being met — the operator's to correct" ar="الموجبات غير مستوفاة — تصحيحها على المشغّل" />}
            </span>
          </div>
        ))}
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
        <L en="Corrective actions" ar="الإجراءات التصحيحية" />
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
        {timeline ? (
          <L en={`Due dates run ${timeline.value} days from the action being raised, per the published timeline effective ${timeline.effective ?? ''}.`} ar={`تُحتسب تواريخ الاستحقاق ${timeline.value} يوماً من إثارة الإجراء، وفق المهلة المنشورة السارية من ⁦${timeline.effective ?? ''}⁩.`} />
        ) : (
          <L en="The corrective-action timeline is a Ministry value not yet set: no due date is computed until it is published." ar="مهلة الإجراء التصحيحي قيمة وزارية لم تُحدَّد بعد: لا يُحتسب تاريخ استحقاق قبل نشرها." />
        )}
      </p>
      <div data-region="corrective" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 20 }}>
        {corrective.map((c) => (
          <div key={c.id} style={{ paddingBlock: '15px', paddingInlineStart: '18px', paddingInlineEnd: '19px', background: 'var(--surface2)', borderInlineStart: `3px solid ${c.status === 'open' ? 'var(--bad)' : 'var(--brand)'}`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14.5px', lineHeight: 1.5, flex: 1, minWidth: 260 }}>
              <L en={`${c.facilityEn} — ${c.bodyEn}`} ar={`${c.facilityAr} — ${c.bodyAr}`} />
              <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>
                <L en={`Raised ${c.raisedAt}${c.raisedBy ? ` · ${c.raisedBy}` : ''}`} ar={`أُثير في ⁦${c.raisedAt}⁩${c.raisedBy ? ` · ${c.raisedBy}` : ''}`} />
              </span>
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: c.status === 'open' ? 'var(--bad-soft)' : 'var(--brand-soft)', color: c.status === 'open' ? 'var(--bad)' : 'var(--brand)', fontSize: '12.5px' }}>
                {c.status === 'open' ? <L en="Open" ar="مفتوح" /> : <L en={`Corrected ${c.correctedAt ?? ''}`} ar={`صُحّح ⁦${c.correctedAt ?? ''}⁩`} />}
              </span>
            </span>
            {mayCorrect && c.status === 'open' ? (
              <form action={markCorrectiveDoneAction.bind(null, c.id)} style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  name="note"
                  required
                  aria-label="What was verified"
                  placeholder=""
                  style={{ flex: 1, minWidth: 240, height: 32, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: '12.5px' }}
                />
                <button type="submit" style={{ height: 32, paddingInline: 12, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 16, fontSize: '12.5px', cursor: 'pointer' }}>
                  <L en="Close — record what was verified" ar="إقفال — تسجيل ما جرى التحقق منه" />
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
      {mayCorrect ? (
        <div data-region="readiness-request" style={{ marginBlockEnd: 24 }}>
          <form action={requestReadinessConfirmationAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                <L en="Request readiness confirmation" ar="طلب تأكيد الجاهزية" />
              </span>
              <select name="facilityId" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }}>
                <option value="">—</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.nameEn}</option>
                ))}
              </select>
            </label>
            <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 13, cursor: 'pointer' }}>
              <L en="Request confirmation — the operator is notified" ar="طلب التأكيد — يُبلَّغ المشغّل" />
            </button>
          </form>
        </div>
      ) : null}
      {mayCorrect ? (
        <form action={recordFacilityCorrectiveAction} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              <L en="Facility" ar="المرفق" />
            </span>
            <select name="facilityId" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }}>
              <option value="">—</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.nameEn}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              <L en="What must be corrected, as the operator will read it" ar="ما يجب تصحيحه، كما سيقرأه المشغّل" />
            </span>
            <input name="body" required style={{ height: 38, paddingInline: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 19, fontSize: 13 }} />
          </label>
          <button type="submit" style={{ height: 38, paddingInline: 16, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 13, cursor: 'pointer' }}>
            <L en="Raise the corrective action" ar="إثارة الإجراء التصحيحي" />
          </button>
        </form>
      ) : null}
    </MinistryShell>
  );
}
