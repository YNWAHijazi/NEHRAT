import { backfillSites, getDb, insertSite } from './db';
import { facilityDevices } from './queries';
import { deviceStatus } from './rules/facility';

/**
 * THE SITE: the physical place that a hosting venue registration, a PAD facility
 * registration and individual events point to (Hosting Venue Registration, revised
 * logic, 8 October 2026). "Share data, not regulatory status": the venue reads the
 * facility's AEDs through the site and never copies them; each registration keeps its
 * own record id, status and history. Links go by immutable ids, never by name.
 */

/** The site a venue stands on, created on first read for a venue that predates sites. */
export function siteIdForVenue(venueId: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT site_id FROM venues WHERE id = ?').get(venueId) as { site_id: string | null } | undefined;
  if (!row) return null;
  if (row.site_id) return row.site_id;
  backfillSites(d);
  return (d.prepare('SELECT site_id FROM venues WHERE id = ?').get(venueId) as { site_id: string | null }).site_id;
}

/** The site a facility stands on, created on first read for a facility that predates sites. */
export function siteIdForFacility(facilityId: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT site_id FROM facilities WHERE id = ?').get(facilityId) as { site_id: string | null } | undefined;
  if (!row) return null;
  if (row.site_id) return row.site_id;
  backfillSites(d);
  return (d.prepare('SELECT site_id FROM facilities WHERE id = ?').get(facilityId) as { site_id: string | null }).site_id;
}

export { insertSite };

export interface SiteAed {
  label: string;
  locationEn: string; locationAr: string;
  publiclyAccessible: boolean;
  statusEn: string; statusAr: string; statusKey: string;
}

export interface SitePadFacility {
  facilityId: string;
  nameEn: string; nameAr: string;
  devices: SiteAed[];
}

/**
 * The PAD facility registration on the same site, with its registered AEDs and their
 * current registry status, read from the facility record (the source of truth). Null
 * when the site has none. An archived facility is not linked: its coverage has ended.
 */
export function padFacilityOnSite(siteId: string): SitePadFacility | null {
  const f = getDb()
    .prepare(`SELECT id, name_en, name_ar FROM facilities WHERE site_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1`)
    .get(siteId) as { id: string; name_en: string; name_ar: string } | undefined;
  if (!f) return null;
  return {
    facilityId: f.id, nameEn: f.name_en, nameAr: f.name_ar || f.name_en,
    devices: facilityDevices(f.id).map((dv) => {
      const st = deviceStatus({ operational: dv.operational, accessibleHours: dv.accessibleHours });
      return { label: dv.label, locationEn: dv.locationEn, locationAr: dv.locationAr || dv.locationEn, publiclyAccessible: dv.publiclyAccessible, statusEn: st.en, statusAr: st.ar, statusKey: st.key };
    }),
  };
}

/** The venue's PAD facility, through the venue's site. */
export function padFacilityForVenue(venueId: string): SitePadFacility | null {
  const site = siteIdForVenue(venueId);
  return site ? padFacilityOnSite(site) : null;
}

/**
 * The account's own PAD facility registrations that could be linked to a venue: not
 * archived, same demonstration flag, and not already on another venue's site.
 */
