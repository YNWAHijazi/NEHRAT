/**
 * The demonstration seeder.
 *
 * Creates the role-set demonstration accounts and their records -- the content the
 * reference prototypes show, so the Ministry can walk the platform without creating
 * records. Every row carries is_demo = 1 and is excluded from the national registry,
 * every Ministry aggregate and every reviewer queue (lib/rules/scope.ts).
 *
 * NEVER runs in a deployed environment: the only call site is guarded on NODE_ENV in
 * lib/db.ts, and no environment variable re-enables it.
 *
 * DATES ARE SHIFTED. The reference prototypes pin their "today" to 2026-08-13 and place
 * every demonstration date relative to it. This seeder re-anchors those dates to the
 * real current date in Asia/Beirut, so a demonstration dashboard always shows the same
 * day-counts and urgency states the reference shows -- a walkthrough that decays with
 * the calendar demonstrates nothing.
 *
 * One account per state (handoff 4, decision 6): the showcase organizer is RECORDED and
 * holds the filed submissions; a separate demonstration organizer shows the organization
 * pending with nothing filed. The prototype's conflation of the two was the author's
 * error, acknowledged, and is not preserved here.
 */

import type { DatabaseSync } from 'node:sqlite';
import { beirutToday } from './clock';
import { demonstrationPdf } from './demo-pdf';
import { NEHRAT_TOOL_VERSION } from './rules';

/** The prototype's pinned "today". */
const REFERENCE_TODAY = '2026-08-13';

function shiftDays(): number {
  const ref = Date.parse(`${REFERENCE_TODAY}T00:00:00Z`);
  const today = Date.parse(`${beirutToday()}T00:00:00Z`);
  return Math.round((today - ref) / 86_400_000);
}

