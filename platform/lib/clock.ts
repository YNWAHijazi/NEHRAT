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
