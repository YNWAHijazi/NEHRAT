import { L } from './L';

/** The Ministry's masthead on a document the organizer prints and hands on: the receipt and the decision. */
export function MinistryMasthead() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBlockEnd: 26, borderBlockEnd: '2px solid var(--brand)' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, border: '1.25px solid var(--brand)', borderRadius: '50%', flex: 'none' }}>
        <span style={{ display: 'block', width: 17, height: 17, background: 'var(--brand)', clipPath: 'polygon(43% 0,57% 0,57% 43%,100% 43%,100% 57%,57% 57%,57% 100%,43% 100%,43% 57%,0 57%,0 43%,43% 43%)' }} />
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 600, letterSpacing: '-.015em' }}>
          <L en="Ministry of Public Health" ar="وزارة الصحة العامة" />
        </span>
        <span style={{ display: 'block', fontSize: '13.5px', color: 'var(--muted)', marginBlockStart: 2 }}>
          <L en="Republic of Lebanon · Event Health Readiness" ar="الجمهورية اللبنانية · التأهب الصحي للفعاليات" />
        </span>
      </span>
    </div>
  );
}
