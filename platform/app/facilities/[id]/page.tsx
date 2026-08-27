import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../../lib/auth';
import {
  facilityDetail,
  facilityDevices,
  facilityLedgerFor,
  facilityRequests,
  unreadCountFor,
  publishedCycles,
  ministryConfig,
} from '../../../lib/queries';
import { beirutToday } from '../../../lib/clock';
import {
  FACILITY_CONTENT,
  facilityCategory,
  facilityStanding,
  addDaysIso,
  type ObligationStatus,
} from '../../../lib/rules';

/**
 * Facility readiness -- the standing state (step 6). Readiness is not a score and
 * does not progress: the ledger derives each obligation's dates from the record
 * (lib/rules/facility.ts), and the as-of pills preview the same derivation at a
 * future date. Status wording is provisional and the screen says so (SPEC).
 */

const STATUS_STYLE: Record<ObligationStatus, { color: string; chipBg: string }> = {
  current: { color: 'var(--brand)', chipBg: 'var(--brand-soft)' },
  lapsing: { color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' },
  lapsed: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
  notRecorded: { color: 'var(--bad)', chipBg: 'var(--bad-soft)' },
};

const ACTION_ROUTE: Record<string, (id: string) => string> = {
  padExpiry: (id) => `/facilities/${id}/devices`,
  batteryExpiry: (id) => `/facilities/${id}/devices`,
  latestCheck: (id) => `/facilities/${id}/devices`,
  drill: (id) => `/facilities/${id}/plan`,
  annualConfirmation: (id) => `/facilities/${id}/plan`,
  coordinator: (id) => `/facilities/${id}/plan#persons`,
};

export default async function FacilityReadinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asof?: string; notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const facility = facilityDetail(account.id, id);
  if (!facility) notFound();
  const { asof, notice } = await searchParams;
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);

  // The preview offsets are the lapse window and three windows out -- the GOVERNED
  // window: published where the Ministry has set one, provisional otherwise.
  const cycles = publishedCycles();
  const windowDays = cycles.lapseWindowDays;
  const offsets = [0, windowDays, windowDays * 3];
  const requested = Number.parseInt(asof ?? '0', 10) || 0;
  const offset = offsets.includes(requested) ? requested : 0;
  const today = beirutToday();
  const asOfDate = offset === 0 ? today : addDaysIso(today, offset);
  const ledger = facilityLedgerFor(facility.id, asOfDate);
  const standing = facilityStanding(ledger);
  const devices = facilityDevices(facility.id);
  const requests = facilityRequests(facility.id);
  const category = facilityCategory(facility.categoryKey);
  const content = FACILITY_CONTENT;
  const catRequirements = ministryConfig().get('categoryRequirements') ?? null;
  const short = content.categories.find((c) => c.key === facility.categoryKey) as
    | { shortEn?: string; shortAr?: string }
    | undefined;

  const days = cycles.lapseWindowDays;
  const fill = (tpl: string, n: number): string =>
    tpl.replace('{n}', String(n)).replace('{days}', String(days));
  const standingLine =
    standing.kind === 'lapsed'
      ? { en: fill(standing.lapsedCount === 1 ? content.standing.lapsed.enOne : content.standing.lapsed.enMany, standing.lapsedCount), ar: fill(content.standing.lapsed.ar, standing.lapsedCount), border: 'var(--bad)', bg: 'var(--bad-soft)' }
      : standing.kind === 'lapsing'
        ? { en: fill(standing.lapsingCount === 1 ? content.standing.lapsing.enOne : content.standing.lapsing.enMany, standing.lapsingCount), ar: fill(content.standing.lapsing.ar, standing.lapsingCount), border: 'var(--accent)', bg: 'var(--accent-soft)' }
        : { en: fill(content.standing.met.en, 0), ar: fill(content.standing.met.ar, 0), border: 'var(--line)', bg: 'var(--surface)' };

  const obligationByKey = new Map(content.ledger.obligations.map((o) => [o.key, o]));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        {notice === 'incident' ? (
          <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
            <L en="The incident report has been submitted to the Ministry." ar="قُدِّم تقرير الحادثة إلى الوزارة." />
          </div>
        ) : null}
        {notice === 'confirmed' ? (
          <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
            <L en="The readiness confirmation has been recorded." ar="سُجِّل تأكيد الجاهزية." />
          </div>
        ) : null}
        {notice === 'coordinator' ? (
          <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
            <L en="The responsible persons have been reviewed and recorded." ar="روجعت بيانات الأشخاص المسؤولين وسُجِّلت." />
          </div>
        ) : null}

        <div data-region="record-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 36 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L
                en={`${short?.shortEn ?? category?.en ?? ''} · ${facility.municipalityEn}`}
                ar={`${short?.shortAr ?? category?.ar ?? ''} · ${facility.municipalityAr}`}
              />
            </div>
            <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
              <L en={facility.nameEn} ar={facility.nameAr} />
            </h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockStart: 8, fontVariantNumeric: 'tabular-nums' }}>
              <L en={`Record ID ${facility.id}`} ar={`معرّف السجل ${facility.id}`} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'start' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              <L en="Viewing the ledger as of" ar="عرض السجل بتاريخ" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {offsets.map((v) => ({
                v,
                en: v === 0 ? 'Today' : `+${v} days`,
                ar: v === 0 ? 'اليوم' : `+${v} يوماً`,
              })).map((o) => {
                const on = offset === o.v;
                return (
                  <Link
                    key={o.v}
                    href={o.v === 0 ? `/facilities/${facility.id}` : `/facilities/${facility.id}?asof=${o.v}`}
                    style={{ height: 34, paddingInline: 13, border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--muted)', borderRadius: 17, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}
                  >
                    <L en={o.en} ar={o.ar} />
                  </Link>
                );
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{asOfDate}</div>
          </div>
        </div>

        <div data-region="standing" style={{ padding: '28px 32px', border: `1px solid ${standingLine.border}`, background: standingLine.bg, borderRadius: 16, marginBlockEnd: 14 }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en="Standing readiness" ar="الجاهزية القائمة" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.4, maxWidth: '60ch' }}>
            <L en={standingLine.en} ar={standingLine.ar} />
          </div>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--muted)' }}>
          <L en={content.ledger.intro.en} ar={content.ledger.intro.ar} />
        </p>
        {/* Two different provisional things, and publishing one does not settle the
            other. The CYCLE FIGURES stop being provisional when the Ministry publishes
            them. The STATUS WORDING (Current, Lapsing, Lapsed and the standing line)
            stays provisional until the Ministry approves the labels themselves --
            facility.json: "provisionalNote below must render wherever they appear".
            Gating the wording note on the figures made publishing a cadence silently
            withdraw a caveat about something else entirely. */}
        <p data-region="provisional" style={{ margin: '0 0 40px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
          <L en={content.provisionalNote.en} ar={content.provisionalNote.ar} />
          {!cycles.provisional ? (
            <>
              {' '}
              <L
                en={`Cycles run on the Ministry's published values: device checks every ${cycles.checkCycleDays} days, a ${cycles.lapseWindowDays}-day lapse window.`}
                ar={`تسري الدورات وفق القيم المنشورة من الوزارة: فحص الأجهزة كل ${cycles.checkCycleDays} يوماً، ونافذة انتهاء ${cycles.lapseWindowDays} يوماً.`}
              />
            </>
          ) : null}
        </p>

        {catRequirements ? (
          <div data-region="category-requirements" style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, marginBlockEnd: 40, maxWidth: '86ch' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Additional requirements for this category — published by the Ministry" ar="متطلبات إضافية لهذه الفئة — منشورة من الوزارة" />
            </div>
            <div style={{ fontSize: '14.5px', lineHeight: 1.65 }}>{catRequirements.value}</div>
            {catRequirements.effective ? (
              <div style={{ marginBlockStart: 8, fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <L en={`Effective ${catRequirements.effective}`} ar={`يسري اعتباراً من ⁦${catRequirements.effective}⁩`} />
              </div>
            ) : null}
          </div>
        ) : null}

        <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Validity ledger" ar="سجل الصلاحية" />
        </h2>
        <div data-region="ledger" data-stack="" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr .9fr .8fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBlockEnd: 44 }}>
          {content.ledger.columns.map((c) => (
            <div key={c.en} data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              <L en={c.en} ar={c.ar} />
            </div>
          ))}
          <div data-th="" style={{ background: 'var(--surface2)', padding: '12px 18px' }} />
          {ledger.map((row) => {
            const o = obligationByKey.get(row.key);
            const st = STATUS_STYLE[row.status];
            const statusLabel = content.statuses[row.status];
            return [
              <div key={`${row.key}-name`} style={{ background: 'var(--bg)', padding: 18, borderInlineStart: `3px solid ${st.color}`, fontSize: 16, fontWeight: 500 }}>
                <L en={o?.en ?? row.key} ar={o?.ar ?? row.key} />
              </div>,
              <div key={`${row.key}-from`} style={{ background: 'var(--bg)', padding: 18, fontSize: '14.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {row.lastAffirmed ?? '—'}
              </div>,
              <div key={`${row.key}-until`} style={{ background: 'var(--bg)', padding: 18, fontSize: '14.5px', fontVariantNumeric: 'tabular-nums', color: st.color }}>
                {row.until ?? '—'}
              </div>,
              <div key={`${row.key}-status`} style={{ background: 'var(--bg)', padding: 18, fontSize: '13.5px' }}>
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: st.chipBg, color: st.color }}>
                  <L en={statusLabel.en} ar={statusLabel.ar} />
                </span>
              </div>,
              <div key={`${row.key}-action`} style={{ background: 'var(--bg)', padding: 18, fontSize: 14 }}>
                <Link href={ACTION_ROUTE[row.key]?.(facility.id) ?? `/facilities/${facility.id}`}>
                  <L en={o?.actionEn ?? ''} ar={o?.actionAr ?? ''} />
                </Link>
              </div>,
            ];
          })}
        </div>

        <h2 style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Registered AEDs" ar="الأجهزة المسجّلة" />
        </h2>
        <div data-region="devices" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBlockEnd: 44 }}>
          {devices.map((d) => {
            const until = [d.padExpiry, d.batteryExpiry].filter((x): x is string => x !== null);
            const min = until.length ? until.reduce((a, b) => (a < b ? a : b)) : null;
            const st = STATUS_STYLE[
              !d.accessibleHours ? 'lapsed' : min === null ? 'notRecorded' : min < asOfDate ? 'lapsed' : addDaysIso(asOfDate, days) >= min ? 'lapsing' : 'current'
            ];
            return (
              <Link
                key={d.label}
                href={`/facilities/${facility.id}/devices`}
                style={{ textAlign: 'start', paddingBlock: 23, paddingInlineStart: 22, paddingInlineEnd: 23, background: 'var(--surface2)', borderInlineStart: `3px solid ${st.color}`, borderRadius: 12, color: 'var(--ink)' }}
              >
                <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBlockEnd: 8 }}>
                  {d.label} · {d.identification}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBlockEnd: 10 }}>
                  <L en={d.locationEn} ar={d.locationAr} />
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {!d.accessibleHours ? (
                    <L en="Reported not accessible during operating hours" ar="أُبلغ أنه غير متاح للوصول خلال ساعات العمل" />
                  ) : d.padExpiry ? (
                    <L en={`Pads valid to ${d.padExpiry}${d.pediatric === 'yes' ? ' · pediatric capable' : ''}`} ar={`اللواصق صالحة حتى ⁦${d.padExpiry}⁩${d.pediatric === 'yes' ? ' · متاح للأطفال' : ''}`} />
                  ) : (
                    <L en="Readiness dates not yet recorded" ar="لم تُسجَّل تواريخ الجاهزية بعد" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {requests.length > 0 ? (
          <div data-region="ministry-request" style={{ padding: '27px 31px', background: 'var(--surface2)', borderRadius: 16, maxWidth: '88ch', marginBlockEnd: 44 }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
              <L en="Requested by the Ministry" ar="مطلوب من الوزارة" />
            </div>
            {requests.map((r) => (
              <div key={r.id} style={{ fontSize: 16, lineHeight: 1.6, marginBlockEnd: 8 }}>
                <L en={r.bodyEn} ar={r.bodyAr} />
              </div>
            ))}
            <Link href="/notifications" style={{ fontSize: '14.5px' }}>
              <L en="Respond to the request" ar="الرد على الطلب" />
            </Link>
          </div>
        ) : null}

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/facilities/${facility.id}/devices`,
              en: 'AED registry',
              ar: 'سجل أجهزة إزالة الرجفان',
              descEn: 'Each device is a separate record: confirm, relocate, replace.',
              descAr: 'كل جهاز سجل مستقل: تأكيد أو نقل أو استبدال.',
            },
            {
              href: `/facilities/${facility.id}/plan`,
              en: 'Cardiac emergency response plan',
              ar: 'خطة الاستجابة لطوارئ توقف القلب',
              descEn: 'The structured plan, its derived device section and the annual confirmation.',
              descAr: 'الخطة المنظّمة وقسم أجهزتها المستمد والتأكيد السنوي.',
            },
            {
              href: `/facilities/${facility.id}/incidents/new`,
              en: 'Facility cardiac-arrest incident report',
              ar: 'تقرير حادثة توقف القلب في المرفق',
              descEn: 'Filed after any suspected cardiac arrest, CPR attempt or AED use.',
              descAr: 'يُقدَّم بعد أي اشتباه بتوقف القلب أو محاولة إنعاش أو استخدام جهاز.',
            },
          ]}
        />
      </main>
    </>
  );
}
