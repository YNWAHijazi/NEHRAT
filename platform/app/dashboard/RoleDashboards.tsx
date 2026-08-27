/**
 * The EMS provider's and the Director's dashboards: events you have been named in,
 * split into outstanding and complete, with what is owed named on every row. Rows
 * derive from the account's linked invitations -- an event this account was not
 * named in does not exist here (rule 6).
 */

import Link from 'next/link';
import { L } from '../../components/L';
import type { InvitationDetail } from '../../lib/queries';
import { filingDeadline } from '../../lib/rules';
import { addDaysIso, POST_EVENT_REPORT } from '../../lib/rules';

interface RowShape {
  key: string;
  href: string;
  nameEn: string; nameAr: string;
  orgEn: string; orgAr: string;
  date: string;
  level: number | null;
  chips: { en: string; ar: string; bg: string; color: string }[];
  owedEn: string; owedAr: string;
  byLabelEn: string; byLabelAr: string;
  byEn: string; byAr: string;
  color: string;
  done: boolean;
  doneChipEn?: string; doneChipAr?: string;
}

const PART_CHIP: Record<string, { en: string; ar: string; bg: string; color: string }> = {
  nominated: { en: 'Nominated', ar: 'مُرشَّح', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
  confirmed: { en: 'Participation confirmed', ar: 'تأكدت المشاركة', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  declined: { en: 'Declined', ar: 'معتذَر عنه', bg: 'var(--bad-soft)', color: 'var(--bad)' },
  withdrawn: { en: 'Withdrawn by the organizer', ar: 'سحبه المنظّم', bg: 'var(--surface2)', color: 'var(--muted)' },
  removed: { en: 'Removed by the organizer', ar: 'أزاله المنظّم', bg: 'var(--surface2)', color: 'var(--muted)' },
};

function fileBy(inv: InvitationDetail): string {
  if (!inv.eventStart || !inv.eventLevel) return '';
  return filingDeadline(inv.eventLevel, new Date(`${inv.eventStart}T12:00:00+03:00`)).date;
}

export function emsRows(invitations: InvitationDetail[]): RowShape[] {
  return invitations
    .filter((i) => i.kind === 'ems' && i.status !== 'declined')
    .map((inv) => {
      const level = inv.eventLevel;
      const isL3 = level === 3;
      const opsSupplied = Object.keys(inv.opsDetail).length > 0;
      const closed = inv.status === 'removed' || inv.status === 'withdrawn';
      const done = closed || (isL3 ? inv.declaration === 'signed' : opsSupplied);
      const chips = [PART_CHIP[inv.status] ?? PART_CHIP['nominated']!];
      if (isL3) {
        chips.push(
          inv.declaration === 'signed'
            ? { en: 'Declaration — signed', ar: 'الإقرار — موقّع', bg: 'var(--brand-soft)', color: 'var(--brand)' }
            : inv.declaration === 'draft'
              ? { en: 'Declaration — draft', ar: 'الإقرار — مسودة', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' }
              : { en: 'Declaration — not started', ar: 'الإقرار — لم يبدأ', bg: 'var(--surface2)', color: 'var(--muted)' },
        );
      }
      return {
        key: inv.token,
        href: isL3 ? `/events/${inv.eventId}/declaration` : `/events/${inv.eventId}/participation`,
        nameEn: inv.eventNameEn, nameAr: inv.eventNameAr,
        orgEn: inv.organizationNameEn, orgAr: inv.organizationNameAr,
        date: inv.eventStart ?? '', level, chips,
        owedEn: isL3 ? 'EMS Readiness Declaration' : 'Confirm participation and supply operational detail',
        owedAr: isL3 ? 'إقرار جاهزية خدمات الطوارئ الطبية' : 'تأكيد المشاركة وتزويد التفاصيل التشغيلية',
        byLabelEn: isL3 ? 'Organizer files by' : 'No declaration at Level 2',
        byLabelAr: isL3 ? 'يقدّم المنظّم بحلول' : 'لا إقرار في المستوى 2',
        byEn: isL3 ? fileBy(inv) : "For the organizer's plan",
        byAr: isL3 ? `⁦${fileBy(inv)}⁩` : 'لخطة المنظّم',
        color: isL3 ? 'var(--bad)' : 'var(--accent-ink)',
        done,
        ...(closed
          ? { doneChipEn: 'Removed by the organizer — nothing owed', doneChipAr: 'أزالها المنظّم — لا شيء مستحق' }
          : done && inv.signedAt
            ? { doneChipEn: `Signed ${inv.signedAt.slice(0, 10)}`, doneChipAr: `وُقّع ⁦${inv.signedAt.slice(0, 10)}⁩` }
            : done
              ? { doneChipEn: 'Detail supplied', doneChipAr: 'قُدّمت التفاصيل' }
              : {}),
      };
    });
}

export function directorRows(
  invitations: InvitationDetail[],
  reportState: Map<string, { organizerSigned: boolean; directorSigned: boolean }>,
  governanceState: Map<string, number>,
  today: string,
): RowShape[] {
  return invitations
    .filter((i) => i.kind === 'director' && i.status !== 'declined')
    // Withdrawn-before-answer rows without an account never reach this list; removed
    // ones do, and render closed below.
    .map((inv) => {
      const held = inv.eventEnd !== null && inv.eventEnd < today;
      const report = reportState.get(inv.eventId);
      const govDone = governanceState.get(inv.eventId) ?? 0;
      const closed = inv.status === 'removed' || inv.status === 'withdrawn';
      const reportOwed = !closed && held && report !== undefined && !report.directorSigned;
      const done = closed || (held ? (report?.directorSigned ?? false) : false);
      const reportDue = inv.eventEnd ? addDaysIso(inv.eventEnd, POST_EVENT_REPORT.windowDays) : '';
      return {
        key: inv.token,
        href: reportOwed || done ? `/events/${inv.eventId}/report` : `/events/${inv.eventId}`,
        nameEn: inv.eventNameEn, nameAr: inv.eventNameAr,
        orgEn: inv.organizationNameEn, orgAr: inv.organizationNameAr,
        date: inv.eventStart ?? '', level: inv.eventLevel,
        chips: [PART_CHIP[inv.status] ?? PART_CHIP['nominated']!],
        owedEn: reportOwed
          ? 'Post-event medical report — your signature'
          : govDone >= 3
            ? 'Nothing outstanding before the event'
            : 'Event medical command function, and your role in the major-incident plan',
        owedAr: reportOwed
          ? 'التقرير الطبي لما بعد الفعالية — توقيعكم'
          : govDone >= 3
            ? 'لا موجب قائماً قبل الفعالية'
            : 'وظيفة القيادة الطبية للفعالية، ودوركم في خطة الحوادث الجسيمة',
        ...(closed ? { doneChipEn: 'Removed by the organizer — nothing owed', doneChipAr: 'أزالها المنظّم — لا شيء مستحق' } : {}),
        byLabelEn: reportOwed ? 'Report due' : 'Organizer files by',
        byLabelAr: reportOwed ? 'التقرير مستحق' : 'يقدّم المنظّم بحلول',
        byEn: reportOwed ? reportDue : fileBy(inv),
        byAr: reportOwed ? `⁦${reportDue}⁩` : `⁦${fileBy(inv)}⁩`,
        color: 'var(--bad)',
        done,
        ...(done ? { doneChipEn: 'Report complete', doneChipAr: 'اكتمل التقرير' } : {}),
      };
    });
}

export function RoleDashboard({ rows, countEn, countAr }: { rows: RowShape[]; countEn: string; countAr: string }) {
  const outstanding = rows.filter((r) => !r.done);
  const complete = rows.filter((r) => r.done);
  return (
    <div>
      <h1 data-sec-h1="" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
        <L en="Events you have been named in" ar="الفعاليات التي سُمّيتم فيها" />
      </h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockEnd: 28 }}>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>
          <L en={countEn} ar={countAr} />
        </span>
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          <L en="Sorted by event date" ar="مرتبة بحسب تاريخ الفعالية" />
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 14 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Outstanding" ar="غير مُنجز" />
        </h2>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>
          <L en="Something is owed by you" ar="عليكم موجب قائم" />
        </span>
      </div>
      <div data-region="outstanding" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBlockEnd: 52 }}>
        {outstanding.length === 0 ? (
          <div style={{ padding: '24px 26px', border: '1px dashed var(--line)', borderRadius: 16, fontSize: 15, color: 'var(--muted)' }}>
            <L en="Nothing is outstanding." ar="لا موجب قائماً." />
          </div>
        ) : null}
        {outstanding.map((e) => (
          <Link key={e.key} href={e.href} data-stack="" style={{ textAlign: 'start', paddingBlock: '25px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: `3px solid ${e.color}`, borderRadius: 16, display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 1fr 1.4fr auto', gap: 20, alignItems: 'center', color: 'var(--ink)' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 5 }}>
                <L en={e.nameEn} ar={e.nameAr} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                <L en={e.orgEn} ar={e.orgAr} /> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{e.date}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBlockStart: 8 }}>
                {e.chips.map((c) => (
                  <span key={c.en} style={{ padding: '3px 8px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 12 }}>
                    <L en={c.en} ar={c.ar} />
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en="Level" ar="المستوى" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                {e.level !== null ? (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, borderInlineStart: `2px solid var(--l${e.level})`, background: `var(--l${e.level}s)` }}>
                    <L en={`Level ${e.level}`} ar={`المستوى ${e.level}`} />
                  </span>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en="Owed by you" ar="المطلوب منكم" />
              </div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.45 }}>
                <L en={e.owedEn} ar={e.owedAr} />
              </div>
            </div>
            <div data-due="" style={{ textAlign: 'end', minWidth: 190 }}>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en={e.byLabelEn} ar={e.byLabelAr} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: e.color }}>
                <L en={e.byEn} ar={e.byAr} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBlockEnd: 14 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.025em' }}>
          <L en="Complete" ar="مُنجز" />
        </h2>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>
          <L en="Nothing further is owed by you" ar="لا موجب إضافياً عليكم" />
        </span>
      </div>
      <div data-region="complete" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {complete.length === 0 ? (
          <div style={{ padding: '24px 26px', border: '1px dashed var(--line)', borderRadius: 16, fontSize: 15, color: 'var(--muted)' }}>
            <L en="Nothing is complete yet." ar="لم يُنجز شيء بعد." />
          </div>
        ) : null}
        {complete.map((e) => (
          <Link key={e.key} href={e.href} data-stack="" style={{ paddingBlock: '23px', paddingInlineStart: '26px', paddingInlineEnd: '27px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 16, display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 1fr 1.4fr auto', gap: 20, alignItems: 'center', color: 'var(--ink)' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.015em', marginBlockEnd: 5 }}>
                <L en={e.nameEn} ar={e.nameAr} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                <L en={e.orgEn} ar={e.orgAr} /> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{e.date}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBlockStart: 8 }}>
                {e.chips.map((c) => (
                  <span key={c.en} style={{ padding: '3px 8px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 12 }}>
                    <L en={c.en} ar={c.ar} />
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
                <L en="Level" ar="المستوى" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                {e.level !== null ? (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, borderInlineStart: `2px solid var(--l${e.level})`, background: `var(--l${e.level}s)` }}>
                    <L en={`Level ${e.level}`} ar={`المستوى ${e.level}`} />
                  </span>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div style={{ fontSize: '14.5px', lineHeight: 1.45 }}>
              <L en={e.owedEn} ar={e.owedAr} />
            </div>
            <div style={{ textAlign: 'end' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
                <L en={e.doneChipEn ?? 'Complete'} ar={e.doneChipAr ?? 'مُنجز'} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
