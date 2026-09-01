import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { cancelEventAction, postponeEventAction } from '../../../actions';
import { currentAccount, organizationFor } from '../../../../lib/auth';
import { eventFor, unreadCountFor } from '../../../../lib/queries';
import { LIFECYCLE_CONTENT } from '../../../../lib/rules';

/**
 * Cancel or postpone -- required by three instruments, on its own route so the
 * weight of each act is stated in full before the click. A cancelled record
 * offers neither form again; a postponed one keeps the postpone form so the new
 * date can be recorded when it is set.
 */
export default async function LifecyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  const { error } = await searchParams;
  const organization = organizationFor(account.id);
  const LC = LIFECYCLE_CONTENT;

  const label: React.CSSProperties = { fontSize: '12.5px', color: 'var(--muted)', display: 'block', marginBlockEnd: 6 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 };

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unreadCountFor(account.id)} showBack={true} back={{ href: `/events/${id}`, en: 'Event record', ar: 'سجل الفعالية' }} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 8 }}>
            <L en={`${event.nameEn} · ${event.id}`} ar={`${event.nameAr} · ${event.id}`} />
          </div>
          <h1 data-sec-h1="" style={{ margin: '0 0 28px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Cancel or postpone" ar="الإلغاء أو التأجيل" />
          </h1>
          {error === 'reason' ? (
            <div style={{ padding: '16px 22px', border: '1px solid var(--bad)', background: 'var(--bad-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: 15 }}>
              <L en="A reason is required. It is sent to the Ministry as written." ar="السبب مطلوب. ويُرسل إلى الوزارة كما هو." />
            </div>
          ) : null}

          {event.lifecycle === 'cancelled' ? (
            <div style={{ padding: '24px 28px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--bad)', borderRadius: 12, fontSize: 15, lineHeight: 1.7 }}>
              <L
                en={LC.cancel.bandEn.replace('{date}', event.lifecycleAt ?? '')}
                ar={LC.cancel.bandAr.replace('{date}', event.lifecycleAt ?? '')}
              />
            </div>
          ) : (
            <>
              {event.lifecycle === 'postponed' ? (
                <div style={{ padding: '20px 26px', background: 'var(--accent-soft)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.7, color: 'var(--accent-ink)' }}>
                  <L
                    en={(event.postponedTo ? LC.postpone.bandDateEn.replace('{newDate}', event.postponedTo) : LC.postpone.bandNoDateEn).replace('{date}', event.lifecycleAt ?? '')}
                    ar={(event.postponedTo ? LC.postpone.bandDateAr.replace('{newDate}', `⁦${event.postponedTo}⁩`) : LC.postpone.bandNoDateAr).replace('{date}', event.lifecycleAt ? `⁦${event.lifecycleAt}⁩` : '')}
                  />
                </div>
              ) : null}

              {/* Postpone -- the lighter act first. */}
              <div style={{ padding: '26px 30px', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>
                  <L en={LC.postpone.titleEn} ar={LC.postpone.titleAr} />
                </h2>
                <p style={{ margin: '0 0 18px', fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
                  <L en={LC.postpone.bodyEn} ar={LC.postpone.bodyAr} />
                </p>
                <form action={postponeEventAction.bind(null, id)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <span style={label}><L en={LC.postpone.dateLabelEn} ar={LC.postpone.dateLabelAr} /></span>
                    <input name="newDate" type="date" defaultValue={event.postponedTo ?? ''} style={{ ...input, maxWidth: 240, fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  <div>
                    <span style={label}><L en={LC.postpone.reasonLabelEn} ar={LC.postpone.reasonLabelAr} /></span>
                    <textarea name="reason" required rows={2} defaultValue={event.lifecycle === 'postponed' ? (event.lifecycleNote ?? '') : ''} style={{ ...input, resize: 'vertical' }} />
                  </div>
                  <button type="submit" style={{ alignSelf: 'start', height: 44, paddingInline: 22, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, cursor: 'pointer' }}>
                    <L en={LC.postpone.buttonEn} ar={LC.postpone.buttonAr} />
                  </button>
                </form>
              </div>

              {/* Cancel -- the closing act, with its weight stated. */}
              <div style={{ padding: '26px 30px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--bad)', borderRadius: 16 }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>
                  <L en={LC.cancel.titleEn} ar={LC.cancel.titleAr} />
                </h2>
                <p style={{ margin: '0 0 18px', fontSize: '14.5px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
                  <L en={LC.cancel.bodyEn} ar={LC.cancel.bodyAr} />
                </p>
                <form action={cancelEventAction.bind(null, id)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <span style={label}><L en={LC.cancel.reasonLabelEn} ar={LC.cancel.reasonLabelAr} /></span>
                    <textarea name="reason" required rows={2} style={{ ...input, resize: 'vertical' }} />
                  </div>
                  <button type="submit" style={{ alignSelf: 'start', height: 44, paddingInline: 22, border: '1px solid var(--bad)', background: 'var(--bg)', borderRadius: 22, fontSize: 14, color: 'var(--bad)', cursor: 'pointer' }}>
                    <L en={LC.cancel.buttonEn} ar={LC.cancel.buttonAr} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
