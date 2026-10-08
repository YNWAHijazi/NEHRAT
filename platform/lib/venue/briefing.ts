import { getDb } from '../db';
import { venueById } from '../queries';
import { venueRecordRequirements } from '../record-facts';
import { venueDistrictLabel, venueTypeLabel } from '../rules/venue-intake';
import type { Level, RequirementInstance } from '../rules';
import { venueInvitation, venueInvitations, type VenueInvitation } from './collaboration';

/**
 * THE VENUE, THE WAY A NOMINATED PARTY READS IT -- the venue counterpart of
 * nominationBriefing (lib/queries.ts), rendered by the SAME Briefing component.
 *
 * What the party is asked to do comes from the record resolver (venueRecordRequirements,
 * lib/rules/record-requirements): the rows whose authors name the party's role at the
 * venue's level, so the briefing and the partner's working page can never disagree.
 *
 * WHAT IS NOT HERE, deliberately: the operator's answers, files, contact details and
 * the other parties' tokens. Being named on a venue is not being handed its record
 * before accepting.
 */
export interface VenueBriefingRow {
  key: string;
  n: number | null;
  en: string;
  ar: string;
  valueEn: string;
  valueAr: string;
  /** No other role is named on the row: nobody else can complete it. */
  sole: boolean;
}

export interface VenueNominationBriefing {
  venueNameEn: string;
  venueNameAr: string;
  operatorNameEn: string | null;
  operatorNameAr: string | null;
  venueType: { en: string; ar: string };
  municipalityEn: string;
  municipalityAr: string;
  district: { en: string; ar: string } | null;
  licensedCapacity: number | null;
  level: Level | null;
  rows: VenueBriefingRow[];
  otherParties: { kind: 'ems' | 'director'; nameEn: string; nameAr: string; status: 'nominated' | 'confirmed' | 'declined'; isThisOne: boolean }[];
}

/** The rows that name this role: it authors them, or (the Director) approves them. */
export function rowsForVenueParty(instances: readonly RequirementInstance[], kind: 'ems' | 'director'): VenueBriefingRow[] {
  return instances
    .filter((i) => i.section === 'requirement' && (i.authors.includes(kind) || (kind === 'director' && i.approver === 'director')))
    .map((i) => ({
      key: i.key, n: i.n, en: i.labelEn, ar: i.labelAr, valueEn: i.sourceEn, valueAr: i.sourceAr,
      sole: i.authors.length === 1 && i.authors[0] === kind,
    }));
}

/** The invitation, its venue's owner, and whether the token still accepts a response. */
export function venueInvitationState(token: string): { inv: VenueInvitation; ownerId: number; isDemo: boolean; open: boolean; editable: boolean; archived: boolean } | null {
  const inv = venueInvitation(token);
  if (!inv) return null;
  const venue = getDb().prepare('SELECT account_id, is_demo, archived_at FROM venues WHERE id = ?').get(inv.venue_id) as { account_id: number; is_demo: number; archived_at: string | null } | undefined;
  if (!venue) return null;
  const record = venueRecordRequirements(venue.account_id, inv.venue_id);
  const editable = Boolean(record?.editable) && !venue.archived_at;
  const unexpired = new Date(inv.expires_at).getTime() > Date.now();
  // Open for a response: nominated, unexpired, on a venue still in preparation.
  const open = inv.status === 'nominated' && unexpired && editable;
  return { inv, ownerId: venue.account_id, isDemo: venue.is_demo === 1, open, editable, archived: Boolean(venue.archived_at) };
}

export function venueNominationBriefing(token: string): VenueNominationBriefing | null {
  const state = venueInvitationState(token);
  if (!state) return null;
  const { inv, ownerId } = state;
  const venue = venueById(ownerId, inv.venue_id);
  if (!venue) return null;
  const record = venueRecordRequirements(ownerId, inv.venue_id);
  const org = getDb().prepare('SELECT name_en, name_ar FROM organizations WHERE account_id = ?').get(ownerId) as { name_en: string; name_ar: string } | undefined;
  const geo = getDb().prepare('SELECT district FROM venues WHERE id = ?').get(inv.venue_id) as { district: string | null } | undefined;
  const parties = venueInvitations(inv.venue_id)
    .filter((i) => i.status !== 'withdrawn')
    .map((i) => ({ kind: i.kind, nameEn: i.name, nameAr: i.name, status: i.status as 'nominated' | 'confirmed' | 'declined', isThisOne: i.token === token }));
  return {
    venueNameEn: venue.nameEn,
    venueNameAr: venue.nameAr,
    operatorNameEn: org?.name_en || null,
    operatorNameAr: org?.name_ar || null,
    venueType: venueTypeLabel(venue.category),
    municipalityEn: venue.addressMunicipalityEn,
    municipalityAr: venue.addressMunicipalityAr || venue.addressMunicipalityEn,
    district: geo?.district ? venueDistrictLabel(geo.district) : null,
    licensedCapacity: venue.licensedCapacity,
    level: record?.level ?? null,
    rows: record && record.level !== null ? rowsForVenueParty(record.instances, inv.kind) : [],
    otherParties: parties,
  };
}
