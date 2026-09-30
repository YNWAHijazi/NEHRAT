import { L } from './L';

const upLabel: React.CSSProperties = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 };

/** A small labelled fact above the record's name: its id, its date, its status. */
export interface RecordFact {
  en: string;
  ar: string;
  value: React.ReactNode;
  strong?: boolean;
  /** Rendered under the value -- e.g. the "Copied from" link under an event's id. */
  extra?: React.ReactNode;
}

/** A large figure on the record's trailing side: its level, its deadline, days left. */
export interface RecordStat {
  en: string;
  ar: string;
  value: React.ReactNode;
  region?: string;
  wrapperStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
  /** An information button beside the label. */
  info?: React.ReactNode;
  /** Rendered under the figure -- e.g. a link to finish what it needs. */
  below?: React.ReactNode;
}

/**
 * The identity header every service workspace opens with: facts, the record's
 * name in both languages, and its figures. Events and venues share it so the two
 * workspaces carry the same weight on the page.
 */
export function RecordHeader({ facts, nameEn, nameAr, stats }: { facts: RecordFact[]; nameEn: string; nameAr: string | null; stats: RecordStat[] }) {
  return (
    <div data-region="record-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'start', marginBlockEnd: 32 }}>
      <div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBlockEnd: 12 }}>
          {facts.map((f) => (
            <div key={f.en}>
              <div style={{ ...upLabel, fontSize: 11, marginBlockEnd: 3 }}>
                <L en={f.en} ar={f.ar} />
              </div>
              <div style={{ fontSize: '14.5px', ...(f.strong ? { fontWeight: 500 } : {}), fontVariantNumeric: 'tabular-nums' }}>{f.value}</div>
              {f.extra}
            </div>
          ))}
        </div>
        <h1 data-sec-h1="" style={{ margin: 0, fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <bdi lang="en">{nameEn}</bdi>{nameAr && nameAr !== nameEn ? <> <span style={{display:'block'}}><bdi lang="ar" style={{fontWeight: 400, fontSize: '0.7em', marginBlockStart: 4 }}>({nameAr})</bdi></span></> : null}
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <div key={s.en} data-region={s.region} style={s.wrapperStyle}>
            <div className="event-stat-label" style={upLabel}>
              <L en={s.en} ar={s.ar} />
              {s.info}
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, ...s.valueStyle }}>{s.value}</div>
            {s.below}
          </div>
        ))}
      </div>
    </div>
  );
}
