import Link from 'next/link';
import { L } from '../../components/L';
import { PublicShell } from '../../components/PublicShell';
import { currentAccount } from '../../lib/auth';
import {
  FACILITY_RULE_CHIPS,
  PUBLIC_LANDING,
  eventApplicability,
  facilityApplicability,
  venueApplicability,
  type FacilityRuleState,
} from '../../lib/rules';

/**
 * DETERMINATION OF APPLICABILITY — Slice 0, screen 3, and the branching check.
 *
 * Asks first WHAT YOU ARE ASKING ABOUT, because the three subjects have three
 * different tests and a single combined form would ask everyone everything.
 *
 * THE FACILITY BRANCH NEVER RETURNS A BARE YES OR NO. It returns the applicable rule
 * and its basis under a state chip, because for three of the six categories the honest
 * answer is that the Ministry has not set a value. "No" would be wrong and "yes" would
 * promise a requirement that does not exist yet. Where a value is missing, a second
 * panel NAMES it and says that this is the answer, not a gap in it (non-negotiable 3).
 *
 * NO ACCOUNT, NO DATABASE, NO RECORD. Everything is in the URL, so an answer can be
 * shared and re-read, and nothing a person tries here is stored against them. The
 * screens say so in those words: using this creates no obligation.
 *
 * "What is not routinely subject" renders ONLY in the event branch, per ROADMAP 1.
 */
