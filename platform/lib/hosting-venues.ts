import { getDb } from './db';
import { venueDistrictLabel } from './rules/venue-intake';
import { isArchivedRecord, LIFECYCLE_CONTENT, organizerEventState, type Level } from './rules';
import { beirutToday } from './clock';
import { archiveWindowDays, derivedLevelFor, latestOutcomeFor } from './queries';

/**
 * THE HOSTING VENUE AN EVENT NAMES (platform owner, 8 October 2026). The organizer links
 * the event to a venue registered on the platform: from the suggestions under "Venue,
 * route, or location", from the full list behind "Show all registered venues", or from
 * the selector under "It is at a fixed venue that hosts events repeatedly". All three set
 * the one stored link, events.hosting_venue_id.
 *
 * Which venues are listable: every venue registered on the platform that is not archived,
 * whose demonstration flag matches the choosing account's. Any operator's venue may host
 * any organizer's event, so the list is not limited to the organizer's own venues; a
 * demonstration account sees only demonstration venues and a real account only real ones
 * (non-negotiable 8). The list carries the name in both languages, the district and the
 * record id -- never the responsible person, the telephone, the address or a document.
 *
 * The same rule refuses on the server: a venue id that is not on this list is not stored.
 */
export interface HostingVenueOption {
  id: string;
  nameEn: string;
  nameAr: string;
  districtEn: string;
  districtAr: string;
}

export function hostingVenueOptions(isDemo: boolean): HostingVenueOption[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name_en, name_ar, district FROM venues
       WHERE archived_at IS NULL AND is_demo = ? ORDER BY name_en COLLATE NOCASE, id`,
    )
    .all(isDemo ? 1 : 0) as unknown as { id: string; name_en: string; name_ar: string; district: string }[];
  return rows.map((r) => {
    const district = venueDistrictLabel(r.district);
    return { id: r.id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, districtEn: district.en, districtAr: district.ar };
  });
}

/** True only when the id names a venue the account may choose (the list above). */
export function isListableHostingVenue(venueId: string, isDemo: boolean): boolean {
  if (!/^VN-\d{4,}$/.test(venueId)) return false;
  return Boolean(
    getDb()
      .prepare(`SELECT 1 FROM venues WHERE id = ? AND archived_at IS NULL AND is_demo = ?`)
      .get(venueId, isDemo ? 1 : 0),
  );
}

export type HostingVenueChoice = { ok: true; venueId: string | null } | { ok: false };

/**
 * The value to store for a submitted link. Nothing chosen: null (the place may be a route,
 * or a venue not registered yet). A chosen id that is not listable for the account is
 * refused, not dropped -- the organizer is told, and nothing is saved.
 *
 * THE LINK DOES NOT DEPEND ON THE TICK (platform owner, 8 October 2026). "It is at a fixed
 * venue that hosts events repeatedly" describes the event; the link says which registered
 * venue it is at. A venue chosen from the location field links the event whether or not
 * the box is ticked, and unticking the box does not remove a link. The link is made by
 * record id only, never by matching a typed name.
 */
export function resolveHostingVenue(hostingVenueId: string | null | undefined, isDemo: boolean): HostingVenueChoice {
  const id = (hostingVenueId ?? '').trim();
  if (id === '') return { ok: true, venueId: null };
  return isListableHostingVenue(id, isDemo) ? { ok: true, venueId: id } : { ok: false };
}

/** The venue an event is linked to, as name and record id. Null when none is recorded. */
export function hostingVenueForEvent(eventId: string): { id: string; nameEn: string; nameAr: string } | null {
  const row = getDb()
    .prepare(
      `SELECT v.id, v.name_en, v.name_ar FROM events e JOIN venues v ON v.id = e.hosting_venue_id
       WHERE e.id = ?`,
    )
    .get(eventId) as { id: string; name_en: string; name_ar: string } | undefined;
  return row ? { id: row.id, nameEn: row.name_en, nameAr: row.name_ar || row.name_en } : null;
}

/** One event another organizer has linked to one of the account's venues. */
export interface EventAtVenue {
  id: string;
  nameEn: string;
  nameAr: string;
  startDate: string | null;
  endDate: string | null;
  level: Level | null;
  statusEn: string;
  statusAr: string;
}

export interface EventsAtVenue {
  venueId: string;
  venueNameEn: string;
  venueNameAr: string;
  events: EventAtVenue[];
}

/**
 * EVENTS AT YOUR VENUES (platform owner, 8 October 2026). The venue owner's dashboard
 * lists the events other organizers have linked to the owner's venues.
 *
 * The venue owner is not a party to the event. The query reads the event's name, dates
 * and record id and nothing else from the event row -- no organizer, contact, document
 * or answer leaves the database for this list. The level is the derived final level and
 * the status the same plain status the public register reports, each computed by the one
 * rule every other surface uses. The account's own events are left out (they are already
 * in its own list), as are cancelled and archived events, and an event or a venue across
 * the demonstration line (non-negotiable 8).
 */
export function eventsAtVenuesOf(accountId: number, isDemo: boolean): EventsAtVenue[] {
  const demo = isDemo ? 1 : 0;
  const rows = getDb()
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, e.start_date, e.end_date, e.filed, e.lifecycle, e.archived_at,
              v.id AS venue_id, v.name_en AS venue_name_en, v.name_ar AS venue_name_ar
       FROM events e JOIN venues v ON v.id = e.hosting_venue_id
       WHERE v.account_id = ? AND v.archived_at IS NULL AND v.is_demo = ?
         AND e.account_id <> ? AND e.is_demo = ?
         AND e.archived_at IS NULL AND COALESCE(e.lifecycle, 'active') <> 'cancelled'
       ORDER BY v.name_en COLLATE NOCASE, v.id, e.start_date, e.id`,
    )
    .all(accountId, demo, accountId, demo) as unknown as {
    id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null;
    filed: number; lifecycle: string | null; archived_at: string | null;
    venue_id: string; venue_name_en: string; venue_name_ar: string;
  }[];
  const today = beirutToday();
  const window = archiveWindowDays();
  const byVenue = new Map<string, EventsAtVenue>();
  for (const r of rows) {
    // Concluded past the archive window: the one rule the organizer's own list uses.
    if (isArchivedRecord({ archivedAt: r.archived_at, endDate: r.end_date }, today, window)) continue;
    const lifecycle = r.lifecycle ?? 'active';
    const level = derivedLevelFor(r.id);
    const status =
      lifecycle === 'postponed'
        ? LIFECYCLE_CONTENT.states.postponed
        : organizerEventState({ outcome: latestOutcomeFor(r.id), filed: r.filed === 1, assessed: level !== null });
    let group = byVenue.get(r.venue_id);
    if (!group) {
      group = { venueId: r.venue_id, venueNameEn: r.venue_name_en, venueNameAr: r.venue_name_ar || r.venue_name_en, events: [] };
      byVenue.set(r.venue_id, group);
    }
    group.events.push({
      id: r.id,
      nameEn: r.name_en,
      nameAr: r.name_ar || r.name_en,
      startDate: r.start_date,
      endDate: r.end_date,
      level,
      statusEn: status.en,
      statusAr: status.ar,
    });
  }
  return [...byVenue.values()];
}
