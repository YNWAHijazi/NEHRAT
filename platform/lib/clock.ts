/**
 * The clock. Real everywhere, with one exception: REVIEW_CLOCK pins "today" for the
 * visual comparison, so date STRINGS match the pinned reference prototypes. It is
 * ignored in production builds -- deployed date gates always run on the real
 * Asia/Beirut clock (non-negotiable #11).
 */

export function reviewClockOverride(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  const pinned = process.env['REVIEW_CLOCK'];
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
