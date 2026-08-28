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
    <PublicShell signedIn={account !== null}>
      {/* HERO — one sentence saying what this is, and the two tools that need no account. */}
      <h1 data-sec-h1="" data-region="hero" style={{ margin: '8px 0 16px', fontSize: 40, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1.2, maxWidth: '20ch' }}>
        <L en="National Health and Medical Readiness" ar="الجاهزية الصحية والطبية الوطنية" />
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 19, lineHeight: 1.6, color: 'var(--muted)', maxWidth: '62ch' }}>
        <L en={P.heroEn} ar={P.heroAr} />
      </p>

      {/* THE HERO FIELD. Most people arrive with a question rather than a
          destination, and the four chips are the questions they actually arrive with. */}
      <form method="get" action="/search" data-region="hero-search" style={{ maxWidth: 620, marginBlockEnd: 12 }}>
        <input
          name="q"
          aria-label="Search"
          placeholder={P.searchPlaceholderEn}
          style={{ height: 52, paddingInline: 18, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 26, fontSize: 16, inlineSize: '100%' }}
        />
      </form>
      <div data-region="hero-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockEnd: 40 }}>
        {P.chips.map((c) => (
          <Link
            key={c.q}
            href={`/search?q=${encodeURIComponent(c.q)}`}
            style={{ paddingBlock: 7, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 999, fontSize: '13px', color: 'var(--muted)' }}
          >
            <L en={c.en} ar={c.ar} />
          </Link>
        ))}
      </div>

      {/* SERVICES — the three regulated processes, as the primary route in. */}
      <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en="Services" ar="الخدمات" />
      </h2>
      <p style={{ margin: '0 0 6px', fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
        <L en={P.servicesIntroEn} ar={P.servicesIntroAr} />
      </p>
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', margin: '24px 0 4px' }}>
        <L en={P.regulatedEn} ar={P.regulatedAr} />
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)' }}>
        <L en={P.regulatedNoteEn} ar={P.regulatedNoteAr} />
      </p>
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

      {/* WHERE THE TWO INSTRUMENTS MEET — the stadium case, stated as ordinary. */}
      <div data-region="both-instruments" style={{ padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 40, maxWidth: '84ch' }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
          <L en={P.meetEn} ar={P.meetAr} />
        </div>
        <p style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.65 }}>
          <L en={P.meetBodyEn} ar={P.meetBodyAr} />
        </p>
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

      {/* HOW A LEVEL IS DETERMINED — scoped, and ending with what facilities do instead. */}
      <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>
        <L en={P.levelTitleEn} ar={P.levelTitleAr} />
      </h2>
      <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: '12.5px', marginBlockEnd: 12 }}>
        <L en={P.levelScopeEn} ar={P.levelScopeAr} />
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '15.5px', lineHeight: 1.65, maxWidth: '80ch' }}>
        <L en={P.levelBodyEn} ar={P.levelBodyAr} />
      </p>
      <div data-region="level-bands" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBlockEnd: 12 }}>
        {[
          { n: 1, en: 'Score 0 to 5', ar: 'النتيجة من 0 إلى 5' },
          { n: 2, en: 'Score 6 to 11', ar: 'النتيجة من 6 إلى 11' },
          { n: 3, en: 'Score 12 to 18', ar: 'النتيجة من 12 إلى 18' },
        ].map((b) => (
          <div key={b.n} style={{ padding: '16px 18px', background: 'var(--surface2)', borderRadius: 12, borderInlineStart: `3px solid var(--l${b.n})` }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: `var(--l${b.n})` }}>
              <L en={`Level ${b.n}`} ar={`المستوى ${b.n}`} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBlockStart: 3, fontVariantNumeric: 'tabular-nums' }}>
              <L en={b.en} ar={b.ar} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 44px', fontSize: '13.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '80ch' }}>
        <L en={P.levelFacilityNoteEn} ar={P.levelFacilityNoteAr} />
      </p>
    </PublicShell>
  );
}
