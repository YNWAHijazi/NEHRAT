import { getDb } from './db';
import { beirutToday, nowStamp } from './clock';
import { archiveWindowDays, derivedLevelFor, facilityDevices, latestOutcomeFor } from './queries';
import { padFacilityOnSite, type SiteAed } from './sites';
import { siteInfrastructure, type SiteInfrastructureAnswers } from './site-infrastructure';
import { isArchivedRecord, LIFECYCLE_CONTENT, organizerEventState, type Level } from './rules';
import { eventSiteAlert, type EventSiteAlertKey } from './rules/site';
import { siteRenewalFor } from './site-registration';

/**
 * THE EVENT'S SITE (owner, 9 October 2026: "Link between event and facility, no longer
 * venue"; latest revision, sections 16 and 17). An event names the registered Facility/Site
 * it is held at by events.site_id. The Facility/Site registration standing on that site
 * becomes the event's facility reference (events.venue_facility_id, set by the database
 * trigger), so the existing AED reference applies.
 *
 * Which sites are listable: every Site with a Facility/Site registration that is not
 * archived, on the choosing account's side of the demonstration line. Any operator's site may
 * host any organizer's event, so the list is not limited to the organizer's own. The list
 * carries the name, the municipality and the Site ID -- never a contact, a telephone, an
 * address or a document. The same rule refuses on the server: a site that is not listable is
 * not stored.
 *
 * Reuse is not inheritance: the event completes its own applicability, assessment, level and
 * requirements. What a site offers the event is read here, shown on the record, and used only
 * after the organizer confirms it applies (section 16) or answers that the site's AEDs remain
 * accessible and operational throughout the event (section 17).
 */

export interface SiteOption {
  id: string;
  facilityId: string;
  nameEn: string;
  nameAr: string;
  municipalityEn: string;
  municipalityAr: string;
}

const SITE_ID = /^SITE-\d{6}$/;

/** The registered Facility/Sites an account may link an event to. */
export function siteOptions(isDemo: boolean): SiteOption[] {
  const rows = getDb()
    .prepare(
      `SELECT f.site_id AS id, f.id AS facility_id, f.name_en, f.name_ar, f.municipality_en, f.municipality_ar
       FROM facilities f JOIN sites s ON s.id = f.site_id
       WHERE f.archived_at IS NULL AND f.is_demo = ? AND s.is_demo = f.is_demo
         AND f.id = (SELECT MIN(g.id) FROM facilities g WHERE g.site_id = f.site_id AND g.archived_at IS NULL)
       ORDER BY f.name_en COLLATE NOCASE, f.site_id`,
    )
    .all(isDemo ? 1 : 0) as unknown as { id: string; facility_id: string; name_en: string; name_ar: string; municipality_en: string; municipality_ar: string }[];
  return rows.map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    nameEn: r.name_en,
    nameAr: r.name_ar || r.name_en,
    municipalityEn: r.municipality_en,
    municipalityAr: r.municipality_ar || r.municipality_en,
  }));
}

