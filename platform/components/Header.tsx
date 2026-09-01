/**
 * Global chrome, from the reference: government band, Ministry mark, back button,
 * organization name and registration state, language toggle, notification bell with
 * unread count, account menu with sign out. Layout and geometry mirror the reference
 * markup; logical properties throughout.
 */

import Link from 'next/link';
import { L } from './L';
import { landingRouteFor } from '../lib/rules';
import { HeaderMenus, LangToggle } from './HeaderMenus';
import type { Account, Organization } from '../lib/auth';

export function GovernmentBand() {
  return (
    <div style={{ background: 'var(--surface2)', borderBlockEnd: '1px solid var(--line)' }}>
      <div
        data-pad=""
        style={{
          maxWidth: 1160,
          marginInline: 'auto',
          padding: '9px 32px',
          fontSize: '12.5px',
          letterSpacing: '.02em',
          color: 'var(--muted)',
        }}
      >
        <L en="An official service of the Republic of Lebanon" ar="خدمة رسمية من الجمهورية اللبنانية" />
      </div>
    </div>
  );
}

/**
 * The mark is a link home, which is what everybody tries first and what
 * PublicShell has always done. It was inert here, so a signed-out visitor who
 * reached /signin had no way back to the landing page at all -- no pill, no
 * clickable name, nothing but the browser's own Back.
 *
 * Home is derived, not fixed: landingRouteFor is the same derivation the
 * credentialed sign-in and the demonstration panel use, so a reviewer lands on
 * the Ministry console rather than an organizer dashboard they are refused.
 */
function MinistryMark({ account }: { account: Account | null }) {
  return (
    <Link
      href={account ? landingRouteFor(account.role) : '/'}
      style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 34,
          height: 34,
          border: '1.25px solid var(--brand)',
          borderRadius: '50%',
          flex: 'none',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 13,
            height: 13,
            background: 'var(--brand)',
            clipPath:
              'polygon(43% 0,57% 0,57% 43%,100% 43%,100% 57%,57% 57%,57% 100%,43% 100%,43% 57%,0 57%,0 43%,43% 43%)',
          }}
        />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: '14.5px', fontWeight: 600, letterSpacing: '-.01em' }}>
          <L en="Ministry of Public Health" ar="وزارة الصحة العامة" />
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          <L en="Event Health Readiness" ar="التأهب الصحي للفعاليات" />
        </span>
      </span>
    </Link>
  );
}

export function Header({
  account,
  organization,
  unreadCount,
  showBack,
}: {
  account: Account | null;
  organization: Organization | null;
  unreadCount: number;
  showBack: boolean;
}) {
  return (
    <header
      data-noprint=""
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'var(--bg)',
        borderBlockEnd: '1px solid var(--line)',
      }}
    >
      <div
        data-pad=""
        style={{
          maxWidth: 1160,
          marginInline: 'auto',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <MinistryMark account={account} />
        {showBack ? (
          <Link
            href={account ? landingRouteFor(account.role) : '/'}
            style={{
              height: 36,
              paddingInline: 15,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              borderRadius: 18,
              fontSize: '13.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              flex: 'none',
              color: 'var(--ink)',
            }}
          >
            <svg
              aria-hidden="true"
              data-flip=""
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {account ? (
              <L en="Dashboard" ar="اللوحة" />
            ) : (
              // The same label every public screen uses for this destination.
              <L en="Overview" ar="نظرة عامة" />
            )}
          </Link>
        ) : null}
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {account ? (
            <div style={{ textAlign: 'end', lineHeight: 1.3 }}>
              {organization ? (
                <div style={{ fontSize: '13.5px', fontWeight: 500 }}>
                  <L en={organization.nameEn} ar={organization.nameAr} />
                </div>
              ) : (
                <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{account.displayName}</div>
              )}
              {organization && organization.status === 'pending' ? (
                <div style={{ fontSize: 12, color: 'var(--accent-ink)' }}>
                  <L en="Organization pending Ministry approval" ar="المؤسسة بانتظار موافقة الوزارة" />
                </div>
              ) : null}
              {!organization && account.role === 'organizer' ? (
                // Organizer accounts only: a role account (EMS, Director, first
                // response) has no organization to record, so the line is ABSENT
                // there -- not greyed (rule 10).
                <div style={{ fontSize: 12, color: 'var(--accent-ink)' }}>
                  <L en="Organization not yet recorded" ar="لم تُسجَّل المؤسسة بعد" />
                </div>
              ) : null}
            </div>
          ) : null}
          <LangToggle />
          {account ? (
            <HeaderMenus
              displayName={account.displayName}
              initials={account.initials}
              organizationNameEn={organization?.nameEn ?? null}
              organizationNameAr={organization?.nameAr ?? null}
              unreadCount={unreadCount}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
