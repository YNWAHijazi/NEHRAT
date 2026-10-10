import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';

/**
 * EVENTS LINK TO SITES (owner, 9 October 2026: "Link between event and facility, no longer
 * venue"; latest revision, sections 1, 16 and 17).
 *
 * - The location field lists registered Facility/Sites -- not archived, on the account's side
 *   of the demonstration line, name, municipality and Site ID only -- and the server refuses a
 *   site that is not on that list. Choosing one stores events.site_id; the facility standing on
 *   the site becomes the event's facility reference (events.venue_facility_id).
 * - The site's information is reused only on the organizer's confirmation; the AEDs only on
 *   the organizer's answer in the CPR and AED step. Nothing is inherited: the level is the
 *   event's own.
 * - Filing freezes the Site information relied on; a later change to the site does not alter it.
 * - The site's operator sees other organizers' events at the site: name, dates, record ID,
 *   where each stands for the site (planned, scheduled, postponed) only.
 */
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', async (original) => ({ ...(await original<typeof import('../lib/auth')>()), currentAccount: async () => session.account }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('not-found'); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { siteIdForFacility } from '../lib/sites';
import {
  eventsAtSitesOf, isListableSite, resolveSiteChoice, siteConfirmationFor, siteForEvent, siteInformation, siteOptionFor, siteOptions, siteSnapshotFor,
} from '../lib/event-site';
import { matchSites, textNamesSite } from '../lib/site-match';
import { saveFacilityInfrastructure } from '../lib/site-infrastructure';
import { applySiteLayoutMapAction, confirmSiteInformationAction, createEventAction, editEventDetailsAction, updateDraftEventAction, type AssessmentSubmission } from '../app/actions';
import { saveRequirementAnswerAction } from '../app/record-actions';
import { eventRecordRequirements, writeRequirementSnapshot } from '../lib/record-facts';
import { eventRecordView } from '../lib/record-view';
import { FACILITY_REFERENCE_KEY, fieldsFor, siteAedAnswer } from '../lib/rules';

