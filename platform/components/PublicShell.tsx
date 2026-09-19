import { InfoNote } from './InfoNote';
import Link from 'next/link';
import { GovernmentBand } from './Header';
import { L } from './L';
import { LangToggle } from './HeaderMenus';
import { PUBLIC_LANDING } from '../lib/rules';

/**
 * The chrome every public screen shares. Signed out: no account menu, no notification
 * bell, no dashboard — a person here may not have an account and is not being asked
 * to make one to read what the platform is for.
 *
 * Sign in is offered, never demanded. That is the difference between a public service
 * and a portal, and it is the whole reason Slice 0 exists: `/` used to redirect to
 * sign-in, so the first thing the platform said to the public was "prove who you are".
 */
export function PublicShell({
  children,
  signedIn,
  hero,
}: {
  children: React.ReactNode;
  /** Someone already signed in gets a way back to their own work, not a second sign-in. */
  signedIn: boolean;
  /**
   * THE DARK BAND, on the screens that have one.
   *
   * It runs full width from under the header to below the suggestion chips, and it is
   * the page's one dark ground. Without it the overview renders entirely on white and
   * reads as a document rather than a service: the contrast is the reason the white
   * below it works at all. It carries its own token block (--hero-*) because its text
   * sits on a dark ground in BOTH themes and cannot take the page's ink colour.
   */
  hero?: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <GovernmentBand />
      <header className="app-header">
        <div className="app-header-row" data-pad="">
          <Link href="/" className="ministry-mark">
            <span className="ministry-symbol" aria-hidden="true">+</span>
            <span className="ministry-wordmark">
              <strong><L en="Ministry of Public Health" ar="وزارة الصحة العامة" /></strong>
              <span className="ministry-subtitle"><L en="National Health and Medical Readiness" ar="الجاهزية الصحية والطبية الوطنية" /></span>
            </span>
          </Link>
          <div className="header-controls">
            <LangToggle />
            <Link href={signedIn ? '/dashboard' : '/signin'} className="public-signin">
              {signedIn ? <L en="Your dashboard" ar="لوحتكم" /> : <L en="Sign in" ar="تسجيل الدخول" />}
            </Link>
          </div>
        </div>
      </header>

      {hero ? (
        <div
          data-region="hero-band"
          style={{
            background: 'var(--hero-bg)',
            color: 'var(--hero-ink)',
            borderBlockEnd: '1px solid var(--hero-line)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* A glow at the top-start corner and a faint grid. Texture, not structure --
              both are decoration and neither carries meaning, so both are safe to lose
              on a printer or a reduced-transparency setting. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(60rem 32rem at 12% -10%, var(--hero-glow), transparent 62%)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(var(--hero-line2) 1px, transparent 1px), linear-gradient(90deg, var(--hero-line2) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              pointerEvents: 'none',
            }}
          />
          <div
            data-pad=""
            style={{ position: 'relative', maxWidth: 1160, marginInline: 'auto', padding: '56px 32px 48px' }}
          >
            {hero}
          </div>
        </div>
      ) : null}

      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: hero ? '44px 32px 0' : '44px 32px 0' }}>
        {children}
      </main>

      {/* THE JURISDICTION NOTICE, on every public screen. What the platform records and
          what it does not do is the first thing a person needs and the easiest thing to
          assume wrongly. */}
      <footer
        data-region="jurisdiction"
        style={{ marginBlockStart: 64, borderBlockStart: '1px solid var(--line)', background: 'var(--surface2)' }}
      >
        <div data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '32px 32px 56px' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            <L en="About this service" ar="حول هذه الخدمة" /> <InfoNote>
              <L en={PUBLIC_LANDING.scopeEn} ar={PUBLIC_LANDING.scopeAr} />{' '}
              <L en={PUBLIC_LANDING.jurisdictionEn} ar={PUBLIC_LANDING.jurisdictionAr} />
            </InfoNote>
          </div>
          <div style={{ marginBlockStart: 20, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '13px' }}>
            <Link href="/applicability" style={{ color: 'var(--brand)' }}>
              <L en="Check whether the rules apply" ar="التحقق من انطباق القواعد" />
            </Link>
            <Link href="/lookup" style={{ color: 'var(--brand)' }}>
              <L en="Verify a reference number" ar="التحقق من رقم مرجعي" />
            </Link>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            <L en="Fee: None." ar="الرسم: لا يوجد." />
          </p>
        </div>
      </footer>
    </>
  );
}
