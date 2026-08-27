/**
 * The Director's view of an event: the requirements that name the Event Medical
 * Director, derived from the matrix (never written as a list), requirement 15 marked
 * as theirs alone, and the shared rows naming who else holds them.
 */

import Link from 'next/link';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import type { Account } from '../../../lib/auth';
import type { InvitationDetail } from '../../../lib/queries';
import { ROLES_CONTENT, directorRequirements, filingDeadline } from '../../../lib/rules';

export function DirectorEventView({
  account,
  invitation,
  unread,
  governance,
  providerStats,
  reportSigned,
}: {
  account: Account;
  invitation: InvitationDetail;
  unread: number;
  governance: Record<string, string>;
  providerStats: { named: number; signed: number };
  reportSigned: { organizer: boolean; director: boolean } | null;
}) {
  const content = ROLES_CONTENT.director;
  const requirements = directorRequirements(3);
  const fileBy = invitation.eventStart
    ? filingDeadline(3, new Date(`${invitation.eventStart}T12:00:00+03:00`)).date
    : null;

  // Each requirement's state derives from record facts the Director can act on:
  // 15 from the command text, 16 from the incident-role text, 19 from the report's
  // signatures. The two shared readiness rows (8, 12) certify through the provider
  // declarations, so their state follows those signatures.
  const stateOf = (n: number): 'done' | 'part' | 'open' => {
    if (n === 15) return governance['command']?.trim() ? 'done' : governance['clinical']?.trim() ? 'part' : 'open';
    if (n === 16) return governance['incidentRole']?.trim() ? 'done' : 'open';
    if (n === 19) return reportSigned?.director ? 'done' : 'open';
    return providerStats.signed > 0 ? 'done' : 'part';
  };
  const CHIP = {
    done: { en: 'Addressed', ar: 'عولج', bg: 'var(--brand-soft)', color: 'var(--brand)' },
    part: { en: 'Started', ar: 'بُدئ', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    open: { en: 'Not addressed', ar: 'لم يُعالج', bg: 'var(--bad-soft)', color: 'var(--bad)' },
  } as const;
  const openCount = requirements.filter((r) => stateOf(r.n) !== 'done').length;

  const linkFor = (n: number): { href: string; en: string; ar: string } | null => {
    if (n === 15) return { href: `/events/${invitation.eventId}/governance`, en: 'Write the medical-command arrangements', ar: 'كتابة ترتيبات القيادة الطبية' };
    if (n === 16) return { href: `/events/${invitation.eventId}/governance`, en: 'Write your role in the incident structure', ar: 'كتابة دوركم في بنية الحوادث' };
    if (n === 19) return { href: `/events/${invitation.eventId}/report`, en: 'Open the post-event report', ar: 'فتح التقرير اللاحق' };
    return null;
  };

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L
            en={`${invitation.eventNameEn} · ${invitation.organizationNameEn} · ${invitation.eventStart ?? ''} · Level 3`}
            ar={`${invitation.eventNameAr} · ${invitation.organizationNameAr} · ⁦${invitation.eventStart ?? ''}⁩ · المستوى 3`}
          />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="What you are responsible for" ar="ما أنتم مسؤولون عنه" />
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
          <L
            en={`${requirements.length} requirements name the Event Medical Director. Where a requirement is shared, the other parties are named beside it, so nobody assumes it is theirs alone.`}
            ar={`${requirements.length} متطلبات تسمّي المدير الطبي للفعالية. وحيث يكون المتطلب مشتركاً، تُسمّى الأطراف الأخرى إلى جانبه، كي لا يُفترض أنه لطرف واحد.`}
          />
        </p>

        <div data-region="counters" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBlockEnd: 40 }}>
          <div style={{ flex: 1, minWidth: 230, paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: `3px solid ${openCount > 0 ? 'var(--bad)' : 'var(--brand)'}`, borderRadius: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: openCount > 0 ? 'var(--bad)' : 'var(--brand)' }}>{openCount}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 4 }}>
              <L en="requirements left to address" ar="متطلباً بقي معالجته" />
            </div>
          </div>
          {fileBy ? (
            <div style={{ flex: 1, minWidth: 230, paddingBlock: '21px', paddingInlineStart: '24px', paddingInlineEnd: '25px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--accent)', borderRadius: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--accent-ink)', marginBlockStart: 6 }}>{fileBy}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBlockStart: 6 }}>
                <L en="organizer files by this date and cannot file until these are addressed" ar="يقدّم المنظّم بحلول هذا التاريخ ولا يمكنه التقديم قبل معالجتها" />
              </div>
            </div>
          ) : null}
        </div>

        <div data-region="requirements" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockEnd: 44 }}>
          {requirements.map((r) => {
            const s = stateOf(r.n);
            const chip = CHIP[s];
            const link = linkFor(r.n);
            return (
              <div key={r.n} style={{ background: r.sole ? 'var(--accent-soft)' : 'var(--surface)', border: r.sole ? '1px solid var(--accent)' : '1px solid var(--line)', borderInlineStart: `3px solid ${r.sole ? 'var(--accent)' : chip.color}`, borderRadius: 12, padding: '22px 26px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 12 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBlockEnd: 6 }}>
                      <span style={{ flex: 'none', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{r.n}</span>
                      <span style={{ fontSize: '16.5px', fontWeight: r.sole ? 600 : 500, lineHeight: 1.45 }}>
                        <L en={r.en} ar={r.ar} />
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, marginInlineStart: 34 }}>
                      <L en={`Level 3: ${r.valueEn}`} ar={`المستوى 3: ${r.valueAr}`} />
                    </div>
                  </div>
                  <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: chip.bg, color: chip.color, fontSize: 13 }}>
                    <L en={chip.en} ar={chip.ar} />
                  </span>
                </div>

                {r.sole ? (
                  <div style={{ marginInlineStart: 34, padding: '14px 18px', background: 'var(--bg)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.65 }}>
                    <span style={{ display: 'block', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 6 }}>
                      <L en="Yours alone" ar="لكم وحدكم" />
                    </span>
                    <L en={content.soleNote.en} ar={content.soleNote.ar} />
                  </div>
                ) : (
                  <div style={{ marginInlineStart: 34 }}>
                    {/* The co-holders by name only. The acted/waiting chips were
                        presumed and are dropped at reviewer instruction (Slice 5
                        review) -- a presumed chip is worse than no chip. They return
                        when a real per-party action record exists to derive from. */}
                    <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
                      <L en="Also held by" ar="يتحمّله أيضاً" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                      {r.others.map((h) => (
                        <div key={h.en} style={{ background: 'var(--bg)', padding: '11px 14px', fontSize: 14 }}>
                          <L en={h.en} ar={h.ar} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {link ? (
                  <div style={{ marginInlineStart: 34, marginBlockStart: 14 }}>
                    <Link href={link.href} style={{ height: 38, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 19, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                      <L en={link.en} ar={link.ar} />
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div data-region="certified-about" style={{ padding: '25px 29px', background: 'var(--surface2)', borderRadius: 12, maxWidth: '82ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
            <L en="Certified about you by others" ar="ما يُصدَّق عنكم من الآخرين" />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7 }}>
            <L
              en={`Each participating emergency medical service certifies that communication with the Event Medical Director is established — item 7 of its readiness declaration. ${providerStats.signed} of the ${providerStats.named} named agencies ${providerStats.signed === 1 ? 'has' : 'have'} signed.`}
              ar={`تصدّق كل جهة خدمات طوارئ طبية مشاركة على أن التواصل مع المدير الطبي للفعالية قائم — البند 7 من إقرار جاهزيتها. وقد وقّعت ${providerStats.signed} من الجهات الـ${providerStats.named} المُسمّاة.`}
            />
          </div>
        </div>

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: `/events/${invitation.eventId}/governance`,
              en: 'Clinical governance and medical command',
              ar: 'الحوكمة السريرية والقيادة الطبية',
              descEn: "Yours to write; it lands in the organizer's plan.",
              descAr: 'من كتابتكم؛ ويُدرج في خطة المنظّم.',
            },
            {
              href: `/events/${invitation.eventId}/report`,
              en: 'Post-event medical report',
              ar: 'التقرير الطبي لما بعد الفعالية',
              descEn: 'Two signatures at Level 3; yours is one of them.',
              descAr: 'توقيعان في المستوى 3؛ توقيعكم أحدهما.',
            },
          ]}
        />
      </main>
    </>
  );
}
