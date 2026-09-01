import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { currentAccount } from '../../../../lib/auth';
import { governanceFor, invitationForEvent, unreadCountFor } from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';
import { saveGovernanceAction } from '../../../actions';

/**
 * Clinical governance and medical command -- the Director's to write. The text lands
 * read-only in the organizer's plan (sections 10 and 12) and the major-incident
 * plan; the organizer cannot overwrite it.
 */
export default async function GovernancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const invitation = invitationForEvent(account.id, id, 'director');
  if (!invitation) notFound();
  const { notice } = await searchParams;
  const unread = unreadCountFor(account.id);
  const content = ROLES_CONTENT.director;
  const sections = governanceFor(id);

  const stateOf = (key: string): { en: string; ar: string; bg: string; color: string } => {
    const v = sections[key]?.trim() ?? '';
    if (v.length > 120) return { en: 'Written', ar: 'مكتوب', bg: 'var(--brand-soft)', color: 'var(--brand)' };
    if (v.length > 0) return { en: 'Started', ar: 'بُدئ', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
    return { en: 'Not written', ar: 'غير مكتوب', bg: 'var(--bad-soft)', color: 'var(--bad)' };
  };

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 940 }}>
          {notice === 'saved' ? (
            <div style={{ padding: '18px 24px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="Saved. Your text now shows in the organizer's plan." ar="حُفظ. ويظهر نصكم الآن في خطة المنظّم." />
            </div>
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 14 }}>
            <L en={`${invitation.eventNameEn} · Level 3`} ar={`${invitation.eventNameAr} · المستوى 3`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Clinical governance and medical command" ar="الحوكمة السريرية والقيادة الطبية" />
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
            <L en={content.govIntro.en} ar={content.govIntro.ar} />
          </p>

          <div data-region="where" style={{ padding: '20px 24px', background: 'var(--surface2)', borderRadius: 12, marginBlockEnd: 28, maxWidth: '80ch' }}>
            <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
              <L en="Where this appears" ar="أين يظهر هذا" />
            </div>
            <div style={{ fontSize: '14.5px', lineHeight: 1.7 }}>
              <L en={content.govWhere.en} ar={content.govWhere.ar} />
            </div>
          </div>

          <form action={saveGovernanceAction.bind(null, id)}>
            <div data-region="gov-sections" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBlockEnd: 24 }}>
              {content.govSections.map((g) => {
                const s = stateOf(g.key);
                return (
                  <div key={g.key} style={{ paddingBlock: '29px', paddingInlineStart: '32px', paddingInlineEnd: '33px', background: 'var(--surface2)', borderInlineStart: `3px solid ${s.color}`, borderRadius: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 12 }}>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', flex: 1, minWidth: 240 }}>
                        <L en={g.en} ar={g.ar} />
                      </h2>
                      <span style={{ flex: 'none', padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 13 }}>
                        <L en={s.en} ar={s.ar} />
                      </span>
                    </div>
                    <div style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--muted)', marginBlockEnd: 16, maxWidth: '70ch' }}>
                      <L en={g.askEn} ar={g.askAr} />
                    </div>
                    <textarea
                      name={g.key}
                      rows={4}
                      defaultValue={sections[g.key] ?? ''}
                      style={{ width: '100%', padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.7, resize: 'vertical' }}
                    />
                    <div style={{ marginBlockStart: 12, fontSize: 13, color: 'var(--muted)' }}>
                      <L en={`Writes into: ${g.intoEn}`} ar={`يُكتب في: ${g.intoAr}`} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="submit" style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              <L en="Save — the organizer's plan reads this" ar="حفظ — تقرأ خطة المنظّم هذا" />
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
