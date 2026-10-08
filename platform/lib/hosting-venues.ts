import { getDb } from './db';
import { venueDistrictLabel } from './rules/venue-intake';

/**
 * THE HOSTING VENUE AN EVENT NAMES (platform owner, 8 October 2026). When the organizer
 * says the event is at a fixed venue that hosts events repeatedly, they choose that venue
 * from the venues registered on the platform.
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
 * The value to store for a submitted choice. Not a fixed venue, or nothing chosen: null
 * (the venue may not be registered yet). A chosen id that is not listable for the account
 * is refused, not dropped -- the organizer is told, and nothing is saved.
 */
export function resolveHostingVenue(
  recurringFixedVenue: boolean,
  hostingVenueId: string | null | undefined,
  isDemo: boolean,
): HostingVenueChoice {
  const id = (hostingVenueId ?? '').trim();
  if (!recurringFixedVenue || id === '') return { ok: true, venueId: null };
  return isListableHostingVenue(id, isDemo) ? { ok: true, venueId: id } : { ok: false };
}

/** The venue an event names, as name and record id. Null when none is recorded. */
export function hostingVenueForEvent(eventId: string): { id: string; nameEn: string; nameAr: string } | null {
  const row = getDb()
    .prepare(
      `SELECT v.id, v.name_en, v.name_ar FROM events e JOIN venues v ON v.id = e.hosting_venue_id
       WHERE e.id = ? AND e.recurring_fixed_venue = 1`,
    )
    .get(eventId) as { id: string; name_en: string; name_ar: string } | undefined;
  return row ? { id: row.id, nameEn: row.name_en, nameAr: row.name_ar || row.name_en } : null;
}
