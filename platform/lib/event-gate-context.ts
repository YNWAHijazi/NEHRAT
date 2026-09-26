import { getDb } from "./db";
import { clockNow } from "./clock";
import { derivedLevelFor } from "./queries";
import type { EventGateContext } from "./rules/gates";
export function eventGateContext(eventId: string): EventGateContext {
  const row = getDb()
    .prepare(
      "SELECT start_date, end_date, closing_time, filed, lifecycle, archived_at FROM events WHERE id = ?",
    )
    .get(eventId) as {
    start_date: string | null;
    end_date: string | null;
    closing_time: string | null;
    filed: number;
    lifecycle: "active" | "cancelled" | "postponed";
    archived_at: string | null;
  };
  return {
    finalLevel: derivedLevelFor(eventId),
    eventStartDate: row.start_date,
    eventEndDate: row.end_date,
    eventEndTime: row.closing_time,
    filed: row.filed === 1,
    organizationStatus: "recorded",
    now: clockNow(),
    lifecycle: row.lifecycle,
    archived: Boolean(row.archived_at),
  };
}
