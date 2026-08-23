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

export function seedDemonstration(db: DatabaseSync): void {
  const seeded = db
    .prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`)
    .get() as { id: number } | undefined;
  if (seeded) return;

  const shift = shiftDays();
  const d = (ref: string): string => sh(ref, shift);

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
  insertAccount.run('test_ems', 'Demonstration EMS provider', 'EP', 'ems');
  insertAccount.run('test_director', 'Demonstration medical director', 'MD', 'director');
  insertAccount.run('test_response', 'Demonstration first-response unit', 'FR', 'response');
  insertAccount.run('test_moph', 'Demonstration reviewer', 'MR', 'reviewer');
  insertAccount.run('test_moph_admin', 'Demonstration administrator', 'MA', 'ministry_admin');

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

  // The four demonstration events the reference dashboard shows.
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
  insertEvent.run(
    'EV-0301', organizer, 'AUB Sports Day', 'يوم الرياضة في الجامعة الأميركية',
    d('2026-09-05'), d('2026-09-05'), 'MOPH-EV-2026-0301', 1,
    'Notification acknowledged', 'إشعار مستلَم',
    d('2026-09-05'), 'Event date', 'تاريخ الفعالية',
    5, 'Ministry outcome recorded', 'سُجّلت نتيجة الوزارة',
    JSON.stringify(['done', 'done', 'done', 'done', 'done', 'na']), 90, 1,
    d('2026-06-02'),
  );
  insertEvent.run(
    'EV-0244', organizer, 'Tripoli Marathon', 'ماراتون طرابلس',
    d('2026-08-08'), d('2026-08-08'), 'MOPH-EV-2026-0244', 1,
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
    venueRegularlyHostsOrganizedEvents: false,
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
    `INSERT INTO venues (id, account_id, name_en, name_ar, level, issued, valid_until, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  insertVenue.run('VN-0032', organizer, 'Forum de Beyrouth', 'فوروم دو بيروت', 2, d('2026-03-04'), d('2027-03-04'));
  insertVenue.run('VN-0028', organizer, 'Casino Hall', 'قاعة الكازينو', 2, d('2025-09-30'), d('2026-09-30'));
  insertVenue.run('VN-0011', organizer, 'Zouk Amphitheatre', 'مدرج ذوق', 2, d('2025-06-15'), d('2026-06-15'));

  db.prepare(
    `INSERT INTO facilities (id, account_id, name_en, name_ar, category_en, category_ar,
       devices, next_lapse, state_en, state_ar, state_kind, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(
    'FC-0014', organizer, 'Beirut Sports Complex', 'مجمّع بيروت الرياضي',
    'Sports and aquatic facility', 'منشأة رياضية ومائية',
    3, d('2026-09-12'),
    'Obligations being met', 'الموجبات مستوفاة', 'ok',
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
      'Notification acknowledged — AUB Sports Day',
      'إشعار مستلَم — يوم الرياضة في الجامعة الأميركية',
      'The Level 1 notification has been acknowledged. No further filing is owed unless a reportable incident occurs.',
      'تم استلام إشعار المستوى 1. لا يُستحق أي تقديم إضافي ما لم تقع حادثة موجبة للإبلاغ.',
      '/events/EV-0301', d('2026-07-28'), 1],
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
