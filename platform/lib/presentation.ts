/**
 * Presentation-only thresholds. These control COLOUR, nothing else -- no gate, deadline
 * or obligation derives from them. They coincide numerically with nothing enforced; the
 * enforced windows live in lib/rules/data/levels.json.
 *
 * From the reference prototype's dashboard urgency treatment.
 */

export const DASHBOARD_URGENCY = {
  /** At or under this many days to the due date, the row reads as critical. */
  criticalDays: 14,
  /** At or under this many days, the row reads as warning. */
  warningDays: 45,
} as const;
