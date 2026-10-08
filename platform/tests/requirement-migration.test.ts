/**
 * The one-time migration of the answers the platform stored BEFORE the single record
 * page (brief item 19): old keys map to the catalogue's; what had no answer stays
 * pending; re-running writes nothing twice. Synthetic legacy rows, because the
 * demonstration seeder now writes the new shapes.
 */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from '../lib/db';
import { migrateLegacyRequirementAnswers } from '../lib/requirement-migration';
import { eventRecordRequirements, venueRecordRequirements } from '../lib/record-facts';

const folder = mkdtempSync(join(tmpdir(), 'moph-migration-'));
let owner: number;
const answers = (kind: string, id: string) =>
  Object.fromEntries((getDb().prepare('SELECT key, answers, author_role FROM requirement_answers WHERE record_kind = ? AND record_id = ? ORDER BY key').all(kind, id) as { key: string; answers: string; author_role: string }[])
    .map((r) => [r.key, { ...JSON.parse(r.answers) as Record<string, unknown>, by: r.author_role }]));

beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  const db = getDb();
  owner = (db.prepare("SELECT id FROM accounts WHERE login = 'test_organizer'").get() as { id: number }).id;
  const ems = db.prepare("SELECT id FROM accounts WHERE login = 'test_ems'").get() as { id: number };
  // A Level 2 event in the OLD shapes: a written plan with two sections, the facility
  // reference confirmed, an agency's operational detail, an insurance block on the form.
  db.prepare("INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo) VALUES ('EV-9100', ?, 'Legacy fair', 'معرض قديم', '2026-11-20', '2026-11-20', 1)").run(owner);
  // Six domains at 1: band 6-11, Level 2 by the domains; no minimum condition fires (the level is derived at read).
  db.prepare("INSERT INTO assessments (event_id, version, answers, inputs, derivation) VALUES ('EV-9100', 1, '[1,1,1,1,1,1,0,0,0]', ?, '{}')")
    .run(JSON.stringify({ expectedMaxSimultaneousAttendance: 800, eventDisciplines: [], courseDistanceKm: null, venueLicensedCapacity: null, venueIsNightclubOrDanceVenue: false }));
  db.prepare("INSERT INTO plans (event_id, mode, ref_confirmed, ref_admits_children, sections, major_incident, version, updated_at) VALUES ('EV-9100', 'write', 1, 1, ?, ?, 2, '2026-09-01 10:00:00')")
    .run(JSON.stringify({ '13': { text: 'Heat plan: shaded rest areas and water points.' }, '1': { text: 'A day fair on the corniche.' }, '12': { covered: true } }), JSON.stringify({ '1': { covered: true } }));
  db.prepare("INSERT INTO invitations (token, event_id, kind, name_en, email, status, account_id, ops_detail, answered_at) VALUES (?, 'EV-9100', 'ems', 'Legacy Ambulance', 'legacy@ems.example.test', 'confirmed', ?, ?, '2026-09-02 09:00:00')")
    .run('a'.repeat(48), ems.id, JSON.stringify({ ambulances: 'One ambulance at the north gate', deployment: '08:00-18:00', contactName: 'Dispatcher', phone: '+961 3 000000', teams: 'Two BLS teams', hospitals: 'Rafik Hariri UH', communications: 'Radio channel 4', access: 'Service road', escalation: 'Dispatcher calls the hospital' }));
  db.prepare("INSERT INTO submissions (event_id, insurance, representative) VALUES ('EV-9100', ?, 'R. Haddad')").run(JSON.stringify({ insurer: 'Cedar Assurance', policyNumber: 'CA-1', coveragePeriod: '2026', evidence: 'yes' }));
  // A venue in the OLD shapes: numbered rows in the package, a numbered attachment key.
  db.prepare("INSERT INTO venues (id, account_id, name_en, name_ar, is_demo) VALUES ('VN-9100', ?, 'Legacy hall', 'قاعة قديمة', 1)").run(owner);
  db.prepare("INSERT INTO venue_packages (venue_id, answers) VALUES ('VN-9100', ?)").run(JSON.stringify({ '7': { arrangements: 'Local station on call', phone: '+961 1 111111', localConfirmed: 'yes' }, '5': { teams: 'One BLS team' }, '2': { preparedBy: 'nobody' } }));
  db.prepare("INSERT INTO venue_attachments (venue_id, doc_key, file_name, content_type, byte_size, bytes) VALUES ('VN-9100', '17', 'policy.pdf', 'application/pdf', 4, X'25504446')").run();
  migrateLegacyRequirementAnswers(db);
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

