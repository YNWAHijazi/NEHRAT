import Link from 'next/link';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import { PUBLIC_LANDING, looksLikeReference, searchGuidance, searchServices } from '../../lib/rules';

/**
 * SEARCH — Slice 0, screen 6. One field, three kinds of answer.
 *
 * A person arriving at a regulator's site usually has a question rather than a
 * destination, and the three kinds of answer are genuinely different: a SERVICE they
 * can start, a REQUIREMENT OR PIECE OF GUIDANCE that settles the question, or — if what
 * they typed is a Ministry reference number — the register itself.
 *
 * THE REFERENCE BRANCH DIVERGES FROM THE PROTOTYPE, deliberately and on two counts.
 * The prototype answers a pasted reference immediately and shows five facts including
 * the date the status was recorded. This build shows FOUR (non-negotiable 5) and asks
 * for the event's start date first (non-negotiable 5b) — a reference alone, answered
 * instantly, is a register anyone can walk by counting upwards. So a reference here
 * hands the question to the lookup screen with the number already filled in, rather
 * than answering it in place.
 *
 * Matching is bilingual, so the same search works in Arabic. Nothing is stored: the
 * query is in the URL and the page reads no account.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const account = await currentAccount();
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const P = PUBLIC_LANDING;

  const isReference = looksLikeReference(query);
  const services = isReference || query === '' ? [] : searchServices(query);
  const guidance = isReference || query === '' ? [] : searchGuidance(query);
  const total = services.length + guidance.length;
  const nothing = query !== '' && !isReference && total === 0;

  const field: React.CSSProperties = {
    height: 52,
    paddingInline: 18,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 26,
    fontSize: 16,
    inlineSize: '100%',
  };
  const listBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden',
  };

  const hits = (items: typeof services, titleEn: string, titleAr: string, region: string) =>
    items.length === 0 ? null : (
      <div data-region={region} style={{ marginBlockEnd: 28 }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 10 }}>
          <L en={titleEn} ar={titleAr} />
        </div>
        <div style={listBox}>
          {items.map((h) => (
            <Link key={h.en} href={h.route} style={{ background: 'var(--bg)', padding: '15px 18px', color: 'var(--ink)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '15.5px', lineHeight: 1.5, flex: 1, minWidth: 220 }}>
                <L en={h.en} ar={h.ar} />
              </span>
              <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)' }}>
                <L en={h.kindEn} ar={h.kindAr} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    );

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Overview" ar="نظرة عامة" />
      </Link>
      <h1 data-sec-h1="" style={{ margin: '10px 0 18px', fontSize: 32, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en={P.searchTitleEn} ar={P.searchTitleAr} />
      </h1>

      <form method="get" data-region="search-form" style={{ maxWidth: 640, marginBlockEnd: 16 }}>
        <input
          name="q"
          defaultValue={query}
          aria-label="Search"
          placeholder={P.searchPlaceholderEn}
          style={field}
        />
      </form>

      {/* The suggestion chips: the four questions people actually arrive with. */}
      <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
        <L en={P.frequentEn} ar={P.frequentAr} />
      </div>
      <div data-region="search-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockEnd: 32 }}>
        {P.chips.map((c) => (
          <Link
            key={c.q}
            href={`/search?q=${encodeURIComponent(c.q)}`}
            style={{ paddingBlock: 8, paddingInline: 15, border: '1px solid var(--line)', borderRadius: 999, fontSize: '13.5px', color: 'var(--ink)' }}
          >
            <L en={c.en} ar={c.ar} />
          </Link>
        ))}
      </div>

      {query !== '' ? (
        <div data-region="search-count" style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 16 }}>
          {isReference ? (
            <L en={P.referenceResultEn} ar={P.referenceResultAr} />
          ) : (
            <L
              en={total === 0 ? `No results for “${query}”` : `${total} result${total === 1 ? '' : 's'} for “${query}”`}
              ar={total === 0 ? `لا نتائج لـ «${query}»` : `⁦${total}⁩ نتيجة لـ «${query}»`}
            />
          )}
        </div>
      ) : null}

      {/* A REFERENCE NUMBER goes to the lookup, which asks for the second factor and
          discloses four fields. It is not answered here. */}
      {isReference ? (
        <div data-region="search-reference" style={{ padding: '24px 26px', border: '2px solid var(--brand)', borderRadius: 14, maxWidth: '76ch' }}>
          <div style={{ fontSize: 19, fontWeight: 600, marginBlockEnd: 8 }}>
            <L en="That is a Ministry reference number" ar="هذا رقم مرجعي لدى الوزارة" />
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '14.5px', lineHeight: 1.7 }}>
            <L
              en="Verifying it needs the event's start date as well. Somebody holding a genuine reference knows it, and asking for it is what stops the register being read by counting upwards."
              ar="يستلزم التحقق منه تاريخ بدء الفعالية أيضاً. فمن يحمل رقماً حقيقياً يعرفه، وطلبه هو ما يمنع قراءة السجل بالعد التصاعدي."
            />
          </p>
          <Link
            href={`/lookup?reference=${encodeURIComponent(query.toUpperCase())}`}
            style={{ display: 'inline-flex', alignItems: 'center', height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500 }}
          >
            <L en="Continue to the lookup" ar="المتابعة إلى التحقق" />
          </Link>
        </div>
      ) : null}

      {hits(services, P.servicesResultEn, P.servicesResultAr, 'search-services')}
      {hits(guidance, P.guidanceResultEn, P.guidanceResultAr, 'search-guidance')}

      {/* NOTHING MATCHED is not a dead end: two routes out, and both are real. */}
      {nothing ? (
        <div data-region="search-no-results" style={{ padding: '24px 26px', border: '1px solid var(--line)', borderRadius: 14, maxWidth: '80ch' }}>
          <div style={{ fontSize: 19, fontWeight: 600, marginBlockEnd: 8 }}>
            <L en={P.noResultsEn} ar={P.noResultsAr} />
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '14.5px', lineHeight: 1.7 }}>
            <L en={P.noResultsBodyEn} ar={P.noResultsBodyAr} />
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/applicability" style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', borderRadius: 21, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
              <L en="Check whether the rules apply" ar="التحقق من انطباق القواعد" />
            </Link>
            <Link href="/contact" style={{ height: 42, paddingInline: 20, border: '1px solid var(--line)', borderRadius: 21, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }}>
              <L en={P.contactEn} ar={P.contactAr} />
            </Link>
          </div>
        </div>
      ) : null}
    </PublicShell>
  );
}
