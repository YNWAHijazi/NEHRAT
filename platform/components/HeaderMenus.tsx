'use client';

/**
 * The interactive parts of the header: language toggle, notification bell, account menu.
 * Geometry from the reference markup.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { MINISTRY_CONTENT, bilingualMap } from '../lib/rules';
import { L } from './L';
import { signOutAction } from '../app/actions';

export function LangToggle() {
  return (
    <button
      type="button"
      onClick={() => {
        const h = document.documentElement;
        const next = h.getAttribute('lang') === 'ar' ? 'en' : 'ar';
        document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
        h.setAttribute('lang', next);
        h.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
      }}
      className="language-toggle"
      style={{
        height: 40,
        paddingInline: 10,
        background: 'none',
        border: '1px solid var(--line)',
        borderRadius: 18,
        cursor: 'pointer',
        fontSize: '13.5px',
      }}
    >
      <span data-l="en">العربية</span>
      <span data-l="ar">English</span>
    </button>
  );
}

export function HeaderMenus({
  displayName,
  initials,
  organizationNameEn,
  organizationNameAr,
  organizationStatus,
  unreadCount,
  role = 'organizer',
}: {
  displayName: string;
  initials: string;
  organizationNameEn: string | null;
  organizationNameAr: string | null;
  organizationStatus?: string | undefined;
  unreadCount: number;
  role?: string;
}) {
  // A counterparty holds a profile, not an organization record — the menu offered
  // them "Organization details" and /organization refused them (counterparty pass).
  const counterparty = role === 'ems' || role === 'director';
  const organizer = role === 'organizer';
  const roleLabel = bilingualMap(MINISTRY_CONTENT.roleLabels)[role];
  const router = useRouter();
  const [acctOpen, setAcctOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!acctOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setAcctOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [acctOpen]);

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => router.push('/notifications')}
          style={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            border: '0',
            borderRadius: 18,
            cursor: 'pointer',
          }}
        >
          <span className="sr-only"><L en="Notifications" ar="الإشعارات" /></span>
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z" />
            <path d="M10.5 18a1.6 1.6 0 003 0" />
          </svg>
        </button>
        {unreadCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              insetBlockStart: -3,
              insetInlineEnd: -3,
              minWidth: 17,
              height: 17,
              paddingInline: 4,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--bad)',
              color: 'var(--bg)',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </div>
      <div ref={menuRef} style={{ position: 'relative' }} onKeyDown={(event) => {
        if (event.key === 'Escape') { setAcctOpen(false); triggerRef.current?.focus(); }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAcctOpen(false);
      }}>
        <button ref={triggerRef}
          type="button"
          aria-controls={menuId}
          aria-expanded={acctOpen}
          onClick={() => setAcctOpen((v) => !v)}
          style={{
            height: 40,
            width: 40,
            padding: 0,
            justifyContent: 'center',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: acctOpen ? 'var(--surface2)' : 'var(--bg)',
            border: '0',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: '13.5px',
          }}
        >
          <span className="sr-only"><L en="Account menu" ar="قائمة الحساب" /></span>
          <span aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 16,
              background: 'var(--brand)',
              color: 'var(--bg)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {initials}
          </span>
        </button>
        {acctOpen ? (
          <div id={menuId} data-account-menu=""
            style={{
              position: 'absolute',
              insetBlockStart: 44,
              insetInlineEnd: 0,
              zIndex: 60,
              width: 260,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,.14)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBlockEnd: '1px solid var(--line)' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{displayName}</div>
              {organizationNameEn && organizationNameAr ? (
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
                  <L en={organizationNameEn} ar={organizationNameAr} />
                </div>
              ) : null}
              {roleLabel ? <div style={{ fontSize: 12, color: 'var(--muted)', marginBlockStart: 4 }}><L en={roleLabel.en} ar={roleLabel.ar} /></div> : null}
              {organizer && organizationStatus !== 'recorded' ? <div style={{ fontSize: 12, color: 'var(--accent-ink)', marginBlockStart: 6 }}>
                {organizationStatus === 'returned' ? <L en="Organization details need updating" ar="يجب تحديث تفاصيل المؤسسة" /> : organizationNameEn ? <L en="Organization pending Ministry approval" ar="المؤسسة بانتظار موافقة الوزارة" /> : <L en="Organization not yet recorded" ar="لم تُسجَّل المؤسسة بعد" />}
              </div> : null}
            </div>
            {counterparty || organizer ? <button
              type="button"
              onClick={() => { setAcctOpen(false); router.push(counterparty ? '/profile' : '/organization'); }}
              style={{ width: '100%', textAlign: 'start', padding: '12px 16px', background: 'none', border: 0, borderBlockEnd: '1px solid var(--line)', fontSize: 14, cursor: 'pointer' }}
            >
              {counterparty ? <L en="Profile" ar="الملف التعريفي" /> : <L en="Organization details" ar="تفاصيل المؤسسة" />}
            </button> : null}
            <button
              type="button"
              onClick={() => { setAcctOpen(false); router.push('/notifications'); }}
              style={{ width: '100%', textAlign: 'start', padding: '12px 16px', background: 'none', border: 0, borderBlockEnd: '1px solid var(--line)', fontSize: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}
            >
              <span>
                <L en="Notifications" ar="الإشعارات" />
              </span>
              {unreadCount > 0 ? (
                <span style={{ padding: '1px 7px', borderRadius: 8, background: 'var(--bad)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {unreadCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void signOutAction()}
              style={{ width: '100%', textAlign: 'start', padding: '12px 16px', background: 'none', border: 0, fontSize: 14, color: 'var(--bad)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}
            >
              <svg aria-hidden="true" data-flip="" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 19.5h-8v-15h8" />
                <path d="M11 12h9.5M17.5 8.5l3.5 3.5-3.5 3.5" />
              </svg>
              <L en="Sign out" ar="تسجيل الخروج" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * A standalone sign-out control, for shells with no account dropdown.
 *
 * The Ministry console had NO way out: every /ministry and /platform screen uses
 * MinistryShell, which showed the signed-in name and role and offered nothing to
 * act on -- a dead end of exactly the shape the rest of this build has been
 * clearing, on the one control every session needs.
 */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOutAction()}
      style={{
        height: 34,
        paddingInline: 14,
        border: '1px solid var(--line)',
        background: 'var(--bg)',
        borderRadius: 17,
        fontSize: 13,
        color: 'var(--bad)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flex: 'none',
      }}
    >
      <svg aria-hidden="true" data-flip="" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 19.5h-8v-15h8" />
        <path d="M11 12h9.5M17.5 8.5l3.5 3.5-3.5 3.5" />
      </svg>
      <L en="Sign out" ar="تسجيل الخروج" />
    </button>
  );
}
