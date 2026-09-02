/**
 * The Ministry console's chrome: the government band, the console header naming
 * the signed-in role, and the content column. Navigation is the dashboard's
 * counters and its quiet link row -- the sequence footers left in the second
 * simplification sweep, and the prototype's tab strip is a reviewer's index
 * and is not built.
 */

import Link from 'next/link';
import { GovernmentBand } from './Header';
import { LangToggle, SignOutButton } from './HeaderMenus';
import { L } from './L';
import type { Account } from '../lib/auth';
import { MINISTRY_CONTENT, bilingualMap } from '../lib/rules';

export function MinistryShell({
  account,
  children,
  consoleEn = 'Review console',
  consoleAr = 'لوحة المراجعة',
  back,
}: {
  account: Account;
  children: React.ReactNode;
  consoleEn?: string;
  consoleAr?: string;
  /** Back pill named after its destination; absent only on the console's own dashboard. */
  back?: { href: string; en: string; ar: string };
}) {
  const roleLabel = bilingualMap(MINISTRY_CONTENT.roleLabels)[account.role] ?? {
    en: account.role,
    ar: account.role,
  };
  return (
    <>
      <GovernmentBand />
      <header data-noprint="" style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--bg)', borderBlockEnd: '1px solid var(--line)' }}>
        <div data-pad="" style={{ maxWidth: 1320, marginInline: 'auto', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/ministry" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
            <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--brand)', display: 'grid', placeItems: 'center' }}>
              <span style={{ width: 13, height: 13, background: 'var(--brand)', clipPath: 'polygon(43% 0,57% 0,57% 43%,100% 43%,100% 57%,57% 57%,57% 100%,43% 100%,43% 57%,0 57%,0 43%,43% 43%)' }} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>
                <L en="Event Health Readiness" ar="التأهب الصحي للفعاليات" />
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                <L en={consoleEn} ar={consoleAr} />
              </span>
            </span>
          </Link>
          {back ? (
            <Link
              href={back.href}
              style={{ height: 34, paddingInline: 14, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 17, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', color: 'var(--ink)' }}
            >
              <svg aria-hidden="true" data-flip="" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
              <L en={back.en} ar={back.ar} />
            </Link>
          ) : null}
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'end', lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{account.displayName}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                <L en={roleLabel.en} ar={roleLabel.ar} />
              </div>
            </div>
            <LangToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main data-pad="" style={{ maxWidth: 1320, marginInline: 'auto', padding: '32px 32px 90px' }}>
        {children}
      </main>
    </>
  );
}

