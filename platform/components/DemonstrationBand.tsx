import { L } from './L';

/**
 * The persistent demonstration band.
 *
 * WHY IT EXISTS. Six demonstration accounts now carry published passwords on a deployed
 * instance. That is the design -- non-negotiable 8 puts demonstration rows in production
 * so the Ministry can walk the platform -- and lib/rules/scope.ts is what keeps those
 * sessions away from real records. But isolation is invisible. A person signed in as the
 * Ministry reviewer sees a console, a submission and a recorded determination, and
 * nothing on the screen says the records are examples. Screenshot that and it is
 * indistinguishable from a real determination, because on screen it WAS one.
 *
 * So the band is not decoration and it is not a nicety. It is the only thing that
 * survives the screenshot.
 *
 * IT PRINTS. This was the part that would have been missed. The print rule in
 * globals.css hides every element and then names the few that come back --
 * [data-wallcard] and [data-region="certificate"] -- so a band rendered in the header
 * would be perfectly visible on screen and absent from the paper. The determination
 * certificate is the single document most likely to be handed to somebody as proof, and
 * it is the one that would have printed clean. The band is marked so the print rule can
 * name it, and html[data-demonstration] shifts the certificate down to make room.
 */
export function DemonstrationBand() {
  return (
    <div
      data-demonstration-band=""
      role="note"
      style={{
        background: 'var(--accent-wash, #F6EEDC)',
        borderBlockEnd: '1px solid var(--accent-ink)',
        color: 'var(--accent-ink)',
      }}
    >
      <div
        data-pad=""
        style={{
          maxWidth: 1160,
          marginInline: 'auto',
          padding: '9px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flex: 'none' }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
        <span style={{ fontWeight: 600 }}>
          <L en="Demonstration account" ar="حساب عرض توضيحي" />
        </span>
        <span>
          {/* Says what it is AND what it is not. "Example records" alone leaves a
              recorded outcome looking like a determination that simply belongs to a
              test event; the second clause is the one that matters on paper. */}
          <L
            en="Every record shown here is an example. Nothing recorded in this account is a Ministry determination, and none of it appears in the national registry."
            ar="كل سجل معروض هنا مثال. لا يشكّل أي إجراء يُسجَّل في هذا الحساب قراراً من الوزارة، ولا يظهر أي منه في السجل الوطني."
          />
        </span>
      </div>
    </div>
  );
}
