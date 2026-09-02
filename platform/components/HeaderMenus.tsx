'use client';

/**
 * The interactive parts of the header: language toggle, notification bell, account menu.
 * Geometry from the reference markup.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
      style={{
        height: 36,
        paddingInline: 14,
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
  unreadCount,
  role = 'organizer',
}: {
  displayName: string;
  initials: string;
  organizationNameEn: string | null;
  organizationNameAr: string | null;
  unreadCount: number;
  role?: string;
}) {
  // A counterparty holds a profile, not an organization record — the menu offered
  // them "Organization details" and /organization refused them (counterparty pass).
  const counterparty = role === 'ems' || role === 'director';
  const router = useRouter();
  const [acctOpen, setAcctOpen] = useState(false);

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => router.push('/notifications')}
          style={{
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            background: unreadCount > 0 ? 'var(--accent-soft)' : 'var(--bg)',
            border: `1px solid ${unreadCount > 0 ? 'var(--accent-ink)' : 'var(--line)'}`,
            borderRadius: 18,
            cursor: 'pointer',
          }}
        >
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
            {unreadCount}
          </span>
        ) : null}
      </div>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-expanded={acctOpen}
          onClick={() => setAcctOpen((v) => !v)}
          style={{
            height: 36,
            paddingInline: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: acctOpen ? 'var(--surface2)' : 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: '13.5px',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 11,
              background: 'var(--brand)',
              color: 'var(--bg)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {initials}
          </span>
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </button>
        {acctOpen ? (
          <div
            style={{
              position: 'absolute',
              insetBlockStart: 44,
              insetInlineEnd: 0,
              zIndex: 60,
              width: 250,
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
            </div>
            <button
              type="button"
              onClick={() => { setAcctOpen(false); router.push(counterparty ? '/profile' : '/organization'); }}
              style={{ width: '100%', textAlign: 'start', padding: '12px 16px', background: 'none', border: 0, borderBlockEnd: '1px solid var(--line)', fontSize: 14, cursor: 'pointer' }}
            >
              {counterparty ? <L en="Profile" ar="الملف التعريفي" /> : <L en="Organization details" ar="تفاصيل المؤسسة" />}
            </button>
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
