/**
 * THE EVENT, THE WAY A NOMINATED PARTY READS IT — compact facts first, everything
 * else behind View more (partner ruling, counterparty pass 2026-09-02: "Event details
 * at the top, compact, with View more for the rest. Name, date, venue, expected
 * attendance, level — the five facts they need.").
 *
 * One component serves every counterparty surface: the anonymous token page, the
 * EMS participation and declaration pages, the Director's event page and post-event
 * report. One scope, so what a party is shown cannot drift between the moment they
 * are invited and the working screens they hold afterwards.
 *
 * WHAT IS NOT HERE, deliberately: the submission. Not the assessment answers, not the
 * compliance form, not the other parties' declarations, not a document outside the
 * nominee's own role. Being named in an event is not being named in all of it.
 *
 * The Event Medical Director's IDENTITY is shown to everyone named, because
 * declaration item 7 turns on who the Director is -- an EMS provider asked to sign
 * cannot evaluate the nomination without it.
 *
 * No account is needed to read any of this, and none is needed to answer.
 */

import { L } from '../../../components/L';
import { DocumentViewer } from '../../../components/DocumentViewer';
import {
  ROLES_CONTENT,
  catalogueEntry,
  filingDeadline,
  requirementsForParty,
  type Level,
  bilingualMap,
} from '../../../lib/rules';
import type { NominationBriefing, NomineePlanSlice } from '../../../lib/queries';

const N = ROLES_CONTENT.nomination;

const Panel = ({ children, region }: { children: React.ReactNode; region: string }) => (
  <div data-region={region} style={{ marginBlockEnd: 24 }}>
    {children}
  </div>
);

const Heading = ({ en, ar }: { en: string; ar: string }) => (
  <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
    <L en={en} ar={ar} />
  </h2>
);

const Intro = ({ en, ar }: { en: string; ar: string }) => (
  <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
    <L en={en} ar={ar} />
  </p>
);