/** True only when the id names a site the account may choose (the list above). */
export function isListableSite(siteId: string, isDemo: boolean): boolean {
  if (!SITE_ID.test(siteId)) return false;
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM facilities f JOIN sites s ON s.id = f.site_id
         WHERE f.site_id = ? AND f.archived_at IS NULL AND f.is_demo = ? AND s.is_demo = f.is_demo`,
      )
      .get(siteId, isDemo ? 1 : 0),
  );
}

export type SiteChoice = { ok: true; siteId: string | null } | { ok: false };

/**
 * The value to store for a submitted link. Nothing chosen: null (the place may be a route, or
 * a place with no Facility/Site registration). A chosen id that is not listable is refused,
 * not dropped -- the organizer is told and nothing is saved. Linked by Site ID only, never by
 * matching a typed name.
 */
export function resolveSiteChoice(siteId: string | null | undefined, isDemo: boolean): SiteChoice {
  const id = (siteId ?? '').trim();
  if (id === '') return { ok: true, siteId: null };
  return isListableSite(id, isDemo) ? { ok: true, siteId: id } : { ok: false };
}

/** The listable site an event opened with ?site= names, or null (an unlistable id opens unlinked). */
export function siteOptionFor(siteId: string | null | undefined, isDemo: boolean): SiteOption | null {
  if (!siteId) return null;
  return siteOptions(isDemo).find((o) => o.id === siteId) ?? null;
}

/** The site an event names, as name and Site ID. Null when the event names none. */
export function siteForEvent(eventId: string): { siteId: string; nameEn: string; nameAr: string; facilityId: string | null } | null {
  const row = getDb()
    .prepare(
      `SELECT e.site_id, s.name_en AS site_en, s.name_ar AS site_ar, f.id AS facility_id, f.name_en, f.name_ar
       FROM events e JOIN sites s ON s.id = e.site_id
       LEFT JOIN facilities f ON f.id = (SELECT MIN(g.id) FROM facilities g WHERE g.site_id = e.site_id AND g.archived_at IS NULL)
       WHERE e.id = ?`,
    )
    .get(eventId) as { site_id: string; site_en: string; site_ar: string; facility_id: string | null; name_en: string | null; name_ar: string | null } | undefined;
  if (!row) return null;
  const nameEn = row.name_en ?? row.site_en;
  return { siteId: row.site_id, nameEn, nameAr: row.name_ar || row.site_ar || nameEn, facilityId: row.facility_id };
}

/**
 * The alert an event carries while the site it is held at is expiring soon or expired, or its
 * annual confirmation or drill falls due before the event ends (owner, 9 October 2026; the rule
 * is lib/rules/site.ts eventSiteAlert). None for an event that has ended or was cancelled.
 */
export function eventSiteAlertFor(eventId: string, today: string = beirutToday()): { key: EventSiteAlertKey; en: string; ar: string; siteId: string } | null {
  const site = siteForEvent(eventId);
  if (!site?.facilityId) return null;
  const ev = getDb().prepare(`SELECT start_date, end_date, lifecycle FROM events WHERE id = ?`).get(eventId) as
    | { start_date: string | null; end_date: string | null; lifecycle: string | null }
    | undefined;
  if (!ev || ev.lifecycle === 'cancelled') return null;
  const end = ev.end_date ?? ev.start_date;
  if (end && end < today) return null;
  const alert = eventSiteAlert(siteRenewalFor(site.facilityId, today), { startDate: ev.start_date, endDate: ev.end_date }, site);
  return alert ? { ...alert, siteId: site.siteId } : null;
}

/* ---------------- what the site offers an event (section 16) ---------------- */

export interface SiteInformation {
  siteId: string;
  /** The Facility/Site registration on the site; null when none stands there (an older venue-only site). */
  facilityId: string | null;
  nameEn: string;
  nameAr: string;
  address: string;
  municipalityEn: string;
  municipalityAr: string;
  point: { lat: number; lng: number } | null;
  licensedCapacity: number | null;
  /** The facility's main EMS entrance or access point, and the infrastructure answers on access. */
  accessPoint: string;
  emergencyAccess: string;
  ambulanceWaiting: string;
  patientAccess: string;
  stretcherRoutes: string;
  layoutMap: { fileName: string; uploadedAt: string } | null;
  aeds: SiteAed[];
  /** Any registered device carries pediatric capability (the reference shortfall rule reads it). */
  anyPediatric: boolean;
  /** The facility registration's details revision: the version of the site record relied on. */
  facilityRevision: number | null;
  infrastructureUpdatedAt: string;
}

/** The site's profile, basic infrastructure and registered AEDs, read from the site record. */
export function siteInformation(siteId: string): SiteInformation | null {
  const d = getDb();
  const site = d.prepare(`SELECT id, name_en, name_ar, municipality_en, municipality_ar, latitude, longitude FROM sites WHERE id = ?`).get(siteId) as
    | { id: string; name_en: string; name_ar: string; municipality_en: string; municipality_ar: string; latitude: number | null; longitude: number | null }
    | undefined;
  if (!site) return null;
  const pad = padFacilityOnSite(siteId);
  const f = pad
    ? (d.prepare(`SELECT id, name_en, name_ar, address, municipality_en, municipality_ar, latitude, longitude, licensed_capacity, access_point, details_revision FROM facilities WHERE id = ?`).get(pad.facilityId) as {
        id: string; name_en: string; name_ar: string; address: string; municipality_en: string; municipality_ar: string;
        latitude: number | null; longitude: number | null; licensed_capacity: number | null; access_point: string; details_revision: number;
      })
    : null;
  const infra = siteInfrastructure(siteId);
  const a: SiteInfrastructureAnswers = infra?.answers ?? {};
  const lat = f?.latitude ?? site.latitude;
  const lng = f?.longitude ?? site.longitude;
  const nameEn = f?.name_en ?? site.name_en;
  return {
    siteId,
    facilityId: f?.id ?? null,
    nameEn,
    nameAr: f?.name_ar || site.name_ar || nameEn,
    address: f?.address ?? '',
    municipalityEn: f?.municipality_en || site.municipality_en,
    municipalityAr: f?.municipality_ar || site.municipality_ar || f?.municipality_en || site.municipality_en,
    point: lat !== null && lng !== null && lat !== undefined && lng !== undefined ? { lat, lng } : null,
    licensedCapacity: f?.licensed_capacity ?? null,
    accessPoint: f?.access_point ?? '',
    emergencyAccess: a.emergencyAccess ?? '',
    ambulanceWaiting: a.ambulanceWaiting ?? '',
    patientAccess: a.patientAccess ?? '',
    stretcherRoutes: a.stretcherRoutes ?? '',
    layoutMap: infra?.layoutMap ? { fileName: infra.layoutMap.fileName, uploadedAt: infra.layoutMap.uploadedAt } : null,
    aeds: pad?.devices ?? [],
    anyPediatric: pad ? facilityDevices(pad.facilityId).some((dv) => dv.pediatric === 'yes') : false,
    facilityRevision: f?.details_revision ?? null,
    infrastructureUpdatedAt: infra?.updatedAt ?? '',
  };
}

/** The site's patient access answer as one line, for the event's patient access row. */
export function sitePatientAccessText(info: SiteInformation): string {
  return [info.patientAccess, info.stretcherRoutes].map((s) => s.trim()).filter(Boolean).join(' — ');
}

/** The site's emergency vehicle access answer as one line. */
export function siteEmergencyAccessText(info: SiteInformation): string {
  return [info.accessPoint, info.emergencyAccess, info.ambulanceWaiting].map((s) => s.trim()).filter(Boolean).join(' — ');
}

/* ---------------- the organizer's confirmation (section 16) ---------------- */

export interface SiteConfirmation {
  siteId: string;
  differences: string;
  confirmedAt: string;
  confirmedByName: string;
}

/**
 * The organizer's confirmation that the reused Site information applies to this event. Only a
 * confirmation given for the site the event names now counts: a changed link asks again.
 */
export function siteConfirmationFor(eventId: string): SiteConfirmation | null {
  const row = getDb()
    .prepare(
      `SELECT c.site_id, c.differences, c.confirmed_at, a.display_name
       FROM event_site_confirmations c JOIN events e ON e.id = c.event_id AND e.site_id = c.site_id
       LEFT JOIN accounts a ON a.id = c.confirmed_by
       WHERE c.event_id = ?`,
    )
    .get(eventId) as { site_id: string; differences: string; confirmed_at: string; display_name: string | null } | undefined;
  return row ? { siteId: row.site_id, differences: row.differences, confirmedAt: row.confirmed_at, confirmedByName: row.display_name ?? '' } : null;
}

export function saveSiteConfirmation(eventId: string, siteId: string, accountId: number, differences: string): void {
  getDb()
    .prepare(
      `INSERT INTO event_site_confirmations (event_id, site_id, differences, confirmed_by, confirmed_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (event_id) DO UPDATE SET site_id = excluded.site_id, differences = excluded.differences,
         confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at`,
    )
    .run(eventId, siteId, differences, accountId, nowStamp());
}

export function clearSiteConfirmation(eventId: string): void {
  getDb().prepare(`DELETE FROM event_site_confirmations WHERE event_id = ?`).run(eventId);
}

/* ---------------- the snapshot at submission (section 1) ---------------- */

export interface SiteSnapshot {
  takenAt: string;
  submissionVersion: number;
  siteId: string;
  facilityId: string | null;
  facilityRevision: number | null;
  information: SiteInformation;
  confirmation: { confirmed: boolean; differences: string; confirmedAt: string | null; confirmedByName: string | null };
  /** The organizer's answer to "Will these AEDs remain accessible and operational throughout this event?" */
  aedReuse: 'yes' | 'no' | null;
}

/**
 * Freezes the Site information an event relied on when it is filed: the profile, the basic
 * infrastructure, the AEDs with their status, the facility registration and its revision, and
 * the organizer's confirmation and AED answer as they stood. A later edit to the site record
 * never rewrites what the Ministry read. No site, no snapshot.
 */
export function writeSiteSnapshot(eventId: string, submissionVersion: number, aedReuse: 'yes' | 'no' | null): void {
  const site = siteForEvent(eventId);
  if (!site) return;
  const information = siteInformation(site.siteId);
  if (!information) return;
  const c = siteConfirmationFor(eventId);
  const takenAt = nowStamp();
  const snapshot: SiteSnapshot = {
    takenAt, submissionVersion, siteId: site.siteId, facilityId: information.facilityId, facilityRevision: information.facilityRevision,
    information,
    confirmation: { confirmed: c !== null, differences: c?.differences ?? '', confirmedAt: c?.confirmedAt ?? null, confirmedByName: c?.confirmedByName ?? null },
    aedReuse,
  };
  getDb()
    .prepare(
      `INSERT INTO event_site_snapshots (event_id, submission_version, site_id, facility_id, snapshot, taken_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, submission_version) DO UPDATE SET site_id = excluded.site_id, facility_id = excluded.facility_id,
         snapshot = excluded.snapshot, taken_at = excluded.taken_at`,
    )
    .run(eventId, submissionVersion, site.siteId, information.facilityId, JSON.stringify(snapshot), takenAt);
}

/** The snapshot frozen with a submission version, or the latest one when no version is named. */
export function siteSnapshotFor(eventId: string, submissionVersion?: number): SiteSnapshot | null {
  const row = (submissionVersion === undefined
    ? getDb().prepare(`SELECT snapshot FROM event_site_snapshots WHERE event_id = ? ORDER BY submission_version DESC LIMIT 1`).get(eventId)
    : getDb().prepare(`SELECT snapshot FROM event_site_snapshots WHERE event_id = ? AND submission_version = ?`).get(eventId, submissionVersion)) as
    | { snapshot: string }
    | undefined;
  if (!row) return null;
  try { return JSON.parse(row.snapshot) as SiteSnapshot; } catch { return null; }
}

/* ---------------- events at your sites ---------------- */

export interface EventAtSite {
  id: string;
  nameEn: string;
  nameAr: string;
  startDate: string | null;
  endDate: string | null;
  level: Level | null;
  statusEn: string;
  statusAr: string;
}

export interface EventsAtSite {
  siteId: string;
  siteNameEn: string;
  siteNameAr: string;
  events: EventAtSite[];
}

/**
 * EVENTS AT YOUR SITES. The account that holds a Facility/Site registration sees the events
 * other organizers have linked to that site. The site's operator is not a party to the event:
 * the query reads the event's name, dates and record id and nothing else from the event row --
 * no organizer, contact, document or answer leaves the database for this list. The level and
 * the status are computed by the one rule every other surface uses. The account's own events,
 * cancelled and archived events, and anything across the demonstration line are left out.
 */
export function eventsAtSitesOf(accountId: number, isDemo: boolean): EventsAtSite[] {
  const demo = isDemo ? 1 : 0;
  const rows = getDb()
    .prepare(
      `SELECT e.id, e.name_en, e.name_ar, e.start_date, e.end_date, e.filed, e.lifecycle, e.archived_at,
              f.site_id, f.name_en AS site_name_en, f.name_ar AS site_name_ar
       FROM events e JOIN facilities f ON f.site_id = e.site_id
       WHERE f.account_id = ? AND f.archived_at IS NULL AND f.is_demo = ?
         AND e.account_id <> ? AND e.is_demo = ?
         AND e.archived_at IS NULL AND COALESCE(e.lifecycle, 'active') <> 'cancelled'
       GROUP BY e.id
       ORDER BY f.name_en COLLATE NOCASE, f.site_id, e.start_date, e.id`,
    )
    .all(accountId, demo, accountId, demo) as unknown as {
    id: string; name_en: string; name_ar: string; start_date: string | null; end_date: string | null;
    filed: number; lifecycle: string | null; archived_at: string | null;
    site_id: string; site_name_en: string; site_name_ar: string;
  }[];
  const today = beirutToday();
  const window = archiveWindowDays();
  const bySite = new Map<string, EventsAtSite>();
  for (const r of rows) {
    if (isArchivedRecord({ archivedAt: r.archived_at, endDate: r.end_date }, today, window)) continue;
    const level = derivedLevelFor(r.id);
    const status =
      (r.lifecycle ?? 'active') === 'postponed'
        ? LIFECYCLE_CONTENT.states.postponed
        : organizerEventState({ outcome: latestOutcomeFor(r.id), filed: r.filed === 1, assessed: level !== null });
    let group = bySite.get(r.site_id);
    if (!group) {
      group = { siteId: r.site_id, siteNameEn: r.site_name_en, siteNameAr: r.site_name_ar || r.site_name_en, events: [] };
      bySite.set(r.site_id, group);
    }
    group.events.push({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar || r.name_en, startDate: r.start_date, endDate: r.end_date, level, statusEn: status.en, statusAr: status.ar });
  }
  return [...bySite.values()];
}

/** Whether the account holds a live Facility/Site registration (the dashboard shows the list only then). */
export function holdsSites(accountId: number): boolean {
  return Boolean(getDb().prepare(`SELECT 1 FROM facilities WHERE account_id = ? AND archived_at IS NULL AND site_id IS NOT NULL LIMIT 1`).get(accountId));
}
