import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { beirutToday } from '../../../lib/clock';
import {
  daysBetween,
  unreadCountFor,
  venueAssessmentsFor,
  venueById,
  venueChangeSinceAssessment,
  venueChangesFor,
} from '../../../lib/queries';
import { requirementsForLevel, venueReassessmentGate, REASSESSMENT_WINDOW, VENUE_FLOOR_NOTE, type Gate, type Level } from '../../../lib/rules';
import enMessages from '../../../lib/i18n/messages/en.json';
import arMessages from '../../../lib/i18n/messages/ar.json';

function messageFor(catalog: Record<string, unknown>, key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let node: unknown = catalog;
  for (const part of parts) {
    node = (node as Record<string, unknown>)[part];
  }
  let text = String(node ?? key);
  for (const [k, v] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

const upLabel: React.CSSProperties = {
  fontSize: '11.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBlockEnd: 4,
};

type StageKind = 'done' | 'current' | 'todo' | 'issued';

interface RailStage {
  k: StageKind;
  en: string;
  ar: string;
  metaEn: string;
  metaAr: string;
}

const STAGE_STYLE: Record<StageKind, { color: string; edge: string; ink: string; weight: number; lblEn: string; lblAr: string; chipBg: string; chipColor: string }> = {
  done: { color: 'var(--brand)', edge: 'solid', ink: 'var(--ink)', weight: 500, lblEn: 'Complete', lblAr: 'مُنجزة', chipBg: 'var(--brand-soft)', chipColor: 'var(--brand)' },
  current: { color: 'var(--accent)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Current', lblAr: 'الحالية', chipBg: 'var(--accent-soft)', chipColor: 'var(--accent-ink)' },
  todo: { color: 'var(--line)', edge: 'solid', ink: 'var(--muted)', weight: 400, lblEn: 'Not yet', lblAr: 'لم تبدأ', chipBg: 'var(--surface2)', chipColor: 'var(--muted)' },
  issued: { color: 'var(--brand)', edge: 'solid', ink: 'var(--ink)', weight: 600, lblEn: 'Issued', lblAr: 'صادر', chipBg: 'var(--brand-soft)', chipColor: 'var(--brand)' },
};

function GatedAction({ gate, href, en, ar }: { gate: Gate; href: string; en: string; ar: string }) {
  if (gate.behaviour === 'absent') return null;
  if (gate.behaviour === 'enabled') {
    return (
      <Link
        href={href}
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
      >
        <L en={en} ar={ar} />
      </Link>
    );
  }
  const reasonEn = gate.reasonKey ? messageFor(enMessages, gate.reasonKey, gate.params) : '';
  const reasonAr = gate.reasonKey ? messageFor(arMessages, gate.reasonKey, gate.params) : '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 5, alignItems: 'start' }}>
      <button
        type="button"
        disabled
        style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px' }}
      >
        <L en={en} ar={ar} />
      </button>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', maxWidth: 210 }}>
        <L en={reasonEn} ar={reasonAr} />
      </span>
    </span>
  );
}

export default async function VenueRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const venue = venueById(account.id, id);
  if (!venue) notFound();

  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const versions = venueAssessmentsFor(account.id, venue.id);
  const latest = versions[0] ?? null;
  const changes = venueChangesFor(account.id, venue.id);
  const today = beirutToday();

  const level = venue.level as Level | null;
  const classified = level !== null && venue.validUntil !== null;
  const daysLeft = venue.validUntil ? daysBetween(today, venue.validUntil) : null;
  const lapseWindow = REASSESSMENT_WINDOW.opensDaysBeforeExpiry;

  // The state chip, from the reference: expired -> reassessment required; inside the
  // reassessment window -> lapsing; otherwise classified. The window is data, not 60.
  const state =
    daysLeft === null
      ? { en: 'Not yet assessed', ar: 'لم يُقيَّم بعد', color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' }
      : daysLeft < 0
        ? { en: 'Reassessment required', ar: 'يلزم إعادة التقييم', color: 'var(--bad)', chipBg: 'var(--bad-soft)' }
        : daysLeft <= lapseWindow
          ? { en: 'Lapsing', ar: 'يقترب من الانتهاء', color: 'var(--accent-ink)', chipBg: 'var(--accent-soft)' }
          : { en: 'Classified', ar: 'مصنَّف', color: 'var(--brand)', chipBg: 'var(--brand-soft)' };

  const gate = venueReassessmentGate({
    validUntil: venue.validUntil,
    today,
    changeReportedSinceAssessment: venueChangeSinceAssessment(account.id, venue.id),
  });

  // The venue's own stages (reviewer instruction, Slice 3 approval): registration,
  // assessment, classification recorded, valid, reassessment due. The reference rail
  // reused the event flow's names ("Requirements", "Submitted") for steps a venue does
  // not have; accurate beats faithful on a status display.
  const effective = latest?.effective ?? '';
  const registered = venue.createdAt.slice(0, 10);
  const expired = daysLeft !== null && daysLeft < 0;
  const reassessmentDue = gate.behaviour === 'enabled' && classified;
  const opensDate = gate.behaviour === 'disabled' ? String(gate.params?.['date'] ?? '') : '';
  const stages: RailStage[] = [
    { k: 'done', en: 'Registration', ar: 'التسجيل', metaEn: registered, metaAr: `⁦${registered}⁩` },
    classified
      ? { k: 'done', en: 'Annual assessment', ar: 'التقييم السنوي', metaEn: effective, metaAr: `⁦${effective}⁩` }
      : { k: 'current', en: 'Annual assessment', ar: 'التقييم السنوي', metaEn: 'Not yet complete', metaAr: 'لم يكتمل بعد' },
    classified
      ? { k: 'issued', en: 'Classification recorded', ar: 'تسجيل التصنيف', metaEn: `Level ${level} · ${venue.issued}`, metaAr: `المستوى ${level} · ⁦${venue.issued}⁩` }
      : { k: 'todo', en: 'Classification recorded', ar: 'تسجيل التصنيف', metaEn: '', metaAr: '' },
    !classified
      ? { k: 'todo', en: 'Valid', ar: 'ساري الصلاحية', metaEn: '', metaAr: '' }
      : expired
        ? { k: 'done', en: 'Valid', ar: 'ساري الصلاحية', metaEn: `Ended ${venue.validUntil}`, metaAr: `انتهى في ⁦${venue.validUntil}⁩` }
        : reassessmentDue
          ? { k: 'done', en: 'Valid', ar: 'ساري الصلاحية', metaEn: `Through ${venue.validUntil}`, metaAr: `حتى ⁦${venue.validUntil}⁩` }
          : { k: 'current', en: 'Valid', ar: 'ساري الصلاحية', metaEn: `Through ${venue.validUntil}`, metaAr: `حتى ⁦${venue.validUntil}⁩` },
    !classified
      ? { k: 'todo', en: 'Reassessment due', ar: 'استحقاق إعادة التقييم', metaEn: '', metaAr: '' }
      : reassessmentDue
        ? { k: 'current', en: 'Reassessment due', ar: 'استحقاق إعادة التقييم', metaEn: expired ? 'Classification expired' : `Before ${venue.validUntil}`, metaAr: expired ? 'انتهت صلاحية التصنيف' : `قبل ⁦${venue.validUntil}⁩` }
        : { k: 'todo', en: 'Reassessment due', ar: 'استحقاق إعادة التقييم', metaEn: opensDate ? `Opens ${opensDate}` : '', metaAr: opensDate ? `يُفتح في ⁦${opensDate}⁩` : '' },
  ];
  const railNoteEn = !classified
    ? 'Stage 2 of 5'
    : reassessmentDue
      ? `Stage 5 of 5 · reassessment before ${venue.validUntil}`
      : `Stage 4 of 5 · reassessment opens ${opensDate}`;
  const railNoteAr = !classified
    ? 'المرحلة 2 من 5'
    : reassessmentDue
      ? `المرحلة 5 من 5 · إعادة التقييم قبل ⁦${venue.validUntil}⁩`
      : `المرحلة 4 من 5 · تُفتح إعادة التقييم في ⁦${opensDate}⁩`;

  const requirements = level ? requirementsForLevel(level) : [];
  const attachOutstanding = requirements.filter((r) => r.attach).length;

  const history: { en: string; ar: string; date: string }[] = [
    ...changes.map((c) => ({
      en: 'Material change reported',
      ar: 'أُبلغ عن تغيير جوهري',
      date: c.reportedAt.slice(0, 10),
    })),
    ...versions.map((v) => ({
      en: `Annual assessment recorded — version ${v.version}`,
      ar: `سُجّل التقييم السنوي — النسخة ${v.version}`,
      date: v.effective,
    })),
    { en: 'Venue registered', ar: 'سُجّل الموقع', date: venue.createdAt.slice(0, 10) },
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div data-region="rail" style={{ marginBlockEnd: 28, padding: '23px 27px', background: 'var(--surface2)', borderRadius: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', marginBlockEnd: 18 }}>
            <span style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              <L en="Where this venue stands" ar="موضع هذا الموقع" />
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              <L en={railNoteEn} ar={railNoteAr} />
            </span>
          </div>
          <div data-rail="" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {stages.map((s, i) => {
              const st = STAGE_STYLE[s.k];
              return (
                <div key={i} style={{ paddingBlockStart: 12, borderBlockStart: `3px ${st.edge} ${st.color}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlockEnd: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <span style={{ padding: '2px 7px', borderRadius: 999, background: st.chipBg, color: st.chipColor, fontSize: 11, letterSpacing: '.03em' }}>
                      <L en={st.lblEn} ar={st.lblAr} />
                    </span>
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: st.weight, lineHeight: 1.4, color: st.ink }}>
                    <L en={s.en} ar={s.ar} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 5 }}>
                    <L en={s.metaEn} ar={s.metaAr} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div data-region="record-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 32 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 10 }}>
              <L en={`Recurring venue · ${venue.addressMunicipalityEn}`} ar={`موقع فعاليات دوري · ${venue.addressMunicipalityAr}`} />
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBlockEnd: 12 }}>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Record ID" ar="معرّف السجل" />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{venue.id}</div>
              </div>
              <div>
                <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                  <L en="Ministry reference number" ar="الرقم المرجعي للوزارة" />
                </div>
                {venue.mophReference ? (
                  <div style={{ fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>{venue.mophReference}</div>
                ) : (
                  <div style={{ fontSize: '14.5px', color: 'var(--muted)' }}>
                    <L en="Issued at first classification" ar="يصدر عند أول تصنيف" />
                  </div>
                )}
              </div>
            </div>
            <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
              <L en={venue.nameEn} ar={venue.nameAr} />
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'start' }}>
            <div>
              <div style={upLabel}>
                <L en="Classification" ar="التصنيف" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: level ? `var(--l${level})` : 'var(--muted)' }}>
                {level !== null ? <L en={`Level ${level}`} ar={`المستوى ${level}`} /> : '—'}
              </div>
            </div>
            {classified ? (
              <>
                <div>
                  <div style={upLabel}>
                    <L en="Effective from" ar="ساري اعتباراً من" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{venue.issued}</div>
                </div>
                <div>
                  <div style={upLabel}>
                    <L en="Valid through" ar="صالح حتى" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: state.color }}>{venue.validUntil}</div>
                </div>
                <div>
                  <div style={upLabel}>
                    <L en="Days remaining" ar="الأيام المتبقية" />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{daysLeft}</div>
                </div>
              </>
            ) : null}
            <div>
              <div style={{ ...upLabel, marginBlockEnd: 6 }}>
                <L en="State" ar="الحالة" />
              </div>
              <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, background: state.chipBg, color: state.color, fontSize: 14 }}>
                <L en={state.en} ar={state.ar} />
              </div>
            </div>
          </div>
        </div>

        {/* The floor note, at reviewer instruction: where an organizer could mistake the
            classification for an event certification. Not in the reference. */}
        {classified ? (
          <div data-region="floor-note" style={{ paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12, marginBlockEnd: 32, fontSize: 15, lineHeight: 1.65, maxWidth: '86ch' }}>
            <L en={VENUE_FLOOR_NOTE.en} ar={VENUE_FLOOR_NOTE.ar} />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'start', marginBlockEnd: 32 }}>
          <GatedAction gate={gate} href={`/venues/${venue.id}/assessment`} en="Start the annual reassessment" ar="بدء إعادة التقييم السنوي" />
          <Link
            href={`/venues/${venue.id}/change`}
            style={{ height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: '14.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}
          >
            <L en="Report a change" ar="الإبلاغ عن تغيير" />
          </Link>
        </div>

        {classified ? (
          <>
            <div data-region="counters" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBlockEnd: 32 }}>
              <div style={{ flex: 1, minWidth: 240, paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 12 }}>
                <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--brand)' }}>{requirements.length}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                  <L en="requirements apply at this level" ar="متطلباً ينطبق على هذا المستوى" />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 240, paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--accent)', borderRadius: 12 }}>
                <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--accent-ink)' }}>{attachOutstanding}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
                  <L en="attachments outstanding" ar="مرفقات غير مقدَّمة" />
                </div>
              </div>
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
              <L en={`Requirements for Level ${level}`} ar={`متطلبات المستوى ${level}`} />
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
              <L
                en="One row per requirement, showing the value that applies at this level. A dashed edge marks an item owed by someone else."
                ar="سطر واحد لكل متطلب، يعرض القيمة المنطبقة على هذا المستوى. الحد المتقطع يشير إلى بند على جهة أخرى."
              />
            </p>
            <div data-region="requirements" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBlockEnd: 44 }}>
              {requirements.map((r) => (
                <div key={r.n} style={{ paddingBlock: '19px', paddingInlineStart: '22px', paddingInlineEnd: '23px', background: 'var(--surface2)', borderInlineStart: `3px ${r.ems ? 'dashed' : 'solid'} ${r.ems ? 'var(--muted)' : 'var(--brand)'}`, borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'start', minWidth: 280, flex: 1 }}>
                    <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: r.ems ? 'var(--muted)' : 'var(--brand)', marginBlockStart: 9 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 16, lineHeight: 1.45 }}>
                        <L en={r.en} ar={r.ar} />
                      </span>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBlockStart: 3 }}>
                        <L en={r.valueEn} ar={r.valueAr} />
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 auto', flexWrap: 'wrap', minWidth: 0, justifyContent: 'end' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, minWidth: 0 }}>
                      <L en={r.respEn} ar={r.respAr} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div data-region="history">
        <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Assessment history" ar="سجل التقييم" />
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {history.map((h, i) => (
            <div key={i} style={{ background: 'var(--bg)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14.5px' }}>
                <L en={h.en} ar={h.ar} />
              </span>
              <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{h.date}</span>
            </div>
          ))}
        </div>
        </div>

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/venues/${venue.id}/change`,
              en: 'Report a change',
              ar: 'الإبلاغ عن تغيير',
              descEn: 'A material change to the venue requires reassessment before the annual date.',
              descAr: 'التغيير الجوهري في الموقع يستوجب إعادة التقييم قبل الموعد السنوي.',
            },
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Every record on this account, and what each one owes.',
              descAr: 'كل سجل على هذا الحساب وما يستحق على كل منها.',
            },
          ]}
        />
      </main>
    </>
  );
}
