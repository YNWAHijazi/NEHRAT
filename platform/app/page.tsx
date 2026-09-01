import Link from 'next/link';
import { L } from '../components/L';
import { PublicShell } from '../components/PublicShell';
import { currentAccount } from '../lib/auth';
import { PUBLIC_LANDING } from '../lib/rules';

/**
 * THE OVERVIEW — Slice 0, screen 1, and the surface most people will ever see.
 *
 * It did not exist. `/` redirected to sign-in when signed out and to the dashboard
 * when signed in, so the first thing the platform said to a member of the public was
 * "prove who you are" — before telling them what it was for, whether it applied to
 * them, or that using the public tools creates no obligation.
 *
 * A signed-in visitor still gets this page. The overview is the front door, not a
 * consolation for people without accounts, and an organizer who wants to read what
 * registering a facility involves should not have to sign out to do it.
 */
export default async function OverviewPage() {
  const account = await currentAccount();
  const P = PUBLIC_LANDING;
  const routeOf: Record<string, string> = {
    certify: '/services/certify-an-event',
    venue: '/services/register-a-venue',
    facility: '/services/register-a-facility',
  };

  return (
    <PublicShell
      signedIn={account !== null}
      hero={
        <>
          <h1
            data-sec-h1=""
            data-region="hero"
            style={{ margin: '0 0 16px', fontSize: 'clamp(2.1rem, 5vw, 3.1rem)', fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1.15, maxWidth: '18ch', color: 'var(--hero-ink)', textWrap: 'balance' }}
          >
            <L en="National Health and Medical Readiness" ar="الجاهزية الصحية والطبية الوطنية" />
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 19, lineHeight: 1.6, color: 'var(--hero-muted)', maxWidth: '58ch' }}>
            <L en={P.heroEn} ar={P.heroAr} />
          </p>

          {/* The field is dark inside the band -- a white input here would be a hole
              punched in the ground rather than a control sitting on it. */}
          <form method="get" action="/search" data-region="hero-search" style={{ maxWidth: 620, marginBlockEnd: 14 }}>
            <input
              name="q"
              aria-label="Search"
              placeholder={P.searchPlaceholderEn}
              style={{
                height: 54,
                paddingInline: 20,
                inlineSize: '100%',
                background: 'var(--hero-field)',
                border: '1px solid var(--hero-line)',
                borderRadius: 27,
                fontSize: 16,
                color: 'var(--hero-ink)',
              }}
            />
          </form>

          {/* ONE CHIP PER KIND OF RESULT, from the prototype: a service, a piece of
              guidance, a real reference number so the lookup path is discoverable, and
              a term that matches nothing so the no-results state is reachable. Four
              questions would all have resolved to guidance and left two states
              unreachable from the front page. */}
          <div data-region="hero-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {P.chips.map((c) => (
              <Link
                key={c.q}
                href={`/search?q=${encodeURIComponent(c.q)}`}
                style={{ paddingBlock: 7, paddingInline: 15, border: '1px solid var(--hero-line)', borderRadius: 999, fontSize: '13px', color: 'var(--hero-muted)' }}
              >
                <L en={c.en} ar={c.ar} />
              </Link>
            ))}
          </div>
        </>
      }
    >
      {/* SERVICES — the three regulated processes, as the primary route in. */}
      <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Services" ar="الخدمات" />
      </h2>
      <div data-region="services" data-wide="" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBlockEnd: 40 }}>
        {P.services.map((s) => (
          <Link
            key={s.k}
            href={routeOf[s.k] ?? '/'}
            style={{ display: 'block', padding: '26px 28px', background: 'var(--surface2)', borderRadius: 16, color: 'var(--ink)' }}
          >
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.35, marginBlockEnd: 8 }}>
              <L en={s.en} ar={s.ar} />
            </div>
            <div style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
              <L en={s.descEn} ar={s.descAr} />
            </div>
            <div style={{ marginBlockStart: 14, fontSize: '13.5px', color: 'var(--brand)' }}>
              <L en="Read the service detail" ar="قراءة تفاصيل الخدمة" />
            </div>
          </Link>
        ))}
      </div>

      {/* PUBLIC TOOLS — visually subordinate, and each says no account, no obligation. */}
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 4 }}>
        <L en={P.toolsEn} ar={P.toolsAr} />
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)' }}>
        <L en={P.toolsNoteEn} ar={P.toolsNoteAr} />
      </p>
      <div data-region="public-tools" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBlockEnd: 44 }}>
        <Link href="/applicability" style={{ padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            <L en="Determination of applicability" ar="البت في الانطباق" />
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 5, lineHeight: 1.55 }}>
            <L
              en="Check whether an event, a venue or a place you operate is covered."
              ar="تحققوا مما إذا كانت فعالية أو موقع أو مكان تديرونه مشمولاً."
            />
          </div>
        </Link>
        <Link href="/lookup" style={{ padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            <L en="Verify a reference number" ar="التحقق من رقم مرجعي" />
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 5, lineHeight: 1.55 }}>
            <L
              en="Confirm that a Ministry reference exists and what it says."
              ar="تأكدوا من وجود رقم مرجعي لدى الوزارة وممّا يفيده."
            />
          </div>
        </Link>
      </div>

    </PublicShell>
  );
}
