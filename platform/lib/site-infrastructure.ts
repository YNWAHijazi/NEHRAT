import { getDb } from './db';

/**
 * A Facility/Site's basic infrastructure (Latest revision, 9 October 2026, section 3): kept
 * simple and reusable -- the layout map, halls/floors/zones, emergency vehicle access, patient
 * access and extraction, an optional permanent first-aid room and other information. Events
 * held at the site reuse it after the organizer confirms it applies (section 16). It creates
 * no regulatory blocker for the site.
 *
 * The shared contract between the site record (which writes it) and the event (which reads
 * it): one answer set per facility registration in facility_infrastructure, the layout map as
 * a facility_documents row with purpose 'layoutMap'.
 */
export interface SiteInfrastructureAnswers {
  /** 'indoor' | 'outdoor' | 'both' */
  configuration?: string;
  zones?: string;
  emergencyAccess?: string;
  ambulanceWaiting?: string;
  patientAccess?: string;
  stretcherRoutes?: string;
  /** 'yes' | 'no' */
  firstAidRoom?: string;
  firstAidLocation?: string;
  firstAidEquipment?: string;
  communications?: string;
  other?: string;
}

export interface SiteInfrastructure {
  facilityId: string;
  siteId: string | null;
  answers: SiteInfrastructureAnswers;
  layoutMap: { id: number; fileName: string; uploadedAt: string } | null;
  updatedAt: string;
}

export const INFRASTRUCTURE_KEYS: readonly (keyof SiteInfrastructureAnswers)[] = [
  'configuration', 'zones', 'emergencyAccess', 'ambulanceWaiting', 'patientAccess', 'stretcherRoutes',
  'firstAidRoom', 'firstAidLocation', 'firstAidEquipment', 'communications', 'other',
];

function parse(json: string): SiteInfrastructureAnswers {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: SiteInfrastructureAnswers = {};
    for (const k of INFRASTRUCTURE_KEYS) if (typeof raw[k] === 'string') out[k] = raw[k] as string;
    return out;
  } catch { return {}; }
}

/** The infrastructure recorded on a facility registration (empty answers when none yet). */
export function facilityInfrastructure(facilityId: string): SiteInfrastructure | null {
  const d = getDb();
  const f = d.prepare('SELECT id, site_id FROM facilities WHERE id = ?').get(facilityId) as { id: string; site_id: string | null } | undefined;
  if (!f) return null;
  const row = d.prepare('SELECT answers, updated_at FROM facility_infrastructure WHERE facility_id = ?').get(facilityId) as { answers: string; updated_at: string } | undefined;
  const map = d.prepare(`SELECT id, file_name, uploaded_at FROM facility_documents WHERE facility_id = ? AND purpose = 'layoutMap' AND removed_at IS NULL AND bytes IS NOT NULL ORDER BY id DESC LIMIT 1`).get(facilityId) as { id: number; file_name: string; uploaded_at: string } | undefined;
  return {
    facilityId, siteId: f.site_id,
    answers: row ? parse(row.answers) : {},
    layoutMap: map ? { id: map.id, fileName: map.file_name, uploadedAt: map.uploaded_at } : null,
    updatedAt: row?.updated_at ?? '',
  };
}

/** The infrastructure of the facility registration on a site, for an event held there. */
export function siteInfrastructure(siteId: string): SiteInfrastructure | null {
  const f = getDb().prepare('SELECT id FROM facilities WHERE site_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1').get(siteId) as { id: string } | undefined;
  return f ? facilityInfrastructure(f.id) : null;
}

/** Writes the answer set whole (the site record's save). Unknown keys are dropped. */
export function saveFacilityInfrastructure(facilityId: string, answers: SiteInfrastructureAnswers, accountId: number, stamp: string): void {
  const clean: SiteInfrastructureAnswers = {};
  for (const k of INFRASTRUCTURE_KEYS) { const v = answers[k]; if (typeof v === 'string' && v.trim() !== '') clean[k] = v.trim(); }
  getDb().prepare(`INSERT INTO facility_infrastructure (facility_id, answers, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(facility_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(facilityId, JSON.stringify(clean), stamp, accountId);
}