export function linkableFacilitiesFor(accountId: number, venueId: string): { id: string; nameEn: string; nameAr: string }[] {
  const site = siteIdForVenue(venueId);
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.name_en, f.name_ar FROM facilities f
       JOIN venues v ON v.id = ? AND v.account_id = f.account_id AND v.is_demo = f.is_demo
       WHERE f.account_id = ? AND f.archived_at IS NULL
         AND (f.site_id IS NULL OR f.site_id = ? OR NOT EXISTS (SELECT 1 FROM venues o WHERE o.site_id = f.site_id AND o.id <> v.id))
       ORDER BY f.id`,
    )
    .all(venueId, accountId, site) as unknown as { id: string; name_en: string; name_ar: string }[];
  return rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en }));
}

/**
 * Records that a PAD facility registration is at this venue's physical place: the
 * facility moves onto the venue's site. Only the owner of both may do it. The site
 * the facility leaves is removed when nothing else stands on it. Returns false when refused.
 */
export function linkFacilityToVenue(accountId: number, venueId: string, facilityId: string): boolean {
  if (!linkableFacilitiesFor(accountId, venueId).some((f) => f.id === facilityId)) return false;
  const d = getDb();
  const site = siteIdForVenue(venueId);
  const previous = siteIdForFacility(facilityId);
  // One PAD facility registration per site: a second is refused, not stacked.
  if (!site || padFacilityOnSite(site)) return false;
  d.exec('BEGIN IMMEDIATE');
  try {
    d.prepare('UPDATE facilities SET site_id = ? WHERE id = ? AND account_id = ?').run(site, facilityId, accountId);
    if (previous && previous !== site) removeSiteIfUnused(previous);
    d.exec('COMMIT');
  } catch (error) { d.exec('ROLLBACK'); throw error; }
  return true;
}

/** Undoes a link: the facility returns to a site of its own. */
export function unlinkFacilityFromVenue(accountId: number, venueId: string, facilityId: string): boolean {
  const d = getDb();
  const site = siteIdForVenue(venueId);
  const f = d.prepare('SELECT name_en, name_ar, municipality_en, municipality_ar, is_demo FROM facilities WHERE id = ? AND account_id = ? AND site_id = ?')
    .get(facilityId, accountId, site) as { name_en: string; name_ar: string; municipality_en: string; municipality_ar: string; is_demo: number } | undefined;
  if (!f) return false;
  const own = insertSite(d, { nameEn: f.name_en, nameAr: f.name_ar, municipalityEn: f.municipality_en, municipalityAr: f.municipality_ar, district: '', latitude: null, longitude: null, createdBy: accountId, isDemo: f.is_demo === 1 });
  d.prepare('UPDATE facilities SET site_id = ? WHERE id = ?').run(own, facilityId);
  return true;
}

function removeSiteIfUnused(siteId: string): void {
  const d = getDb();
  const used = d.prepare(`SELECT 1 FROM venues WHERE site_id = ? UNION ALL SELECT 1 FROM facilities WHERE site_id = ? UNION ALL SELECT 1 FROM events WHERE site_id = ? LIMIT 1`).get(siteId, siteId, siteId);
  if (!used) d.prepare('DELETE FROM sites WHERE id = ?').run(siteId);
}

/**
 * The site a new PAD facility registration should stand on when it is started from a
 * venue ("Register this venue's AEDs"): the venue's site, if the account owns the venue
 * and nothing else is registered there yet. Null otherwise -- the facility gets its own.
 */
export function venueSiteForNewFacility(accountId: number, venueId: string): string | null {
  const v = getDb().prepare('SELECT 1 FROM venues WHERE id = ? AND account_id = ? AND archived_at IS NULL').get(venueId, accountId);
  if (!v) return null;
  const site = siteIdForVenue(venueId);
  return site && !padFacilityOnSite(site) ? site : null;
}

/**
 * The hosting venue registration on the facility's site, for the facility record's PAD
 * venue link: the same place, two registrations. Only a venue the facility's owner holds
 * is named -- a record never shows another account's registration -- and only a live one.
 */
export function hostingVenueForFacility(accountId: number, facilityId: string): { id: string; nameEn: string; nameAr: string } | null {
  const site = siteIdForFacility(facilityId);
  if (!site) return null;
  const v = getDb()
    .prepare(`SELECT id, name_en, name_ar FROM venues WHERE site_id = ? AND account_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1`)
    .get(site, accountId) as { id: string; name_en: string; name_ar: string } | undefined;
  return v ? { id: v.id, nameEn: v.name_en, nameAr: v.name_ar || v.name_en } : null;
}