const folder = mkdtempSync(join(tmpdir(), 'moph-event-site-'));
let organizer = 0;
let other = 0;
let realId = 0;
let site14 = '';
let site21 = '';
beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  const db = getDb();
  organizer = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`).get() as { id: number }).id;
  other = (db.prepare(`SELECT id FROM accounts WHERE login = 'demo_byblos'`).get() as { id: number }).id;
  realId = Number(db.prepare(`INSERT INTO accounts (login, display_name, role, is_demo) VALUES ('real_org', 'Real organizer', 'organizer', 0)`).run().lastInsertRowid);
  db.prepare(`INSERT INTO facilities (id, account_id, name_en, name_ar, municipality_en, municipality_ar, phone, email, is_demo) VALUES ('FC-0900', ?, 'Real Arena', 'الحلبة الحقيقية', 'Jounieh', 'جونيه', '+961 9 000 000', 'private@arena.example', 0)`).run(realId);
  db.prepare(`INSERT INTO facilities (id, account_id, name_en, name_ar, municipality_en, municipality_ar, is_demo, archived_at) VALUES ('FC-0901', ?, 'Closed Arena', 'الحلبة المغلقة', 'Jounieh', 'جونيه', 0, '2026-08-01')`).run(realId);
  site14 = siteIdForFacility('FC-0014')!;
  site21 = siteIdForFacility('FC-0021')!;
  siteIdForFacility('FC-0900');
  siteIdForFacility('FC-0901');
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

function as(login: string) {
  const row = getDb().prepare(`SELECT id, role, is_demo FROM accounts WHERE login = ?`).get(login) as { id: number; role: Account['role']; is_demo: number };
  session.account = { id: row.id, role: row.role, login, displayName: login, initials: 'T', isDemo: row.is_demo === 1 };
}
function payload(siteId: string | null, name = 'Hosted concert'): AssessmentSubmission {
  return {
    nameEn: name, nameAr: 'حفل مستضاف', startDate: '2026-12-01', endDate: '2026-12-01',
    partA: {
      eventType: 'Concert', venueRoute: 'Hall', municipalities: 'Beirut', openingTime: '19:00', closingTime: '23:00',
      expectedParticipants: 10, expectedSpectators: 1400, expectedStaff: 20, previousEdition: false, recurringFixedVenue: true, siteId,
    },
    answers: [1, 1, 1, 1, 1, 1, 0, 0, 0],
    inputs: { expectedMaxSimultaneousAttendance: 1430, eventDisciplines: [], courseDistanceKm: null, venueLicensedCapacity: null, venueIsNightclubOrDanceVenue: false },
    representative: 'R. Haddad', position: 'Director',
  };
}
const row = (eventId: string) =>
  getDb().prepare(`SELECT site_id, venue_facility_id FROM events WHERE id = ?`).get(eventId) as { site_id: string | null; venue_facility_id: string | null };
function form(values: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; }

describe('which sites are listable', () => {
  it('lists unarchived Facility/Sites on the account’s side of the demonstration line, with no contact details', () => {
    const demo = siteOptions(true);
    expect(demo.map((o) => o.id)).toEqual(expect.arrayContaining([site14, site21]));
    expect(demo.map((o) => o.facilityId)).not.toContain('FC-0900');
    const real = siteOptions(false);
    expect(real).toEqual([{ id: siteIdForFacility('FC-0900'), facilityId: 'FC-0900', nameEn: 'Real Arena', nameAr: 'الحلبة الحقيقية', municipalityEn: 'Jounieh', municipalityAr: 'جونيه' }]);
    expect(JSON.stringify(real)).not.toMatch(/961|private@|example/);
  });

  it('refuses an unknown id, a malformed id, an archived facility and a site across the demonstration line', () => {
    expect(isListableSite('SITE-999999', true)).toBe(false);
    expect(isListableSite('VN-0032', true)).toBe(false);
    expect(isListableSite(siteIdForFacility('FC-0901')!, false)).toBe(false);
    expect(isListableSite(site14, false)).toBe(false);
    expect(isListableSite(siteIdForFacility('FC-0900')!, true)).toBe(false);
    expect(isListableSite(site14, true)).toBe(true);
    expect(resolveSiteChoice('', true)).toEqual({ ok: true, siteId: null });
    expect(resolveSiteChoice(null, false)).toEqual({ ok: true, siteId: null });
    expect(resolveSiteChoice('SITE-999999', true)).toEqual({ ok: false });
    expect(resolveSiteChoice(site14, true)).toEqual({ ok: true, siteId: site14 });
  });

  it('opens /events/new?site= linked only to a site the account may choose', () => {
    expect(siteOptionFor(site14, true)?.facilityId).toBe('FC-0014');
    expect(siteOptionFor(site14, false)).toBeNull();
    expect(siteOptionFor('SITE-999999', true)).toBeNull();
  });

  it('matches by name in either language and Site ID; the full list also by municipality; never links by name', () => {
    const options = [
      { id: 'SITE-000001', facilityId: 'FC-1', nameEn: 'Forum de Beyrouth', nameAr: 'فوروم دو بيروت', municipalityEn: 'Beirut', municipalityAr: 'بيروت' },
      { id: 'SITE-000002', facilityId: 'FC-2', nameEn: 'Casino Hall', nameAr: 'قاعة الكازينو', municipalityEn: 'Jounieh', municipalityAr: 'جونيه' },
    ];
    expect(matchSites(options, 'forum').map((o) => o.id)).toEqual(['SITE-000001']);
    expect(matchSites(options, 'الكازينو').map((o) => o.id)).toEqual(['SITE-000002']);
    expect(matchSites(options, 'site-000002').map((o) => o.id)).toEqual(['SITE-000002']);
    expect(matchSites(options, 'Jounieh')).toEqual([]);
    expect(matchSites(options, 'Jounieh', { includeMunicipality: true }).map((o) => o.id)).toEqual(['SITE-000002']);
    expect(textNamesSite('Casino Hall', options[1]!)).toBe(true);
    expect(textNamesSite('Casino Hall, terrace', options[1]!)).toBe(false);
  });
});

describe('the event actions store the link by Site ID and refuse what is not listable', () => {
  it('creates an event at a site: the site is stored and its facility becomes the reference', async () => {
    as('test_organizer');
    const created = await createEventAction(payload(site21));
    if (!('eventId' in created)) throw new Error(JSON.stringify(created));
    expect(row(created.eventId)).toEqual({ site_id: site21, venue_facility_id: 'FC-0021' });
    expect(siteForEvent(created.eventId)).toMatchObject({ siteId: site21, facilityId: 'FC-0021' });
    expect(await createEventAction(payload('SITE-999999'))).toEqual({ error: 'site' });
    expect(await createEventAction(payload(siteIdForFacility('FC-0900')!))).toEqual({ error: 'site' });
    // No site: a route or an unregistered place names none, and references nothing.
    const route = await createEventAction(payload(null, 'Coastal run'));
    if (!('eventId' in route)) throw new Error('not created');
    expect(row(route.eventId)).toEqual({ site_id: null, venue_facility_id: null });
  });

  it('changes and removes the link from the edit form and the draft, keeping the reference in step', async () => {
    as('test_organizer');
    const created = await createEventAction(payload(site21, 'Moving event'));
    if (!('eventId' in created)) throw new Error('not created');
    const id = created.eventId;
    await expect(editEventDetailsAction(id, form({ nameEn: 'Moving event', nameAr: 'فعالية', startDate: '2026-12-01', endDate: '2026-12-01', siteId: site14 }))).rejects.toThrow('details-saved');
    expect(row(id)).toEqual({ site_id: site14, venue_facility_id: 'FC-0014' });
    await expect(editEventDetailsAction(id, form({ nameEn: 'Moving event', nameAr: 'فعالية', startDate: '2026-12-01', endDate: '2026-12-01', siteId: 'SITE-999999' }))).rejects.toThrow(`/events/${id}/edit?error=site`);
    expect(row(id).site_id).toBe(site14);
    expect(await updateDraftEventAction(id, payload(null, 'Moving event'))).toEqual({ eventId: id });
    expect(row(id)).toEqual({ site_id: null, venue_facility_id: null });
  });

  it('an older facility reference names the facility’s site (the demonstration event EV-0418)', () => {
    expect(row('EV-0418')).toEqual({ site_id: site14, venue_facility_id: 'FC-0014' });
  });
});

describe('reuse on the event: confirmed once, never inherited', () => {
  let id = '';
  beforeAll(async () => {
    as('test_organizer');
    saveFacilityInfrastructure('FC-0014', { emergencyAccess: 'Gate 3 from the coastal road', patientAccess: 'Service corridor to gate 3', stretcherRoutes: 'Ramp beside the east stand' }, organizer, '2026-08-10 09:00:00');
    getDb().prepare(`INSERT INTO facility_documents (facility_id, purpose, file_name, content_type, bytes, uploaded_by, uploaded_at) VALUES ('FC-0014', 'layoutMap', 'site-layout.pdf', 'application/pdf', ?, ?, '2026-08-10 09:00:00')`).run(Buffer.from('%PDF-1.4 layout'), organizer);
    const created = await createEventAction(payload(site14, 'Concert at the stadium'));
    if (!('eventId' in created)) throw new Error('not created');
    id = created.eventId;
  });

  it('reads the site’s identity, place, capacity, map, access and AEDs from the site record', () => {
    const info = siteInformation(site14)!;
    expect(info).toMatchObject({ siteId: site14, facilityId: 'FC-0014', emergencyAccess: 'Gate 3 from the coastal road', patientAccess: 'Service corridor to gate 3', layoutMap: { fileName: 'site-layout.pdf' } });
    expect(info.aeds.length).toBe(3);
    expect(info.aeds.every((a) => a.statusEn !== '')).toBe(true);
  });

  it('uses nothing until the organizer confirms; then the patient access row is prefilled and still the organizer’s to change', async () => {
    const rec = () => eventRecordRequirements(organizer, id)!;
    expect(rec().level).not.toBeNull();
    expect(rec().facts!.site).toMatchObject({ confirmed: false, aedReuse: false });
    expect(rec().instances.find((i) => i.key === 'B11')!.values['route']).toBeUndefined();
    await expect(applySiteLayoutMapAction(id)).rejects.toThrow('error=forbidden');
    await expect(confirmSiteInformationAction(id, form({ applies: 'yes', differences: 'A temporary stage on the north lawn.' }))).rejects.toThrow(`/events/${id}?saved=site`);
    expect(siteConfirmationFor(id)).toMatchObject({ siteId: site14, differences: 'A temporary stage on the north lawn.' });
    const b11 = rec().instances.find((i) => i.key === 'B11')!;
    expect(b11.values['route']).toBe('Service corridor to gate 3 — Ramp beside the east stand');
    expect(b11.state).toBe('complete');
    expect(await saveRequirementAnswerAction('event', id, 'B11', { baseVersion: 0, values: { route: 'Our own route through gate 1' } })).toEqual({ ok: true, version: 1 });
    expect(rec().instances.find((i) => i.key === 'B11')!.values['route']).toBe('Our own route through gate 1');
    // The site map is copied into the event only on request, once confirmed.
    if (rec().instances.some((i) => i.key === 'P-M' && i.file)) {
      await expect(applySiteLayoutMapAction(id)).rejects.toThrow('saved=P-M');
      expect(rec().facts!.files['P-M']?.fileName).toBe('site-layout.pdf');
    }
    // Unticked, the confirmation is withdrawn and the prefill goes with it.
    await expect(confirmSiteInformationAction(id, form({}))).rejects.toThrow('saved=site');
    expect(siteConfirmationFor(id)).toBeNull();
  });

  it('asks about the site’s AEDs at every level: Yes reuses them for the AED part, No leaves the event its own', async () => {
    const rec = () => eventRecordRequirements(organizer, id)!;
    expect(fieldsFor(FACILITY_REFERENCE_KEY, 1, 'event')?.map((f) => f.key)).toEqual(['reuse', 'admitsChildren', 'temporaryAreas']);
    expect(fieldsFor(FACILITY_REFERENCE_KEY, 2, 'venue')).toBeNull();
    const level = rec().level!;
    const b8 = () => rec().instances.find((i) => i.key === 'B8')!;
    const aedField = b8().fields.find((f) => f.key === 'aed');
    expect(b8().values['aed']).toBeUndefined();
    expect(await saveRequirementAnswerAction('event', id, 'REF', { baseVersion: 0, values: { reuse: 'yes' } })).toEqual({ ok: true, version: 1 });
    expect(siteAedAnswer(rec().facts!.answers[FACILITY_REFERENCE_KEY]?.values)).toBe('yes');
    expect(rec().facts!.site?.aedReuse).toBe(true);
    if (aedField) expect(b8().values['aed']).toBe(aedField.type === 'checkbox' ? true : 'yes');
    if (b8().fields.some((f) => f.key === 'location')) expect(String(b8().values['location'])).toContain(siteInformation(site14)!.aeds[0]!.locationEn);
    expect(b8().detailEn).toBe('Uses the site’s registered AEDs.');
    expect(await saveRequirementAnswerAction('event', id, 'REF', { baseVersion: 1, values: { reuse: 'no' } })).toEqual({ ok: true, version: 2 });
    expect(rec().facts!.site?.aedReuse).toBe(false);
    expect(b8().values['aed']).toBeUndefined();
    // The level is the event's own: the site carries none.
    expect(rec().level).toBe(level);
    // An answer from before the question was asked this way reads as Yes.
    expect(siteAedAnswer({ confirmed: true })).toBe('yes');
    expect(eventRecordView(organizer, id)!.facility).toMatchObject({ nameEn: siteInformation(site14)!.nameEn, devices: 3 });
  });

  it('a different site asks again: the confirmation and the AED answer do not carry', async () => {
    await expect(confirmSiteInformationAction(id, form({ applies: 'yes' }))).rejects.toThrow('saved=site');
    expect(siteConfirmationFor(id)).not.toBeNull();
    getDb().prepare(`UPDATE events SET site_id = ? WHERE id = ?`).run(site21, id);
    expect(siteConfirmationFor(id)).toBeNull();
    expect(eventRecordRequirements(organizer, id)!.facts!.answers[FACILITY_REFERENCE_KEY]).toBeUndefined();
    const history = getDb().prepare(`SELECT COUNT(*) AS n FROM requirement_answer_history WHERE record_kind = 'event' AND record_id = ? AND key = 'REF'`).get(id) as { n: number };
    expect(history.n).toBeGreaterThan(0);
    getDb().prepare(`UPDATE events SET site_id = ? WHERE id = ?`).run(site14, id);
  });

  it('filing freezes the site information relied on; a later change to the site does not alter it', async () => {
    await expect(confirmSiteInformationAction(id, form({ applies: 'yes', differences: 'Extra first-aid tent.' }))).rejects.toThrow('saved=site');
    expect(await saveRequirementAnswerAction('event', id, 'REF', { baseVersion: 0, values: { reuse: 'yes' } })).toEqual({ ok: true, version: 1 });
    writeRequirementSnapshot('event', eventRecordRequirements(organizer, id)!, 1);
    const frozen = siteSnapshotFor(id, 1)!;
    expect(frozen).toMatchObject({
      submissionVersion: 1, siteId: site14, facilityId: 'FC-0014', aedReuse: 'yes',
      confirmation: { confirmed: true, differences: 'Extra first-aid tent.' },
      information: { emergencyAccess: 'Gate 3 from the coastal road' },
    });
    expect(frozen.information.aeds.length).toBe(3);
    saveFacilityInfrastructure('FC-0014', { emergencyAccess: 'Gate 9 only' }, organizer, '2026-08-12 09:00:00');
    expect(siteSnapshotFor(id, 1)!.information.emergencyAccess).toBe('Gate 3 from the coastal road');
    expect(siteInformation(site14)!.emergencyAccess).toBe('Gate 9 only');
    // An event without a site freezes no site snapshot.
    const plain = await createEventAction(payload(null, 'Route event'));
    if (!('eventId' in plain)) throw new Error('not created');
    writeRequirementSnapshot('event', eventRecordRequirements(organizer, plain.eventId)!, 1);
    expect(siteSnapshotFor(plain.eventId)).toBeNull();
  });
});

describe('events at your sites', () => {
  it('lists other organizers’ events at the operator’s sites: name, dates, record ID and where each stands for the site', async () => {
    as('demo_byblos');
    const theirs = await createEventAction(payload(site21, 'Byblos at the arena'));
    if (!('eventId' in theirs)) throw new Error('not created');
    const groups = eventsAtSitesOf(organizer, true);
    const group = groups.find((g) => g.siteId === site21)!;
    expect(group.events.map((e) => e.id)).toEqual([theirs.eventId]);
    expect(Object.keys(group.events[0]!).sort()).toEqual(['endDate', 'id', 'nameAr', 'nameEn', 'stage', 'startDate', 'statusAr', 'statusEn']);
    // The organizer's own events at the site are already in their own list.
    expect(groups.flatMap((g) => g.events).every((e) => (getDb().prepare(`SELECT account_id FROM events WHERE id = ?`).get(e.id) as { account_id: number }).account_id !== organizer)).toBe(true);
    // Another account holds no site: nothing to list; the real side sees nothing of the demonstration side.
    expect(eventsAtSitesOf(other, true)).toEqual([]);
    expect(eventsAtSitesOf(realId, false)).toEqual([]);
    // A cancelled event leaves the list.
    getDb().prepare(`UPDATE events SET lifecycle = 'cancelled' WHERE id = ?`).run(theirs.eventId);
    expect(eventsAtSitesOf(organizer, true).flatMap((g) => g.events).map((e) => e.id)).not.toContain(theirs.eventId);
  });
});