test('old event answers land on the catalogue keys they stand for, with their author', () => {
  const a = answers('event', 'EV-9100');
  expect(a['P13']).toEqual({ text: 'Heat plan: shaded rest areas and water points.', by: 'ems' });
  expect(a['P01']).toEqual({ text: 'A day fair on the corniche.', by: 'ems' });
  // A "covered" tick is a tick, not an answer: section 12 and the major-incident item carry nothing.
  expect(a['P12']).toBeUndefined();
  expect(a['M01']).toBeUndefined();
  expect(a['REF']).toEqual({ confirmed: true, admitsChildren: true, temporaryAreas: false, by: 'organizer' });
  expect(a['B7']).toEqual({ whereWhen: 'One ambulance at the north gate — 08:00-18:00', howToCall: 'Dispatcher · +961 3 000000', by: 'ems' });
  expect(a['B5']).toEqual({ team: 'Legacy Ambulance', coverage: 'Two BLS teams', by: 'ems' });
  expect(a['B12']).toEqual({ department: 'Rafik Hariri UH', by: 'ems' });
  expect(a['B14']).toEqual({ method: 'Radio channel 4', by: 'ems' });
  expect(a['B11']).toEqual({ route: 'Service road', by: 'ems' });
  expect(a['B16']).toEqual({ when: 'Dispatcher calls the hospital', by: 'ems' });
  // The insurance facts come across; the old "evidence: yes" word does not become a file.
  expect(a['B17']).toEqual({ insurer: 'Cedar Assurance', policyNumber: 'CA-1', coveragePeriod: '2026', by: 'organizer' });
});

test('nothing migrated reads as complete unless the catalogue\'s own completion test is met', () => {
  const r = eventRecordRequirements(owner, 'EV-9100')!;
  const state = (key: string) => r.instances.find((i) => i.key === key)!.state;
  // The EMS row's two migrated facts are the whole Level 2 answer now (partner audit, 8 October 2026);
  // the legacy team row carries neither the BLS nor the first-aid confirmation, so it stays pending.
  expect(state('B7')).toBe('complete');
  expect(state('B5')).toBe('pending');
  expect(r.instances.find((i) => i.key === 'B5')!.missing).toEqual(['bls', 'firstAid']);
  // The receiving department alone completes the hospital row now; its contact is optional.
  expect(state('B12')).toBe('complete');
  // A section answered by text is addressed; one answered by a structured row waits on that row.
  expect(r.plan.find((s) => s.key === 'P13')!.complete).toBe(true);
  expect(r.plan.find((s) => s.key === 'P12')!.complete).toBe(false);
  // Level 2: insurance is not a row, so the migrated facts wait unseen until a Level 3 record reads them.
  expect(r.instances.find((i) => i.key === 'B17')).toBeUndefined();
});

test('old venue rows take the catalogue keys, a confirmed local contact stays a confirmation, and files keep their bytes', () => {
  const db = getDb();
  const a = answers('venue', 'VN-9100');
  expect(a['B7']).toEqual({ whereWhen: 'Local station on call', phone: '+961 1 111111', howToCall: '+961 1 111111', contacted: true, by: 'organizer' });
  expect(a['B5']).toEqual({ team: 'One BLS team', by: 'organizer' });
  // Row 2 has no field map: an old free-text "prepared by" is not a plan.
  expect(a['B2']).toBeUndefined();
  expect(db.prepare("SELECT doc_key, file_name, length(bytes) AS n FROM venue_attachments WHERE venue_id = 'VN-9100'").all()).toEqual([{ doc_key: 'B17', file_name: 'policy.pdf', n: 4 }]);
  // No assessment yet: the record has no level and nothing is claimed complete.
  expect(venueRecordRequirements(owner, 'VN-9100')!.level).toBeNull();
});

test('re-running the migration writes nothing twice and overwrites nothing newer', () => {
  const db = getDb();
  const before = (db.prepare('SELECT count(*) AS n FROM requirement_answers').get() as { n: number }).n;
  db.prepare("UPDATE requirement_answers SET answers = ?, version = 2 WHERE record_kind = 'event' AND record_id = 'EV-9100' AND key = 'P13'").run(JSON.stringify({ text: 'Revised on the record page.' }));
  migrateLegacyRequirementAnswers(db);
  expect((db.prepare('SELECT count(*) AS n FROM requirement_answers').get() as { n: number }).n).toBe(before);
  expect(answers('event', 'EV-9100')['P13']).toEqual({ text: 'Revised on the record page.', by: 'ems' });
});
