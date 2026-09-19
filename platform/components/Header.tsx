import Link from 'next/link';
import { L } from './L';
import { landingRouteFor } from '../lib/rules';
import { HeaderMenus, LangToggle } from './HeaderMenus';
import type { Account, Organization } from '../lib/auth';

export function GovernmentBand() {
  return <div className="government-band"><div data-pad="">
    <L en="An official service of the Republic of Lebanon" ar="خدمة رسمية من الجمهورية اللبنانية" />
  </div></div>;
}

export function Header({ account, organization, unreadCount, showBack, back,
  subtitle = { en: 'Event Health Readiness', ar: 'التأهب الصحي للفعاليات' }, wide = false,
}: {
  account: Account | null;
  organization: Organization | null;
  unreadCount: number;
  showBack: boolean;
  back?: { href: string; en: string; ar: string };
  subtitle?: { en: string; ar: string };
  wide?: boolean;
}) {
  const home = account ? landingRouteFor(account.role) : '/';
  return <header data-noprint="" className="app-header" data-wide-header={wide || undefined}>
    <div className="app-header-row" data-pad="">
      <Link href={home} className="ministry-mark">
        <span className="ministry-symbol" aria-hidden="true">+</span>
        <span className="ministry-wordmark">
          <strong><L en="Ministry of Public Health" ar="وزارة الصحة العامة" /></strong>
          <span className="ministry-subtitle"><L en={subtitle.en} ar={subtitle.ar} /></span>
        </span>
      </Link>
      <div className="header-controls">
        <LangToggle />
        {account ? <HeaderMenus displayName={account.displayName} initials={account.initials}
          organizationNameEn={organization?.nameEn ?? null} organizationNameAr={organization?.nameAr ?? null}
          organizationStatus={organization?.status} unreadCount={unreadCount} role={account.role} /> : null}
      </div>
    </div>
    {showBack ? <nav className="header-breadcrumb" data-pad="" aria-label="Breadcrumb">
      <Link href={back?.href ?? home}>
        <svg aria-hidden="true" data-flip="" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        <L en={back?.en ?? (account ? 'Dashboard' : 'Overview')} ar={back?.ar ?? (account ? 'اللوحة' : 'نظرة عامة')} />
      </Link>
    </nav> : null}
  </header>;
}
