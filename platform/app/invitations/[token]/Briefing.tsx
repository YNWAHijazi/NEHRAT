/**
 * STAGE ONE: what the nominated party is being asked to take on.
 *
 * Before the ruling of 2026-08-28 this screen carried five facts -- who invited you,
 * the event, its level, its date, and the name you were nominated under -- and then
 * asked for a decision. A party taking on personal or institutional responsibility
 * for an event cannot decide on that. They need to know when it is, where, how large,
 * what the level demands OF THEM, when the organizer must file, who else is named
 * beside them, and what documents concern their role.
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
} from '../../../lib/rules';
import type { NominationBriefing } from '../../../lib/queries';

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
}: {
  briefing: NominationBriefing;
  token: string;
  kind: 'ems' | 'director';
  level: Level | null;
  namedEn: string;
  namedAr: string;
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

  const facts: { key: string; label: { en: string; ar: string }; value: { en: string; ar: string } }[] = [
    { key: 'organizer', label: N.labels.organizer, value: { en: briefing.organizationNameEn || N.unsetEn, ar: briefing.organizationNameAr || N.unsetAr } },
    { key: 'eventName', label: N.labels.eventName, value: { en: briefing.eventNameEn, ar: briefing.eventNameAr } },
    { key: 'eventType', label: N.labels.eventType, value: or(briefing.eventType) },
    { key: 'dates', label: N.labels.dates, value: or(dates) },
    { key: 'times', label: N.labels.times, value: or(times) },
    { key: 'venue', label: N.labels.venue, value: or(briefing.venueRoute) },
    { key: 'municipality', label: N.labels.municipality, value: or(briefing.municipalities) },
    { key: 'level', label: N.labels.level, value: level ? { en: `Level ${level}`, ar: `المستوى ${level}` } : unset },
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
    <div data-region="briefing">
      <Heading en={N.stage1TitleEn} ar={N.stage1TitleAr} />
      <Intro en={N.stage1IntroEn} ar={N.stage1IntroAr} />

      <Panel region="briefing-event">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {facts.map((f) => (
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
              const state = (N.partyStates as Record<string, { en: string; ar: string }>)[p.status];
              const kindLabel = (N.kinds as Record<string, { en: string; ar: string }>)[p.kind];
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
    </div>
  );
}
