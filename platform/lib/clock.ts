/**
 * The clock. Real everywhere, with one exception: REVIEW_CLOCK pins "today" for the
 * visual comparison, so date STRINGS match the pinned reference prototypes. It is
 * ignored in production builds -- deployed date gates always run on the real
 * Asia/Beirut clock (non-negotiable #11).
 */

export function reviewClockOverride(): string | null {
  const pinned = process.env['REVIEW_CLOCK'];
  if (process.env.NODE_ENV === 'production') {
    // REFUSE, do not ignore. Ignoring it was quieter than it should be: a deployed
    // instance with REVIEW_CLOCK set would run on the real clock while whoever set it
    // believed the platform was pinned, and nothing anywhere would say otherwise.
    // A pinned clock reaching production is a misconfiguration that silently falsifies
    // every deadline, every date gate and the post-event window -- so it is a hard
    // failure, not a warning and not a shrug. Unset is the only correct value here.
    if (pinned && pinned.trim() !== '') {
      throw new Error(
        `REVIEW_CLOCK is set to "${pinned}" in a production build. It pins "today" for ` +
          `the visual comparison and must never be live where the Ministry works: every ` +
          `date gate would compute against a frozen date, and nothing would fail. ` +
          `Unset it (non-negotiable 11).`,
      );
    }
    return null;
  }
  return pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned) ? pinned : null;
}

/** Today's date in Asia/Beirut, YYYY-MM-DD. */
export function beirutToday(): string {
  const pinned = reviewClockOverride();
  if (pinned) return pinned;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(new Date());
}

/** The current instant; noon Beirut on the pinned day under REVIEW_CLOCK. */
export function clockNow(): Date {
  const pinned = reviewClockOverride();
  if (pinned) return new Date(`${pinned}T12:00:00+03:00`);
  return new Date();
}

/**
 * The recorded-timestamp stamp: 'YYYY-MM-DD HH:MM:SS' on the SAME clock the date
 * gates run on. Under REVIEW_CLOCK the date is the pinned day (the time of day is
 * real, so orderings within a session hold); in production it is real Beirut time.
 * One clock: a determination can never be dated after "today" again.
 */
export function nowStamp(): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());
  return `${beirutToday()} ${time}`;
}