export default async function ApplicabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; c?: string | string[]; hosts?: string; cap?: string; cat?: string }>;
}) {
  const account = await currentAccount();
  const q = await searchParams;
  const P = PUBLIC_LANDING;
  const subject = q.subject === 'event' || q.subject === 'venue' || q.subject === 'facility' ? q.subject : null;

  const selected = (Array.isArray(q.c) ? q.c : q.c ? [q.c] : []).map(Number).filter((n) => Number.isInteger(n));
  const answered = q.subject !== undefined && (q.c !== undefined || q.hosts !== undefined || q.cat !== undefined);

  // The facility branch has its own answer type -- it carries a missing Ministry value
  // that the other two cannot -- so it is computed separately rather than narrowed out
  // of a union by shape. Branching on the subject is what the screen already does.
  const facilityAnswer =
    subject === 'facility' && q.cat !== undefined ? facilityApplicability(Number(q.cat)) : null;
  const answer =
    subject === 'event' && answered
      ? eventApplicability(selected)
      : subject === 'venue' && answered
        ? venueApplicability(q.hosts === '1', q.cap === '1')
        : facilityAnswer;

  const chip = answer ? FACILITY_RULE_CHIPS[answer.state as FacilityRuleState] : null;
  // Only the facility branch carries a missing value, and only for three of its six
  // categories. Narrowed by shape rather than by cast, so a category that stops
  // waiting on the Ministry simply stops rendering the panel.
  const missing = facilityAnswer;

  const box: React.CSSProperties = { padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 12 };
  const listBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' };

  return (
    <PublicShell signedIn={account !== null}>
      <Link href="/" style={{ fontSize: '13.5px', color: 'var(--brand)' }}>
        <L en="Overview" ar="نظرة عامة" />
      </Link>
      <h1 data-sec-h1="" style={{ margin: '10px 0 10px', fontSize: 34, fontWeight: 600, letterSpacing: '-.03em' }}>
        <L en="Determination of applicability" ar="البت في الانطباق" />
      </h1>
      <p style={{ margin: '0 0 28px', fontSize: '15.5px', lineHeight: 1.65, color: 'var(--muted)', maxWidth: '76ch' }}>
        <L en={P.toolsNoteEn} ar={P.toolsNoteAr} />
      </p>

      {/* WHAT ARE YOU ASKING ABOUT — three subjects, three tests. */}
      <div data-region="subject-choice" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBlockEnd: 32 }}>
        {[
          { k: 'event', en: 'An event', ar: 'فعالية' },
          { k: 'venue', en: 'A venue', ar: 'موقع' },
          { k: 'facility', en: 'A place you operate', ar: 'مكان تديرونه' },
        ].map((o) => (
          <Link
            key={o.k}
            href={`/applicability?subject=${o.k}`}
            style={{ ...box, background: subject === o.k ? 'var(--brand-soft)' : 'var(--bg)', color: subject === o.k ? 'var(--brand)' : 'var(--ink)', fontSize: 16, fontWeight: 500 }}
          >
            <L en={o.en} ar={o.ar} />
          </Link>
        ))}
      </div>

      {/* THE EVENT BRANCH — six criteria, any one of which is enough. */}
      {subject === 'event' ? (
        <form method="get" data-region="event-branch">
          <input type="hidden" name="subject" value="event" />
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="The six criteria" ar="المعايير الستة" />
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
            <L
              en="Any one of these makes the event subject to the Protocol. They are alternatives, not a list to complete."
              ar="يكفي أي واحد منها لإخضاع الفعالية للبروتوكول. فهي بدائل لا قائمة يجب استكمالها."
            />
          </p>
          <div style={listBox}>
            {P.criteria.map((c, i) => (
              <label key={i} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'start', cursor: 'pointer' }}>
                <input type="checkbox" name="c" value={i} defaultChecked={selected.includes(i)} style={{ flex: 'none', width: 18, height: 18, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
                <span style={{ fontSize: '14.5px', lineHeight: 1.6 }}>
                  <L en={c.en} ar={c.ar} />
                </span>
              </label>
            ))}
          </div>
          <button type="submit" style={{ marginBlockStart: 16, height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            <L en="Check" ar="تحقق" />
          </button>
        </form>
      ) : null}

      {/* THE VENUE BRANCH — exactly the two conditions the rule takes. The old form
          showed a third checkbox (the sports scope) under a heading that said "both
          conditions": the input was collected and DISCARDED — venueApplicability()
          takes two arguments — so the screen asked a question the answer to which
          went nowhere. The scope is a note now, not a condition (partner review). */}
      {subject === 'venue' ? (
        <form method="get" data-region="venue-branch">
          <input type="hidden" name="subject" value="venue" />
          <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Both conditions have to be met" ar="يجب استيفاء الشرطين معاً" />
          </h2>
          <div style={listBox}>
            {P.venueConditions.map((c, i) => (
              <label key={c.k} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'start', cursor: 'pointer' }}>
                <input type="checkbox" name={i === 0 ? 'hosts' : 'cap'} value="1" style={{ flex: 'none', width: 18, height: 18, marginBlockStart: 2, accentColor: 'var(--brand)' }} />
                <span style={{ fontSize: '14.5px', lineHeight: 1.6 }}>
                  <L en={c.en} ar={c.ar} />
                </span>
              </label>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en={P.venueScopeNoteEn} ar={P.venueScopeNoteAr} />
          </p>
          <button type="submit" style={{ marginBlockStart: 16, height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            <L en="Check" ar="تحقق" />
          </button>
        </form>
      ) : null}

      {/* THE FACILITY BRANCH — six categories, and never a bare yes or no. */}
      {subject === 'facility' ? (
        <div data-region="facility-branch">
          <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en="Which category does the place fall into" ar="في أي فئة يندرج المكان" />
          </h2>
          <div style={listBox}>
            {P.facilityCategories.map((c, i) => (
              <Link
                key={i}
                href={`/applicability?subject=facility&cat=${i}`}
                style={{ background: Number(q.cat) === i ? 'var(--brand-soft)' : 'var(--bg)', padding: '14px 18px', fontSize: '14.5px', lineHeight: 1.6, color: 'var(--ink)' }}
              >
                <L en={c.en} ar={c.ar} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* THE ANSWER. A rule and its basis under a state chip — never a bare verdict. */}
      {answer ? (
        <div data-region="applicability-answer" style={{ marginBlockStart: 28, padding: '24px 26px', border: '2px solid var(--brand)', borderRadius: 14, maxWidth: '84ch' }}>
          {chip ? (
            <div style={{ display: 'inline-block', padding: '3px 11px', borderRadius: 999, background: answer.state === 'inforce' ? 'var(--brand-soft)' : answer.state === 'unset' ? 'var(--accent-soft)' : 'var(--surface2)', color: answer.state === 'inforce' ? 'var(--brand)' : answer.state === 'unset' ? 'var(--accent-ink)' : 'var(--muted)', fontSize: '12.5px', marginBlockEnd: 12 }}>
              <L en={chip.en} ar={chip.ar} />
            </div>
          ) : null}
          <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.45, marginBlockEnd: 10 }}>
            <L en={answer.en} ar={answer.ar} />
          </div>
          <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.7 }}>
            <L en={answer.bodyEn} ar={answer.bodyAr} />
          </p>
          {answer.route ? (
            <Link href={answer.route} style={{ display: 'inline-flex', alignItems: 'center', height: 40, paddingInline: 18, marginBlockStart: 16, border: '1px solid var(--line)', borderRadius: 20, fontSize: '13.5px', color: 'var(--ink)' }}>
              <L en={answer.routeEn} ar={answer.routeAr} />
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* WAITING ON THE MINISTRY — a first-class result, not an apology. */}
      {missing !== null && missing.missingEn !== null && missing.missingAr !== null ? (
        <div data-region="waiting-on-ministry" style={{ marginBlockStart: 16, padding: '20px 24px', background: 'var(--accent-soft)', borderRadius: 12, maxWidth: '84ch' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginBlockEnd: 8 }}>
            <L en="Waiting on the Ministry" ar="بانتظار الوزارة" />
          </div>
          <div style={{ fontSize: '15.5px', fontWeight: 500, marginBlockEnd: 8 }}>
            <L en={missing.missingEn} ar={missing.missingAr} />
          </div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7 }}>
            <L
              en="This is the answer, not a gap in it. Nothing is in force against this category until the Ministry publishes that value, and operators are told when it does."
              ar="هذا هو الجواب لا نقصٌ فيه. فلا شيء سارٍ على هذه الفئة إلى أن تنشر الوزارة تلك القيمة، ويُبلَّغ المشغّلون عند نشرها."
            />
          </p>
        </div>
      ) : null}

      {/* ONLY IN THE EVENT BRANCH (ROADMAP 1). */}
      {subject === 'event' ? (
        <div data-region="not-routinely-subject" style={{ marginBlockStart: 32, maxWidth: '84ch' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
            <L en="What is not routinely subject" ar="ما هو غير خاضع بصورة اعتيادية" />
          </h2>
          {P.notRoutinelyEn.map((en, i) => (
            <p key={en} style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: 1.7, color: 'var(--muted)' }}>
              <L en={en} ar={P.notRoutinelyAr[i] ?? ''} />
            </p>
          ))}
        </div>
      ) : null}
    </PublicShell>
  );
}