/** A reference date, re-anchored to the real today. */
function sh(referenceDate: string, shift: number): string {
  const t = new Date(Date.parse(`${referenceDate}T00:00:00Z`) + shift * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/**
 * THE COUNTERPARTY LINKAGE, repairable on its own. The invitation→account linkage
 * entered the seeder after the accounts and invitations did, and the seeder's guard is
 * all-or-nothing: a database seeded before then keeps test_ems and test_director with
 * zero linked nominations forever, which renders both role dashboards empty — the
 * defect the partner review reported. Guarded on account_id IS NULL so it never
 * clobbers a row a walkthrough has since acted on, it is safe to run on every boot
 * and from the provisioning command alike. It links what exists: a database missing
 * the demonstration invitation rows themselves needs a reseed, not a repair.
 */
export function linkDemonstrationCounterparties(db: DatabaseSync): number {
  const account = (login: string): number | null =>
    (db.prepare(`SELECT id FROM accounts WHERE login = ? AND is_demo = 1`).get(login) as
      | { id: number }
      | undefined)?.id ?? null;
  const ems = account('test_ems');
  const director = account('test_director');
  const shift = shiftDays();
  let changed = 0;

  if (ems !== null) {
    changed += db
      .prepare(`UPDATE invitations SET account_id = ? WHERE token = 'demo-lrc-beirut-0418' AND account_id IS NULL`)
      .run(ems).changes as number;
    changed += db
      .prepare(
        `UPDATE invitations SET account_id = ?, declaration = 'signed',
           declaration_items = ?, certification = ?, signed_at = ?
         WHERE token = 'demo-lrc-baalbeck-0362' AND account_id IS NULL`,
      )
      .run(
        ems,
        JSON.stringify(Array.from({ length: 10 }, () => true)),
        JSON.stringify({
          provider: 'Lebanese Red Cross — Beirut branch',
          representative: 'S. Karam',
          position: 'Branch operations director',
          phone: '03 774 120',
          date: sh('2026-08-13', shift),
        }),
        sh('2026-08-13', shift),
      ).changes as number;
  }
  if (director !== null) {
    changed += db
      .prepare(
        `UPDATE invitations SET account_id = ? WHERE token IN ('demo-director-0362', 'demo-director-0244') AND account_id IS NULL`,
      )
      .run(director).changes as number;
  }
  return changed;
}

export function seedDemonstration(db: DatabaseSync): void {
  const seeded = db
    .prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`)
    .get() as { id: number } | undefined;
  if (seeded) {
    // Already provisioned — but repair the counterparty linkage a pre-linkage
    // database is missing, so a standing instance heals on boot instead of showing
    // the demonstration EMS and Director accounts empty dashboards.
    linkDemonstrationCounterparties(db);
    return;
  }

  const shift = shiftDays();
  const d = (ref: string): string => sh(ref, shift);

  /**
   * Every seeded attachment carries REAL BYTES, because the platform now stores
   * files and a demonstration name with nothing behind it makes the showcase read
   * as broken -- the Ministry clicks Open on the route map and is told there is no
   * route map. The bytes are a generated placeholder PDF that says on its face what
   * it is, so nobody mistakes it for an operational document.
   */
  /** Bytes plus length for a shared-list row, in the column order the insert wants. */
  const sharedPdf = (title: string, subtitle: string): [number, Buffer] => {
    const pdf = demonstrationPdf(title, subtitle);
    return [pdf.length, pdf];
  };

  const attachWithFile = (
    eventId: string,
    docKey: string,
    fileName: string,
    title: string,
    subtitle: string,
  ): void => {
    const pdf = demonstrationPdf(title, subtitle);
    db.prepare(
      `INSERT INTO event_attachments (event_id, doc_key, file_name, content_type, byte_size, bytes)
       VALUES (?, ?, ?, 'application/pdf', ?, ?)`,
    ).run(eventId, docKey, fileName, pdf.length, pdf);
  };

  const insertAccount = db.prepare(
    `INSERT INTO accounts (login, display_name, initials, role, is_demo) VALUES (?, ?, ?, ?, 1)`,
  );

  // The six role-set demonstration logins from SPEC 3b. Only the organizer surface is
  // built in Slice 1; the other five accounts exist so sign-in offers them, and their
  // dashboards arrive with their slices.
  const organizer = insertAccount.run('test_organizer', 'R. Haddad', 'RH', 'organizer')
    .lastInsertRowid as number;
  const organizerPending = insertAccount.run(
    'test_organizer_pending', 'S. Khoury', 'SK', 'organizer',
  ).lastInsertRowid as number;
  const ems = insertAccount.run('test_ems', 'S. Karam', 'SK', 'ems').lastInsertRowid as number;
  const director = insertAccount.run('test_director', 'Dr N. Salameh', 'NS', 'director').lastInsertRowid as number;
  const response = insertAccount.run('test_response', 'M. Aoun', 'MA', 'response').lastInsertRowid as number;
  insertAccount.run('test_moph', 'L. Nassar', 'LN', 'reviewer');
  insertAccount.run('test_moph_admin', 'R. Sfeir', 'RS', 'ministry_admin');
  insertAccount.run('test_owner', 'Platform operations', 'PO', 'platform_owner');
  // Listed on Users and roles; holds no sign-in button. Its access follows the
  // Order lane: off (the default) shows it suspended, not active.
  insertAccount.run('order_reviewer', 'Dr Y. Salameh', 'YS', 'order');

  // The showcase account: recorded, and it holds the filed submissions below.
  db.prepare(
    `INSERT INTO organizations (account_id, name_en, name_ar, status, recorded_at, is_demo)
     VALUES (?, ?, ?, 'recorded', ?, 1)`,
  ).run(organizer, 'Beirut Road Runners', 'عدّاؤو بيروت', d('2026-08-06'));

  // The pending-state account: organization filed, awaiting recording, nothing else.
  // Demonstrates the registration banner, the pending header line and the blocked
  // Submit without contradicting the recorded showcase.
  db.prepare(
    `INSERT INTO organizations (account_id, name_en, name_ar, status, is_demo)
     VALUES (?, ?, ?, 'pending', 1)`,
  ).run(organizerPending, 'Mount Lebanon Trail Association', 'جمعية دروب جبل لبنان');

  // A SECOND recorded organizer, holding exactly one event: the filed-and-unreviewed
  // submission the console needs so a grey internal state can be walked. It cannot
  // belong to the showcase organizer -- that account's dashboard is a pixel-compared
  // surface showing FOUR events, and a fifth pushed everything below it down the page.
  // The reference's own queue carries three different organizers, so a second one is
  // closer to it, not further away. This account holds no sign-in button.
  const organizerQueue = insertAccount.run(
    'demo_byblos', 'Byblos Municipality', 'BM', 'organizer',
  ).lastInsertRowid as number;
  db.prepare(
    `INSERT INTO organizations (account_id, name_en, name_ar, status, recorded_at, is_demo)
     VALUES (?, ?, ?, 'recorded', ?, 1)`,
  ).run(organizerQueue, 'Byblos Municipality', 'بلدية جبيل', d('2026-07-02'));

  // The four demonstration events the reference dashboard shows. EV-0455 below is a
  // FIFTH event and belongs to the second organizer above, deliberately, so this
  // dashboard still shows four.
  const insertEvent = db.prepare(
    `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date,
       moph_reference, filed,
       demo_state_en, demo_state_ar, demo_due, demo_due_label_en, demo_due_label_ar,
       demo_stage, demo_stage_en, demo_stage_ar, demo_stages, demo_span, demo_level,
       is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  );

  insertEvent.run(
    'EV-0418', organizer, 'Beirut Coastal 12K', 'بيروت الساحلي 12 كلم',
    d('2026-10-02'), d('2026-10-02'), null, 0,
    'Assessed — not submitted', 'مُقيَّمة — غير مقدَّمة',
    d('2026-09-18'), 'File by', 'التقديم بحلول',
    3, 'requirements and attachments', 'المتطلبات والمرفقات',
    JSON.stringify(['done', 'done', 'current', 'todo', 'todo', 'na']), 60, 2,
    d('2026-08-04'),
  );
  insertEvent.run(
    'EV-0362', organizer, 'Baalbeck Summer Festival', 'مهرجان بعلبك الصيفي',
    d('2026-09-12'), d('2026-09-13'), 'MOPH-EV-2026-0362', 1,
    'Information required', 'معلومات مطلوبة',
    d('2026-08-20'), 'Respond by', 'الرد بحلول',
    4, 'submitted, returned for revision', 'قُدّم وأُعيد للتعديل',
    JSON.stringify(['done', 'done', 'done', 'returned', 'todo', 'todo']), 21, 3,
    d('2026-06-20'),
  );
  // The reference's fourth queue row is Saida Night Run, not AUB Sports Day: a Level 2
  // filing that missed its lead time, carrying Short notice and Event imminent, and
  // determined "submission received but incomplete". It is the demonstration set's only
  // late filing and its only incomplete determination, which is why it is there.
  //
  // ONE DATE DIFFERS FROM THE REFERENCE, DELIBERATELY. The prototype shows this row
  // filed 2026-08-15 AND marked "Filed late". Both cannot hold: Level 2 requires
  // filing 14 calendar days before, and 2026-08-29 less 14 days is exactly 2026-08-15,
  // so that filing MEETS the deadline. Seeding 08-15 would make the derived chip read
  // "Met" beside two flags that say the opposite. The intent is plainly a late filing,
  // so the seed carries 2026-08-16 and the chip derives honestly. Reported, not
  // reconciled -- the reviewer moves the prototype's date by one day and this note goes.
  insertEvent.run(
    'EV-0301', organizer, 'Saida Night Run', 'ركض صيدا الليلي',
    d('2026-08-29'), d('2026-08-29'), 'MOPH-EV-2026-0301', 1,
    'Submission received but incomplete', 'تم استلام التقديم لكنه غير مكتمل',
    d('2026-08-29'), 'Event date', 'تاريخ الفعالية',
    5, 'Ministry outcome recorded', 'سُجّلت نتيجة الوزارة',
    JSON.stringify(['done', 'done', 'done', 'done', 'done', 'na']), 90, 2,
    d('2026-06-02'),
  );
  // DEMONSTRATION DATA, NOT A PROTOTYPE MATCH. The reference queue's in-progress row is
  // Beirut Coastal 12K, but the two prototype files disagree about that event: the
  // Ministry file has it filed and in progress, the Organizer Journey has it at stage 3
  // with no reference number. The organizer file governs the organizer's own record, so
  // EV-0418 stays unfiled -- and without this row the demonstration set would contain no
  // filed-and-unreviewed submission at all, so a Ministry walking the console could never
  // see a grey internal state. Inventing it on EV-0418 would only move the contradiction.
  // This is a fifth event, filed with NO determination, sitting in the queue.
  insertEvent.run(
    'EV-0455', organizerQueue, 'Byblos Harbour Swim', 'سباحة مرفأ جبيل',
    d('2026-10-17'), d('2026-10-17'), 'MOPH-EV-2026-0455', 1,
    'With the Ministry', 'لدى الوزارة',
    d('2026-10-17'), 'Event date', 'تاريخ الفعالية',
    5, 'Ministry review', 'مراجعة الوزارة',
    JSON.stringify(['done', 'done', 'done', 'done', 'current', 'na']), 60, 2,
    d('2026-07-14'),
  );
  insertEvent.run(
    // Held 2026-08-09, as every reference file has it (the Ministry queue's eventDate,
    // the post-event screen's "held 2026-08-09", both notification templates). The seed
    // carried 08-08, and the report window rule was counting a day too many; the two
    // errors cancelled and the due date came out right for the wrong reason. Both are
    // corrected: seven calendar days after 08-09 is 08-16.
    'EV-0244', organizer, 'Tripoli Marathon', 'ماراتون طرابلس',
    d('2026-08-09'), d('2026-08-09'), 'MOPH-EV-2026-0244', 1,
    'Post-event report owed', 'تقرير لاحق مستحق',
    d('2026-08-16'), 'Report by', 'التقرير بحلول',
    6, 'post-event report', 'التقرير اللاحق',
    JSON.stringify(['done', 'done', 'done', 'done', 'done', 'current']), 7, 3,
    d('2026-05-15'),
  );

  // Beirut Coastal 12K: a 12 km run. Score 9 -- band Level 2 -- and the any-organized-
  // running-event condition also gives Level 2: score and floor agree, and the record
  // reports both and which governed. Two versions; the first remains readable.
  const insertAssessment = db.prepare(
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation, created_at)
     VALUES ('EV-0418', ?, ?, ?, ?, ?)`,
  );
  const inputs = JSON.stringify({
    expectedMaxSimultaneousAttendance: 4500,
    eventDisciplines: ['running'],
    courseDistanceKm: 12,
    venueLicensedCapacity: null,
    venueIsNightclubOrDanceVenue: false,
  });
  // Derivation is recomputed against lib/rules at read time; the stored copy is a record.
  insertAssessment.run(
    1,
    JSON.stringify([2, 1, 1, 0, 1, 1, 1, 1, 0]),
    inputs,
    JSON.stringify({ storedNote: 'recomputed at read' }),
    d('2026-08-09'),
  );
  insertAssessment.run(
    2,
    JSON.stringify([2, 2, 1, 0, 1, 1, 1, 1, 0]),
    inputs,
    JSON.stringify({ storedNote: 'recomputed at read' }),
    d('2026-08-13'),
  );

  const insertVenue = db.prepare(
    `INSERT INTO venues (id, account_id, name_en, name_ar, category, address_municipality_en,
       address_municipality_ar, responsible_contact, licensed_capacity, regularly_hosts, is_nightclub,
       level, issued, valid_until, moph_reference, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, 1, ?)`,
  );
  insertVenue.run(
    'VN-0032', organizer, 'Forum de Beyrouth', 'فوروم دو بيروت',
    'Exhibition and concert hall', 'Beirut', 'بيروت', 'R. Haddad', 4500,
    2, d('2026-03-04'), d('2027-03-04'), 'MOPH-VN-2026-0032', d('2026-02-19'),
  );
  insertVenue.run(
    'VN-0028', organizer, 'Casino Hall', 'قاعة الكازينو',
    'Concert and function hall', 'Jounieh', 'جونية', 'R. Haddad', 2800,
    2, d('2025-09-30'), d('2026-09-30'), 'MOPH-VN-2025-0028', d('2025-09-12'),
  );
  insertVenue.run(
    'VN-0011', organizer, 'Zouk Amphitheatre', 'مدرج ذوق',
    'Open-air amphitheatre', 'Zouk Mikael', 'ذوق مكايل', 'R. Haddad', 3200,
    2, d('2025-06-15'), d('2026-06-15'), 'MOPH-VN-2025-0011', d('2025-05-30'),
  );

  // Forum's classification demonstrates the union: answers total 4 -- Level 1 by
  // score -- and the recurring-venue floor (the Arabic issue's row) lifts it to
  // Level 2. The English issue alone would classify this venue Level 1.
  const venueInputs = (attendance: number): string => JSON.stringify({
    expectedMaxSimultaneousAttendance: attendance,
    eventDisciplines: [],
    courseDistanceKm: null,
    venueLicensedCapacity: 4500,
    venueIsNightclubOrDanceVenue: false,
  });
  const insertVenueAssessment = db.prepare(
    `INSERT INTO venue_assessments (venue_id, version, answers, inputs, derivation,
       nehrat_tool_version, effective, valid_until, representative, position, created_at)
     VALUES (?, ?, ?, ?, ?, 'seeded', ?, ?, ?, ?, ?)`,
  );
  insertVenueAssessment.run(
    'VN-0032', 1,
    JSON.stringify([1, 1, 1, 0, 1, 0, 0, 0, 0]), venueInputs(4200),
    JSON.stringify({ storedNote: 'recomputed at read' }),
    d('2026-03-04'), d('2027-03-04'), 'R. Haddad', 'Venue operations manager', d('2026-03-04'),
  );
  insertVenueAssessment.run(
    'VN-0028', 1,
    JSON.stringify([1, 1, 1, 0, 1, 0, 0, 0, 0]), venueInputs(2600),
    JSON.stringify({ storedNote: 'recomputed at read' }),
    d('2025-09-30'), d('2026-09-30'), 'R. Haddad', 'Venue operations manager', d('2025-09-30'),
  );

  // ---- Slice 4: the covered facility, in full ----
  // Device dates are chosen to reproduce the reference VALIDITY LEDGER exactly
  // (pads min 2026-10-02, battery min 2027-03-18, oldest check 2026-07-28). The
  // reference's own AED-003 chip disagrees with its own ledger; the build derives
  // both from one record, so the ledger -- the load-bearing screen -- wins.
  db.prepare(
    `INSERT INTO facilities (id, account_id, name_en, name_ar, category_key, address,
       municipality_en, municipality_ar, operating_hours, phone, email,
       access_point, ems_number, created_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(
    'FC-0014', organizer, 'Beirut Sports Complex', 'مجمّع بيروت الرياضي',
    'sports', 'Avenue du Parc', 'Beirut', 'بيروت', '06:00 – 23:00',
    '01 372 802', 'operations@beirutsports.example.lb',
    'North service gate', '01 372 802', d('2026-05-20'),
  );

  const insertPerson = db.prepare(
    `INSERT INTO facility_persons (facility_id, role, name_or_position, phone, email, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  insertPerson.run('FC-0014', 'coordinator', 'Operations manager', '01 372 802', 'operations@beirutsports.example.lb', d('2026-06-01'));
  insertPerson.run('FC-0014', 'alternate', 'Duty supervisor', '01 372 803', 'duty@beirutsports.example.lb', d('2026-06-01'));
  insertPerson.run('FC-0014', 'emsGuide', 'Front desk staff on duty', '01 372 800', 'reception@beirutsports.example.lb', d('2026-06-01'));

  const insertDevice = db.prepare(
    `INSERT INTO facility_devices (facility_id, label, identification, location_en, location_ar,
       accessible_hours, publicly_accessible, pediatric, operational,
       pad_expiry, battery_expiry, latest_check, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
  );
  insertDevice.run(
    'FC-0014', 'AED-001', 'HS-4412-A', 'Main entrance lobby', 'بهو المدخل الرئيسي',
    1, 1, 'yes', d('2027-01-10'), d('2027-03-18'), d('2026-07-28'), d('2026-07-28'), d('2026-05-20'),
  );
  insertDevice.run(
    'FC-0014', 'AED-002', 'HS-4417-B', 'Reception desk, ground floor', 'مكتب الاستقبال، الطابق الأرضي',
    1, 0, 'no', d('2026-10-02'), d('2027-06-15'), d('2026-07-28'), d('2026-07-28'), d('2026-05-20'),
  );
  // The pool-deck cabinet is reported locked: not accessible during operating hours
  // (Annex A part 3's accessibility rule), and the subject of the Ministry request.
  insertDevice.run(
    'FC-0014', 'AED-003', 'HS-4420-C', 'Pool deck cabinet', 'خزانة المسبح',
    0, 0, 'no', d('2026-11-20'), d('2027-05-01'), d('2026-07-28'), d('2026-08-09'), d('2026-05-20'),
  );

  db.prepare(
    `INSERT INTO facility_plan_confirmations (facility_id, checks, drill_date, coordinator, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'FC-0014',
    JSON.stringify({ trained: true, signage: true, access: false, routes: true, staffKnow: true, drill: true }),
    d('2025-11-04'), 'Operations manager', 'Operations manager', d('2025-09-12'),
  );

  db.prepare(
    `INSERT INTO facility_requests (facility_id, body_en, body_ar, due, created_at, is_demo)
     VALUES (?, ?, ?, ?, ?, 1)`,
  ).run(
    'FC-0014',
    `Confirm that the poolside AED cabinet is unlocked during operating hours. Corrective action due ${d('2026-09-01')}.`,
    `تأكيد أن خزانة الجهاز عند المسبح غير مقفلة خلال ساعات العمل. الإجراء التصحيحي مستحق في ⁦${d('2026-09-01')}⁩.`,
    d('2026-09-01'), d('2026-08-10'),
  );

  // ---- Slice 2 demonstration state ----
  // EV-0418 (Level 2, mid-requirements): the reference's three named providers and the
  // attached route map. Two documents outstanding: the compliance form and the plan.
  const insertInvitation = db.prepare(
    `INSERT INTO invitations (token, event_id, kind, name_en, name_ar, email, status, declaration, answered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertInvitation.run(
    'demo-lrc-beirut-0418', 'EV-0418', 'ems',
    'Lebanese Red Cross — Beirut branch', 'الصليب الأحمر اللبناني — فرع بيروت',
    'operations@lrc-beirut.example.lb', 'confirmed', 'none', d('2026-08-10'),
  );
  insertInvitation.run(
    'demo-civil-defence-0418', 'EV-0418', 'ems',
    'Civil Defence — Beirut', 'الدفاع المدني — بيروت',
    'beirut@civildefence.example.lb', 'confirmed', 'none', d('2026-08-11'),
  );
  insertInvitation.run(
    'demo-coastal-medical-0418', 'EV-0418', 'ems',
    'Coastal Medical Transport', 'النقل الطبي الساحلي',
    'dispatch@coastalmedical.example.lb', 'nominated', 'none', null,
  );
  attachWithFile('EV-0418', 'siteMap', 'coastal-12k-route.pdf', 'Site and route map', 'EV-0418 — Beirut Coastal 12K');
  // The 12K finishes inside the registered covered facility, so the plan's reference
  // block renders for it (ROADMAP 2e).
  db.prepare(`UPDATE events SET venue_facility_id = 'FC-0014' WHERE id = 'EV-0418'`).run();

  // EV-0362 (Level 3, filed and returned): a complete compliance form behind its
  // Ministry reference, provider and Director confirmed.
  db.prepare(
    `INSERT INTO submissions (event_id, declarations, insurance, representative, telephone, position, filed_at, moph_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'EV-0362',
    JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), true]))),
    JSON.stringify({ insurer: 'Cedar Assurance SAL', policyNumber: 'CA-2026-11842', coveragePeriod: `${d('2026-09-10')} — ${d('2026-09-15')}`, evidenceAttached: 'yes' }),
    'R. Haddad', '+961 1 000 000', 'Events director',
    d('2026-08-01'), 'MOPH-EV-2026-0362',
  );
  // Filed events carry a complete plan row: the refile gate recomputes the FULL
  // package, and a seeded submission that could never refile would contradict the
  // revision path the outcome invites.
  const seedPlanRow = db.prepare(
    `INSERT INTO plans (event_id, mode, ref_confirmed, ref_admits_children, ref_temporary_areas,
       sections, attached_file, attached_content_type, attached_byte_size, attached_bytes,
       major_incident, version)
     VALUES (?, 'attach', 0, 0, 0, ?, ?, 'application/pdf', ?, ?, ?, 1)`,
  );
  const seedPlan = (eventId: string, sections: string, fileName: string, mi: string): void => {
    const pdf = demonstrationPdf('Event health and medical plan', `${eventId} — demonstration record`);
    seedPlanRow.run(eventId, sections, fileName, pdf.length, pdf, mi);
  };
  const allSections = JSON.stringify(
    Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), { covered: true }])),
  );
  const allMi = JSON.stringify(
    Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), { covered: true }])),
  );
  seedPlan('EV-0362', allSections, 'baalbeck-plan-v3.pdf', allMi);
  // THE ANSWERS BEHIND EV-0362's LEVEL. Without these the review screen could show
  // the level and not one of the nine answers producing it, and said so in an
  // apologetic empty state. This set is chosen to derive EXACTLY the level the row
  // is seeded with (3), and to demonstrate the higher-of rule doing visible work:
  // the score band gives 3, the minimum conditions give 2, and the score governs.
  db.prepare(
    `INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version, created_at)
     VALUES (?, 1, ?, ?, '{}', ?, ?)`,
  ).run(
    'EV-0362',
    JSON.stringify([2, 2, 2, 1, 2, 1, 2, 1, 2]),
    JSON.stringify({
      expectedMaxSimultaneousAttendance: 18000,
      eventDisciplines: ['music'],
      courseDistanceKm: null,
      venueLicensedCapacity: 20000,
      venueIsNightclubOrDanceVenue: false,
    }),
    NEHRAT_TOOL_VERSION,
    d('2026-07-28'),
  );
  attachWithFile('EV-0362', 'siteMap', 'baalbeck-site-map.pdf', 'Site and route map', 'EV-0362 — Baalbeck Summer Festival');
  attachWithFile('EV-0362', 'deploymentMap', 'baalbeck-deployment-map.pdf', 'Deployment map', 'EV-0362 — Baalbeck Summer Festival');
  // Evidence of insurance is a Level 3 requirement and a FILE (it was a text box that
  // the word "yes" satisfied). The seeded Level 3 submission has to carry it, or the
  // demonstration record cannot refile -- the gate would refuse a document the
  // showcase never attached.
  attachWithFile('EV-0362', 'insuranceEvidence', 'cedar-assurance-CA-2026-11842.pdf', 'Evidence of insurance', 'EV-0362 — Cedar Assurance SAL, policy CA-2026-11842');
  attachWithFile('EV-0455', 'siteMap', 'byblos-harbour-site-map.pdf', 'Site and route map', 'EV-0455 — Byblos Harbour Swim');
  attachWithFile('EV-0455', 'deploymentMap', 'byblos-harbour-deployment-map.pdf', 'Deployment map', 'EV-0455 — Byblos Harbour Swim');
  // EV-0244 is a SATISFIED Level 3 record and carried no attachments at all -- it
  // predates the filing gate and nothing re-checked it, so the showcase held a
  // satisfied Level 3 submission missing every document that level requires. A
  // Ministry walking it would have read a determination on a package that could not
  // have been filed.
  attachWithFile('EV-0244', 'siteMap', 'tripoli-marathon-route.pdf', 'Site and route map', 'EV-0244 — Tripoli Marathon');
  attachWithFile('EV-0244', 'deploymentMap', 'tripoli-marathon-deployment-map.pdf', 'Deployment map', 'EV-0244 — Tripoli Marathon');
  attachWithFile('EV-0244', 'insuranceEvidence', 'tripoli-marathon-insurance.pdf', 'Evidence of insurance', 'EV-0244 — Tripoli Marathon');
  seedPlan('EV-0301', allSections, 'saida-night-run-plan.pdf', allMi);
  seedPlan('EV-0244', allSections, 'saida-run-plan.pdf', allMi);

  insertInvitation.run(
    'demo-lrc-baalbeck-0362', 'EV-0362', 'ems',
    'Lebanese Red Cross — Baalbeck', 'الصليب الأحمر اللبناني — بعلبك',
    'baalbeck@lrc.example.lb', 'confirmed', 'signed', d('2026-07-25'),
  );
  insertInvitation.run(
    'demo-director-0362', 'EV-0362', 'director',
    'Dr. N. Salameh', 'د. ن. سلامة',
    'n.salameh@example.lb', 'confirmed', 'none', d('2026-07-20'),
  );

  // EV-0244 (Level 3, held): the post-event report is owed; the organizer has figures
  // saved but has not signed, and the Director's signature is still open.
  insertInvitation.run(
    'demo-director-0244', 'EV-0244', 'director',
    'Dr. N. Salameh', 'د. ن. سلامة',
    'n.salameh@example.lb', 'confirmed', 'none', d('2026-06-01'),
  );
  db.prepare(
    `INSERT INTO post_event_reports (event_id, activity, significant, lessons_none, lessons_text)
     VALUES (?, ?, ?, 0, '')`,
  ).run(
    'EV-0244',
    JSON.stringify({ estimatedAttendance: '11,400', patientsTreated: '38', patientsTransported: '4', cardiacArrests: '1', deaths: '0', unplannedResources: '1', coverageHours: '9' }),
    JSON.stringify({ hospitalTransport: true, cardiacArrest: true, unplannedRequest: true }),
  );

  // ---- Slice 5: the counterparty roles ----
  // test_ems is the Lebanese Red Cross operational account: named on the Level 2
  // 12K (participation owed -- operational detail not yet supplied) and on the
  // Level 3 Baalbeck festival (declaration signed, all ten items). The linkage lives
  // in its own function so a standing database can be repaired without reseeding.
  linkDemonstrationCounterparties(db);

  const insertProfile = db.prepare(
    `INSERT INTO role_profiles (account_id, fields) VALUES (?, ?)`,
  );
  insertProfile.run(ems, JSON.stringify({
    agencyName: 'Lebanese Red Cross — Beirut branch',
    providerType: 'Emergency medical service',
    representative: 'S. Karam',
    operationalLead: 'M. Aoun',
    leadContact: '03 118 402',
    phone: '140',
    email: 'beirut.ops@redcross.lb',
    address: 'Spears, Beirut',
    areas: 'Beirut, Baabda, Aley',
  }));
  insertProfile.run(director, JSON.stringify({
    fullName: 'Dr N. Salameh',
    licence: '14-9982',
    orderRegistration: 'LOP-B-4471',
    specialty: 'Emergency medicine',
    years: '17',
    phone: '03 421 118',
    email: 'n.salameh@example.lb',
    affiliation: 'Dar Al Amal University Hospital',
  }));

  // Shared documents between the organizer and the Baalbeck provider: the
  // reference's five rows, one per state.
  const insertDoc = db.prepare(
    `INSERT INTO shared_documents (invitation_token, name_en, name_ar, source, file_name,
       content_type, byte_size, bytes, meta_en, meta_ar, added_at)
     VALUES ('demo-lrc-baalbeck-0362', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertDoc.run(
    'Event health and medical plan — version 3', 'الخطة الصحية والطبية للفعالية — النسخة 3',
    'organizer', 'baalbeck-plan-v3.pdf', 'application/pdf', ...sharedPdf('Event health and medical plan', 'EV-0362 — version 3'), `From the organizer · ${d('2026-08-11')} · PDF`, `من المنظّم · ⁦${d('2026-08-11')}⁩ · PDF`, d('2026-08-11'),
  );
  insertDoc.run(
    'Medical deployment map', 'خريطة الانتشار الطبي',
    'requested', null, null, null, null, `Requested from you by the organizer · ${d('2026-08-12')}`, `طلبها منكم المنظّم · ⁦${d('2026-08-12')}⁩`, d('2026-08-12'),
  );
  insertDoc.run(
    'Service agreement', 'اتفاقية الخدمة',
    'provider', 'service-agreement.pdf', 'application/pdf', ...sharedPdf('Service agreement', 'EV-0362 — Lebanese Red Cross, Baalbeck'), `From your organization · ${d('2026-08-13')} · signed both sides`, `من مؤسستكم · ⁦${d('2026-08-13')}⁩ · موقّعة من الطرفين`, d('2026-08-13'),
  );
  insertDoc.run(
    'Event site and route map', 'خريطة موقع الفعالية والمسار',
    'organizer', 'baalbeck-site-map.pdf', 'application/pdf', ...sharedPdf('Event site and route map', 'EV-0362 — Baalbeck Summer Festival'), `From the organizer · ${d('2026-08-04')} · PDF`, `من المنظّم · ⁦${d('2026-08-04')}⁩ · PDF`, d('2026-08-04'),
  );
  insertDoc.run(
    'Radio channel and call-sign schedule', 'جدول القنوات ورموز النداء',
    'missing', null, null, null, null, 'Not yet added by either side', 'لم يُضفه أي من الطرفين بعد', d('2026-08-13'),
  );

  // The first-response unit: readiness partly confirmed (the reference's showcase
  // state) and one dataset report filed by the attach route.
  db.prepare(
    `INSERT INTO fr_readiness (account_id, confirmations, signed_at, updated_at)
     VALUES (?, ?, NULL, ?)`,
  ).run(
    response,
    JSON.stringify({
      equipment: [true, true, true, true, true],
      competence: [true, true, true, true, true, true, false],
      operational: [true, true, true, false, false],
    }),
    d('2026-08-01'),
  );
  db.prepare(
    `INSERT INTO fr_reports (account_id, mode, attached_file, covered, payload, created_at)
     VALUES (?, 'attach', 'unit3-pcr-2026-0841.pdf', ?, ?, ?)`,
  ).run(
    response,
    JSON.stringify({ incident: true, response: true, defibrillation: true, outcome: true, agency: false }),
    JSON.stringify({
      'agency.agencyName': 'Unit 3 — first response', 'agency.unitId': 'U3',
      'agency.completedBy': 'M. Aoun', 'agency.phone': '03 118 402',
      'agency.email': 'unit3@example.lb', 'agency.submitted': d('2026-08-20'),
    }),
    d('2026-08-20'),
  );

  // The Director's governance text for Baalbeck: written, started, and not written --
  // the reference's three states.
  db.prepare(
    `INSERT INTO event_governance (event_id, sections, updated_at) VALUES ('EV-0362', ?, ?)`,
  ).run(
    JSON.stringify({
      clinical: `All medical teams practise under the clinical protocols of their own provider and under my clinical authority for the duration of the event. Standards are set at the pre-event briefing on ${d('2026-09-18')} and confirmed by each team lead. A clinical concern is raised to the team lead, then to me on VHF channel 4 or by telephone; I may stand a responder down.`,
      command: 'I hold medical command, located at medical post 1 at the main gate.',
      incidentRole: '',
    }),
    d('2026-08-12'),
  );

  // ---- Slice 6: the Ministry console's showcase state ----
  // EV-0301 (Saida Night Run) and EV-0244 (Tripoli Marathon) were filed (their events
  // carry Ministry references);
  // the queue derives from the submissions table, so the filings exist there.
  const insertPlainSubmission = db.prepare(
    `INSERT INTO submissions (event_id, declarations, insurance, representative, telephone, position, filed_at, moph_reference)
     VALUES (?, ?, '{}', ?, '', '', ?, ?)`,
  );
  insertPlainSubmission.run(
    'EV-0301',
    JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), true]))),
    'R. Haddad', d('2026-08-16'), 'MOPH-EV-2026-0301',
  );
  insertPlainSubmission.run(
    'EV-0244',
    JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), true]))),
    'R. Haddad', d('2026-07-05'), 'MOPH-EV-2026-0244',
  );
  // The filed-and-unreviewed one. No determination is recorded against it, so the queue
  // shows its GREY internal state -- which is the whole reason it exists.
  insertPlainSubmission.run(
    'EV-0455',
    JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), true]))),
    'R. Haddad', d('2026-08-11'), 'MOPH-EV-2026-0455',
  );

  // Internal workflow states are grey and are not determinations. The recorded
  // outcomes MATCH the organizer-side presentation seeded above: EV-0362 was
  // returned for revision, EV-0244 satisfied, EV-0301 incomplete.
  db.prepare(
    `INSERT INTO review_state (event_id, state, reviewer, updated_at) VALUES (?, ?, ?, ?)`,
  ).run('EV-0362', 'progress', 'L. Nassar', d('2026-08-10'));
  const insertDetermination = db.prepare(
    `INSERT INTO determinations (event_id, outcome, note, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?)`,
  );
  insertDetermination.run(
    'EV-0362', 'revision',
    'The medical deployment map has not been attached, and one of the named providers has not signed its readiness declaration. File a revised version; your reference number does not change.',
    'L. Nassar', d('2026-08-10'),
  );
  // The reference puts SATISFIED on Tripoli Marathon and INCOMPLETE on Saida Night Run.
  // The build had satisfied on the fourth row and nothing on Tripoli; both now match.
  insertDetermination.run(
    'EV-0301', 'incomplete',
    'The compliance and submission form is incomplete and the filing did not meet the fourteen-day lead time for Level 2.',
    'R. Sfeir', d('2026-08-17'),
  );
  insertDetermination.run('EV-0244', 'satisfied', '', 'R. Sfeir', d('2026-07-20'));

  // The attestation gate on EV-0362, mirroring the reference's review screen row for
  // row: three complete, three pending, each pending with the deficiency recorded as
  // the reason. The first item was attested by the Order reviewer BEFORE the lane went
  // off -- a completed record persists; suspension stops new recordings, not history.
  const insertAttestation = db.prepare(
    `INSERT INTO attestations (event_id, item_key, state, attested_by, attested_at, reason_en, reason_ar, reason_by, reason_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertAttestation.run('EV-0362', 'directorCredential', 'complete', 'Dr Y. Salameh', d('2026-08-12'), null, null, null, null);
  insertAttestation.run(
    'EV-0362', 'clinicalContent', 'pending', null, null,
    'Deficiency raised 2026-08-12 by Dr Y. Salameh — the plan does not state the treatment-post staffing skill mix.',
    'أُثير قصور في 2026-08-12 من د. ي. سلامة — لا تبيّن الخطة تركيبة مهارات ملاك مركز العلاج.',
    'Dr Y. Salameh', d('2026-08-12'),
  );
  insertAttestation.run('EV-0362', 'insuranceEvidenced', 'complete', 'L. Nassar', d('2026-08-11'), null, null, null, null);
  insertAttestation.run(
    'EV-0362', 'emsDeclarations', 'pending', null, null,
    'Two of three declarations outstanding — Civil Defence Baalbeck-Hermel is in draft, Bekaa Medical Transport has none.',
    'إقرارَان من ثلاثة غير مقدَّمين — الدفاع المدني بعلبك الهرمل مسودة، والنقل الطبي في البقاع لا إقرار له.',
    'L. Nassar', d('2026-08-11'),
  );
  insertAttestation.run('EV-0362', 'majorIncidentPlan', 'complete', 'L. Nassar', d('2026-08-11'), null, null, null, null);
  insertAttestation.run(
    'EV-0362', 'deploymentMap', 'pending', null, null,
    'Deficiency raised 2026-08-10 by L. Nassar — the deployment map has not been attached.',
    'أُثير قصور في 2026-08-10 من ل. نصار — لم تُرفق خريطة الانتشار الطبي.',
    'L. Nassar', d('2026-08-10'),
  );

  // A blocking inspection without recorded findings gates ONLY the satisfied
  // outcome on EV-0362; the recorded one shows what findings look like.
  const insertInspection = db.prepare(
    `INSERT INTO inspections (event_id, title_en, title_ar, inspector, state, date, blocking, findings, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  insertInspection.run(
    'EV-0362', 'Medical treatment post and deployment verified on site',
    'التحقق ميدانياً من نقطة المعالجة الطبية والانتشار',
    'L. Nassar', 'scheduled', d('2026-09-06'), 1, '',
  );
  insertInspection.run(
    'EV-0362', 'Ambulance access and patient-extraction routes walked',
    'معاينة مسارات وصول الإسعاف وإخلاء المرضى سيراً',
    'L. Nassar', 'recorded', d('2026-08-01'), 0,
    'Both extraction routes passable. The northern route narrows to 3.1 m at the market arch; noted, no corrective action raised.',
  );

  // Enquiries: one awaiting a Ministry response, one answered -- the answer
  // explains a derivation, and the outcome does not change.
  const insertEnquiry = db.prepare(
    `INSERT INTO enquiries (event_id, asked_by, question, asked_at, reply, replied_by, replied_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  insertEnquiry.run(
    'EV-0362', 'R. Haddad · Beirut Road Runners',
    'The deployment map was attached to version 1 and we believe it was overlooked. We ask the Ministry to confirm whether the map on file is the one it requires, before we prepare a further version.',
    d('2026-08-13'), '', '', null,
  );
  insertEnquiry.run(
    'EV-0244', 'F. Rahal · Beirut Road Runners',
    'The outcome records Level 3. We had assessed the event at Level 2 and ask on what basis the level was set.',
    d('2026-07-29'),
    'The minimum-level condition for 20,000 or more persons present at the same time applied, which sets Level 3 regardless of the domain score. The score-based level was 2; the minimum condition governs. The outcome is unchanged.',
    'R. Sfeir', d('2026-07-30'),
  );

  // The arrest pattern: two facility incidents at the registered facility and
  // two first-response reports at an unregistered terminal, so Reported arrest
  // locations shows a repeat pattern at a place that is NOT currently covered --
  // the designation demo.
  const insertFacIncident = db.prepare(
    `INSERT INTO facility_incidents (facility_id, payload, narrative, created_at) VALUES ('FC-0014', ?, ?, ?)`,
  );
  insertFacIncident.run(
    JSON.stringify({ date: d('2026-04-11'), time: '18:40', location: 'Pool deck', emsContacted: 'yes', aedAvailable: 'yes', aedApplied: 'yes', shock: 'yes', transportedBy: 'ems' }),
    'The patient collapsed at the pool deck; staff started CPR and applied the AED before EMS arrived.',
    d('2026-04-11'),
  );
  insertFacIncident.run(
    JSON.stringify({ date: d('2026-08-11'), time: '19:05', location: 'Gym floor', emsContacted: 'yes', aedAvailable: 'yes', aedApplied: 'yes', shock: 'no', transportedBy: 'ems' }),
    'The patient became unresponsive on the gym floor; the AED advised no shock and EMS transported.',
    d('2026-08-11'),
  );
  const insertFrReport = db.prepare(
    `INSERT INTO fr_reports (account_id, mode, attached_file, covered, payload, created_at)
     VALUES (?, 'platform', NULL, '{}', ?, ?)`,
  );
  insertFrReport.run(
    response,
    JSON.stringify({
      'incident.caseNumber': 'U3-0712', 'incident.date': d('2026-02-19'), 'incident.time': '08:10',
      'incident.location': 'Beirut Central Terminal', 'incident.address': 'Beirut',
      'incident.facilityCategory': 'Transport terminal', 'incident.ageGroup': 'adult',
      'response.witnessed': 'yes', 'defibrillation.unitApplied': 'yes', 'outcome.transported': 'yes',
      'agency.agencyName': 'Unit 3 — first response', 'agency.unitId': 'U3', 'agency.completedBy': 'M. Aoun',
    }),
    d('2026-02-19'),
  );
  insertFrReport.run(
    response,
    JSON.stringify({
      'incident.caseNumber': 'U3-0798', 'incident.date': d('2026-07-03'), 'incident.time': '17:52',
      'incident.location': 'Beirut Central Terminal', 'incident.address': 'Beirut',
      'incident.facilityCategory': 'Transport terminal', 'incident.ageGroup': 'adult',
      'response.witnessed': 'unknown', 'defibrillation.unitApplied': 'yes', 'outcome.transported': 'yes',
      'agency.agencyName': 'Unit 3 — first response', 'agency.unitId': 'U3', 'agency.completedBy': 'M. Aoun',
    }),
    d('2026-07-03'),
  );

  const insertNotification = db.prepare(
    `INSERT INTO notifications (account_id, kind, subject_en, subject_ar, body_en, body_ar,
       record_route, sent_at, read, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  const rows: [string, string, string, string, string, string, string, number][] = [
    ['needs_action',
      'Additional information or revision required — Baalbeck Summer Festival',
      'مطلوب معلومات إضافية أو تعديل — مهرجان بعلبك الصيفي',
      `The Ministry has returned the submission for revision. The items concerned are listed on the event record. Respond by ${d('2026-08-20')}.`,
      `أعادت الوزارة الطلب للتعديل. البنود المعنية مدرجة في سجل الفعالية. الرد بحلول \u2066${d('2026-08-20')}\u2069.`,
      '/events/EV-0362', d('2026-08-06'), 0],
    ['needs_action',
      'Post-event medical report owed — Tripoli Marathon',
      'التقرير الطبي لما بعد الفعالية مستحق — ماراتون طرابلس',
      `The post-event medical report is owed by ${d('2026-08-16')}. The report is filed from the event record.`,
      `التقرير الطبي لما بعد الفعالية مستحق بحلول \u2066${d('2026-08-16')}\u2069. يُقدَّم التقرير من سجل الفعالية.`,
      '/events/EV-0244', d('2026-08-09'), 0],
    ['needs_action',
      'Annual readiness confirmation opens — Beirut Sports Complex',
      'يُفتح التأكيد السنوي للجاهزية — مجمّع بيروت الرياضي',
      `The annual readiness confirmation lapses on ${d('2026-09-12')}. Confirmation is recorded from the facility readiness screen.`,
      `ينتهي التأكيد السنوي للجاهزية في \u2066${d('2026-09-12')}\u2069. يُسجَّل التأكيد من شاشة جاهزية المرفق.`,
      '/facilities/FC-0014', d('2026-08-12'), 0],
    ['needs_action',
      'Venue classification lapsing — Casino Hall',
      'تصنيف الموقع يقترب من الانتهاء — قاعة الكازينو',
      `The classification lapses on ${d('2026-09-30')}. Reassessment is open now, 60 days before expiry.`,
      `ينتهي التصنيف في \u2066${d('2026-09-30')}\u2069. إعادة التقييم مفتوحة الآن، قبل 60 يوماً من الانتهاء.`,
      '/venues/VN-0028', d('2026-08-01'), 0],
    ['needs_action',
      'Venue reassessment required — Zouk Amphitheatre',
      'يلزم إعادة تقييم الموقع — مدرج ذوق',
      `The classification lapsed on ${d('2026-06-15')}. A new assessment is required before the next routine operating session.`,
      `انتهى التصنيف في \u2066${d('2026-06-15')}\u2069. يلزم تقييم جديد قبل فترة التشغيل الاعتيادية المقبلة.`,
      '/venues/VN-0011', d('2026-06-16'), 0],
    ['needs_action',
      'Filing date approaching — Beirut Coastal 12K',
      'يقترب موعد التقديم — بيروت الساحلي 12 كلم',
      `The submission is owed by ${d('2026-09-18')}, 14 calendar days before the event.`,
      `يُستحق التقديم بحلول \u2066${d('2026-09-18')}\u2069، أي قبل 14 يوماً تقويمياً من الفعالية.`,
      '/events/EV-0418', d('2026-08-11'), 0],

    ['for_information',
      'Submission received but incomplete — Saida Night Run',
      'تم استلام التقديم لكنه غير مكتمل — ركض صيدا الليلي',
      'The compliance and submission form is incomplete and the filing did not meet the fourteen-day lead time. Complete the outstanding items and file again; your reference number does not change.',
      'نموذج الامتثال والتقديم غير مكتمل، ولم يلتزم التقديم بمهلة الأربعة عشر يوماً. أكملوا البنود المتبقية وقدّموا مجدداً؛ ولا يتغيّر رقمكم المرجعي.',
      '/events/EV-0301', d('2026-08-17'), 1],
  ];
  for (const [kind, sEn, sAr, bEn, bAr, route, sentAt, read] of rows) {
    insertNotification.run(organizer, kind, sEn, sAr, bEn, bAr, route, sentAt, read);
  }

  // The pending-state account's single notification.
  insertNotification.run(
    organizerPending, 'needs_action',
    'Organization registration — one document outstanding',
    'تسجيل المؤسسة — مستند واحد متبقٍّ',
    "Outstanding: the authorized representative's identification document. Assessments and drafts continue meanwhile; submission opens once the organization is recorded.",
    'المتبقي: مستند هوية الممثل المفوّض. تستمر التقييمات والمسودات في هذه الأثناء؛ ويُفتح التقديم بعد تسجيل المؤسسة.',
    '/organization', d('2026-07-30'), 0,
  );
}
