import { notFound, redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../../components/Header';
import { L } from '../../../../components/L';
import { Briefing } from '../../../invitations/[token]/Briefing';
import { currentAccount } from '../../../../lib/auth';
import {
  invitationForEvent,
  nominationBriefing,
  nomineePlanSlice,
  unreadCountFor,
} from '../../../../lib/queries';
import { ROLES_CONTENT } from '../../../../lib/rules';

/**
 * THE STANDING VIEW: what a named party can go on reading after they accept.
 *
 * Before this, everything a counterparty was told about the event lived on the
 * nomination token — a link in their mail, read once, before they had an account.
 * After accepting they had a dashboard row and no way back to the facts they accepted
 * on. This is the same scope as stage one, at a route they reach from that row, and
 * it follows the organizer's record rather than a copy taken at acceptance.
 *
 * THE PLAN SLICE, AND WHY IT IS FOUR SECTIONS. A provider deciding whether it can meet
 * the major-incident arrangements needs the arrangements, not a note that they exist.
 * But the plan also carries the organizer's staffing, equipment, contingencies and
 * contacts, and being named in an event is not being named in all of it. The four are
 * fixed in lib/rules/nomination-access: access and extraction, communications,
 * receiving emergency departments, major incident.
 *
 * THE VERSION STAMP IS THE POINT OF THE WHOLE SCREEN. A standing view that changes
 * silently is worse than none: a party who read the arrangements in August and acts on
 * them in September must be able to see whether what they read is what stands.
 */
export default async function EventBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const { id } = await params;

  // The nomination IS the entitlement. Not the role, not a membership: this account
  // holds a confirmed nomination on this event, or there is nothing here for it.
  const kind = account.role === 'director' ? 'director' : 'ems';
  const invitation = invitationForEvent(account.id, id, kind);
  if (!invitation || invitation.status !== 'confirmed') notFound();

  const briefing = nominationBriefing(invitation.token);
  if (!briefing) notFound();
  const plan = nomineePlanSlice(id);
  const N = ROLES_CONTENT.nomination;
  const unread = unreadCountFor(account.id);

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={null} unreadCount={unread} showBack />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
            <L en={N.standingTitleEn} ar={N.standingTitleAr} />
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: '16.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '70ch' }}>
            <L en={N.standingIntroEn} ar={N.standingIntroAr} />
          </p>

          {/* The same component stage one renders. One screen, so the scope cannot
              drift between what a party was shown before accepting and after. */}
          <Briefing
            briefing={briefing}
            token={invitation.token}
            kind={invitation.kind}
            level={invitation.eventLevel}
            namedEn={invitation.nameEn}
            namedAr={invitation.nameAr}
          />

          <div data-region="plan-slice" style={{ marginBlockEnd: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
                <L en={N.planTitleEn} ar={N.planTitleAr} />
              </h2>
              {plan ? (
                <span data-region="plan-version" style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <L
                    en={N.planVersionEn.replace('{v}', String(plan.version)).replace('{d}', plan.updatedAt)}
                    ar={N.planVersionAr.replace('{v}', String(plan.version)).replace('{d}', plan.updatedAt)}
                  />
                </span>
              ) : null}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
              <L en={N.planIntroEn} ar={N.planIntroAr} />
            </p>
            {plan ? (
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
                <L en={N.planVersionNoteEn} ar={N.planVersionNoteAr} />
              </p>
            ) : null}

            {!plan ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
                <L en={N.planNoneEn} ar={N.planNoneAr} />
              </div>
            ) : (
              <>
                {plan.mode === 'attach' ? (
                  <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 12, fontSize: '13px', lineHeight: 1.65, maxWidth: '78ch' }}>
                    <L en={N.planAttachedEn} ar={N.planAttachedAr} />
                  </div>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  {plan.sections.map((sec) => (
                    <div key={sec.n} style={{ background: 'var(--bg)', padding: '14px 18px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                          <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{sec.n}</span>
                          <span style={{ fontSize: '14.5px', lineHeight: 1.45 }}>
                            <L en={sec.en} ar={sec.ar} />
                          </span>
                        </span>
                        {plan.mode === 'attach' ? (
                          <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: sec.covered ? 'var(--brand-soft)' : 'var(--bad-soft)', color: sec.covered ? 'var(--brand)' : 'var(--bad)', fontSize: 12 }}>
                            <L en={sec.covered ? N.coveredEn : N.notCoveredEn} ar={sec.covered ? N.coveredAr : N.notCoveredAr} />
                          </span>
                        ) : null}
                      </div>
                      {plan.mode === 'write' ? (
                        <div style={{ marginBlockStart: 8, marginInlineStart: 32, fontSize: '13.5px', lineHeight: 1.7, maxWidth: '78ch', whiteSpace: 'pre-wrap', color: sec.text === '' ? 'var(--muted)' : 'var(--ink)' }}>
                          {sec.text === '' ? <L en={N.planSectionEmptyEn} ar={N.planSectionEmptyAr} /> : sec.text}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