export function Briefing({
  briefing,
  token,
  kind,
  level,
  namedEn,
  namedAr,
  confirmed = false,
  plan = null,
}: {
  briefing: NominationBriefing;
  token: string;
  kind: 'ems' | 'director';
  level: Level | null;
  namedEn: string;
  namedAr: string;
  /** True once the nomination is accepted: the plan slice opens then, and only then. */
  confirmed?: boolean;
  /** The plan slice a confirmed party may read; null while the organizer has none. */
  plan?: NomineePlanSlice | null;
}) {
  const unset = { en: N.unsetEn, ar: N.unsetAr };
  const or = (v: string | null): { en: string; ar: string } =>
    v && v.trim() !== '' ? { en: v, ar: v } : unset;

  const dates =
    briefing.startDate && briefing.endDate && briefing.startDate !== briefing.endDate
      ? `${briefing.startDate} — ${briefing.endDate}`
      : briefing.startDate;
  const times =
    briefing.openingTime && briefing.closingTime
      ? `${briefing.openingTime} — ${briefing.closingTime}`
      : briefing.openingTime;

  // The five facts a counterparty needs, in one compact strip. Everything else
  // lives behind View more.
  const compact: { key: string; value: { en: string; ar: string } }[] = [
    { key: 'dates', value: or(dates) },
    { key: 'venue', value: or(briefing.venueRoute) },
    {
      key: 'expected',
      value:
        briefing.expectedAttendance !== null
          ? { en: `${briefing.expectedAttendance.toLocaleString('en-US')} expected`, ar: `${briefing.expectedAttendance.toLocaleString('en-US')} متوقعاً` }
          : { en: `${N.labels.expected.en}: ${N.unsetEn}`, ar: `${N.labels.expected.ar}: ${N.unsetAr}` },
    },
  ];

  const moreFacts: { key: string; label: { en: string; ar: string }; value: { en: string; ar: string } }[] = [
    { key: 'organizer', label: N.labels.organizer, value: { en: briefing.organizationNameEn || N.unsetEn, ar: briefing.organizationNameAr || N.unsetAr } },
    { key: 'eventType', label: N.labels.eventType, value: or(briefing.eventType) },
    { key: 'times', label: N.labels.times, value: or(times) },
    { key: 'municipality', label: N.labels.municipality, value: or(briefing.municipalities) },
    { key: 'namedAs', label: N.labels.namedAs, value: { en: namedEn, ar: namedAr } },
  ];

  // The party's OWN requirement rows, derived from the matrix rather than described in
  // prose somebody has to keep in step. At Level 3 the Director carries five and
  // requirement 15 names no other party at any level.
  const partyKey = kind === 'ems' ? 'E' : 'D';
  const rows = level ? requirementsForParty(level, partyKey) : [];

  const deadline =
    briefing.startDate !== null && level !== null
      ? filingDeadline(level, new Date(`${briefing.startDate}T00:00:00Z`))
      : null;

  return (
    <div data-region="briefing" style={{ marginBlockEnd: 28 }}>
      {/* THE COMPACT STRIP: name, date, venue, expected attendance, level. */}
      <div data-region="briefing-event" style={{ marginBlockEnd: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline', marginBlockEnd: 6 }}>
          <h2 style={{ margin: 0, fontSize: 27, fontWeight: 600, letterSpacing: '-.025em' }}>
            <L en={briefing.eventNameEn} ar={briefing.eventNameAr} />
          </h2>
          <span style={{ flex: 'none', padding: '3px 11px', borderRadius: 999, background: level ? `var(--l${level}s)` : 'var(--surface2)', borderInlineStart: level ? `2px solid var(--l${level})` : undefined, fontSize: '13.5px', fontWeight: 500 }}>
            {level ? <L en={`Level ${level}`} ar={`المستوى ${level}`} /> : <L en={N.unsetEn} ar={N.unsetAr} />}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, rowGap: 4, fontSize: '14.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          {compact.map((f, i) => (
            <span key={f.key} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <L en={f.value.en} ar={f.value.ar} />
            </span>
          ))}
        </div>
      </div>

      {/* EVERYTHING ELSE, one expander: the rest of the facts, the organizer's
          deadline, the party's own requirement rows, who else is named, the
          documents that concern the role, and (once confirmed) the plan slice. */}
      <details data-region="briefing-more">
        <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center', height: 34, paddingInline: 14, border: '1px solid var(--line)', borderRadius: 17, fontSize: '13.5px', color: 'var(--brand)' }}>
          <L en="View more" ar="عرض المزيد" />
        </summary>
        <div style={{ marginBlockStart: 20 }}>
          <Panel region="briefing-facts">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {moreFacts.map((f) => (
                <div key={f.key} style={{ background: 'var(--bg)', padding: '15px 17px' }}>
                  <div style={{ fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 6 }}>
                    <L en={f.label.en} ar={f.label.ar} />
                  </div>
                  <div style={{ fontSize: '15.5px', fontWeight: 500, lineHeight: 1.4 }}>
                    <L en={f.value.en} ar={f.value.ar} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* THE ORGANIZER'S DEADLINE, because it is the nominee's deadline in practice:
              an answer after it is an answer to a package already filed. */}
          <Panel region="briefing-deadline">
            <Heading en={N.deadlineTitleEn} ar={N.deadlineTitleAr} />
            <div style={{ padding: '16px 20px', background: 'var(--surface2)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.65, maxWidth: '78ch' }}>
              {deadline === null ? (
                <L en={N.deadlineUnknownEn} ar={N.deadlineUnknownAr} />
              ) : briefing.filed ? (
                <L en={N.deadlineFiledEn} ar={N.deadlineFiledAr} />
              ) : (
                <>
                  <div style={{ fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginBlockEnd: 6 }}>
                    {deadline.date}
                  </div>
                  <L en={N.deadlineBodyEn} ar={N.deadlineBodyAr} />
                  {deadline.conditional && deadline.conditionEn ? (
                    <div style={{ marginBlockStart: 8, fontSize: '13px', color: 'var(--muted)' }}>
                      <L en={deadline.conditionEn} ar={deadline.conditionAr ?? deadline.conditionEn} />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Panel>

          <Panel region="briefing-requirements">
            <Heading en={N.requirementsTitleEn} ar={N.requirementsTitleAr} />
            <Intro en={N.requirementsIntroEn} ar={N.requirementsIntroAr} />
            {rows.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en={N.requirementsNoneEn} ar={N.requirementsNoneAr} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {rows.map((r) => (
                  <div key={r.n} style={{ background: 'var(--bg)', padding: '14px 18px', borderInlineStart: `3px solid ${r.sole ? 'var(--accent)' : 'var(--brand)'}` }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                        <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{r.n}</span>
                        <span style={{ fontSize: '14.5px', lineHeight: 1.45 }}>
                          <L en={r.en} ar={r.ar} />
                        </span>
                      </span>
                      <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: r.sole ? 'var(--accent-soft)' : 'var(--brand-soft)', color: r.sole ? 'var(--accent-ink)' : 'var(--brand)', fontSize: 12 }}>
                        <L en={r.sole ? N.soleEn : N.sharedEn} ar={r.sole ? N.soleAr : N.sharedAr} />
                      </span>
                    </div>
                    <div style={{ marginBlockStart: 6, marginInlineStart: 32, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '76ch' }}>
                      <L en={r.valueEn} ar={r.valueAr} />
                    </div>
                    {r.sole ? (
                      <div style={{ marginBlockStart: 6, marginInlineStart: 32, fontSize: '12.5px', color: 'var(--accent-ink)', lineHeight: 1.6, maxWidth: '76ch' }}>
                        <L en={ROLES_CONTENT.director.soleNote.en} ar={ROLES_CONTENT.director.soleNote.ar} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel region="briefing-parties">
            <Heading en={N.partiesTitleEn} ar={N.partiesTitleAr} />
            <Intro en={N.partiesIntroEn} ar={N.partiesIntroAr} />
            {briefing.otherParties.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en={N.partiesNoneEn} ar={N.partiesNoneAr} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {briefing.otherParties.map((p, i) => {
                  const state = bilingualMap(N.partyStates)[p.status];
                  const kindLabel = bilingualMap(N.kinds)[p.kind];
                  return (
                    <div key={`${p.kind}-${i}`} style={{ background: 'var(--bg)', padding: '13px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '14px', flex: 1, minWidth: 220 }}>
                        <L en={p.nameEn} ar={p.nameAr} />
                        {/* The parentheses live INSIDE the bilingual pair. Outside them,
                            the two languages share one set and the DOM reads "(youأنتم)"
                            -- which renders correctly but is one string in two languages,
                            which is exactly what <L> exists to prevent. */}
                        {p.isThisOne ? (
                          <span style={{ color: 'var(--muted)' }}>
                            {' '}
                            <L en={N.youEn} ar={N.youAr} />
                          </span>
                        ) : null}
                        <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted)', marginBlockStart: 3 }}>
                          <L en={kindLabel?.en ?? p.kind} ar={kindLabel?.ar ?? p.kind} />
                        </span>
                      </span>
                      <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: 'var(--surface2)', color: 'var(--muted)', fontSize: 12 }}>
                        <L en={state?.en ?? p.status} ar={state?.ar ?? p.status} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel region="briefing-documents">
            <Heading en={N.documentsTitleEn} ar={N.documentsTitleAr} />
            <Intro en={N.documentsIntroEn} ar={N.documentsIntroAr} />
            {briefing.documents.length === 0 ? (
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)' }}>
                <L en={N.documentsNoneEn} ar={N.documentsNoneAr} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {briefing.documents.map((d) => {
                  const doc = catalogueEntry(d.docKey);
                  return (
                    <div key={d.docKey} style={{ background: 'var(--bg)', padding: '13px 18px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '14px' }}>{doc ? <L en={doc.en} ar={doc.ar} /> : d.docKey}</span>
                        <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {d.fileName} · {d.attachedAt}
                        </span>
                      </div>
                      <DocumentViewer
                        href={`/api/nomination-documents/${token}/${encodeURIComponent(d.docKey)}`}
                        hasFile={d.hasFile}
                        contentType={d.contentType}
                        label={doc ? doc.en : d.docKey}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* THE PLAN SLICE a confirmed party may read: the four sections fixed in
              lib/rules/nomination-access, with the version it is read at. A standing
              view that changes silently is worse than none. Before acceptance the
              section is absent entirely -- the arrangements inside the organizer's
              plan are for parties that said yes. */}
          {confirmed && plan === null ? (
            <div data-region="plan-slice" style={{ marginBlockEnd: 4 }}>
              <Heading en={N.planTitleEn} ar={N.planTitleAr} />
              <div style={{ padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
                <L en={N.planNoneEn} ar={N.planNoneAr} />
              </div>
            </div>
          ) : null}
          {confirmed && plan !== null ? (
            <div data-region="plan-slice" style={{ marginBlockEnd: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 8px' }}>
                <Heading en={N.planTitleEn} ar={N.planTitleAr} />
                <span data-region="plan-version" style={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <L
                    en={N.planVersionEn.replace('{v}', String(plan.version)).replace('{d}', plan.updatedAt)}
                    ar={N.planVersionAr.replace('{v}', String(plan.version)).replace('{d}', plan.updatedAt)}
                  />
                </span>
              </div>
              <Intro en={N.planIntroEn} ar={N.planIntroAr} />
              {plan.mode === 'attach' ? (
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, marginBlockEnd: 12, fontSize: '13px', lineHeight: 1.65, maxWidth: '78ch' }}>
                  <L en={N.planAttachedEn} ar={N.planAttachedAr} />
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {plan.sections.map((sec) => (
                  <div key={sec.n} style={{ background: 'var(--bg)', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 220 }}>
                        <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{sec.n}</span>
                        <span style={{ fontSize: '14.5px', lineHeight: 1.45 }}>
                          <L en={sec.en} ar={sec.ar} />
                        </span>
                      </span>
                      {plan.mode === 'attach' ? (
                        <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: sec.covered ? 'var(--brand-soft)' : 'var(--bad-soft)', color: sec.covered ? 'var(--brand)' : 'var(--bad)', fontSize: 12 }}>
                          <L en={sec.covered ? N.coveredEn : N.notCoveredEn} ar={sec.covered ? N.coveredAr : N.notCoveredAr} />
                        </span>
                      ) : null}
                    </div>
                    {plan.mode === 'write' ? (
                      <div style={{ marginBlockStart: 8, marginInlineStart: 32, fontSize: '13.5px', lineHeight: 1.7, maxWidth: '78ch', whiteSpace: 'pre-wrap', color: sec.text === '' ? 'var(--muted)' : 'var(--ink)' }}>
                        {sec.text === '' ? <L en={N.planSectionEmptyEn} ar={N.planSectionEmptyAr} /> : sec.text}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
