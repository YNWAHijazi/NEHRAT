/**
 * THE ACCEPTED EXAMPLES (owner, 10 October 2026: "I want one event and one site as accepted by
 * the Ministry so I can see how it looks"). Two demonstration records on the demonstration
 * organizer's account, each written as the platform's own actions write it:
 *
 *  - Zahle Sports Complex: a sports facility with its pin, contact, EMS access and two AEDs
 *    (each with a readiness check), the readiness confirmation and drill, version 1 submitted,
 *    and the Ministry's review started and accepted -- Readiness current.
 *  - Zahle Community Health Fair: a Level 1 gathering at that site three weeks from today, with
 *    its organizer requirements answered, filed, and the Ministry's outcome recorded --
 *    Health and medical preparedness requirements satisfied.
 *
 * Demonstration rows only (is_demo = 1), on the demonstration organizer, never anyone else.
 * Idempotent: each record is guarded on its own name, so running again adds nothing. Dates are
 * relative to today (Asia/Beirut) so the event is always upcoming and the site always current.
 *
 * Called by the development seeder and, on a deployed instance that is already provisioned,
 * by `npm run demo:bootstrap` -- a person at the host console, never a process on boot.
 */
import type { DatabaseSync } from 'node:sqlite';
import { insertSite, nextRecordId } from './db';
import { seedRecordAnswers } from './demo-requirement-answers';
import { eventRecordRequirements, writeRequirementSnapshot } from './record-facts';
import { submitSiteRegistration } from './site-registration';
import { addDaysIso } from './rules/facility';
import { DOMAINS, NEHRAT_TOOL_VERSION, deriveLevel } from './rules';
import type { DomainAnswers, MinimumConditionInputs } from './rules/types';

export const ACCEPTED_SITE_NAME = 'Zahle Sports Complex';
export const ACCEPTED_EVENT_NAME = 'Zahle Community Health Fair';

export interface AcceptedExamples { facilityId: string | null; eventId: string | null; added: string[] }

export function seedAcceptedExamples(db: DatabaseSync, today: string): AcceptedExamples {
  const organizer = db.prepare(`SELECT id, display_name FROM accounts WHERE login = 'test_organizer' AND is_demo = 1`).get() as
    { id: number; display_name: string } | undefined;
  if (!organizer) return { facilityId: null, eventId: null, added: [] };
  const reviewer = db.prepare(`SELECT id, display_name FROM accounts WHERE login = 'test_moph' AND is_demo = 1`).get() as
    { id: number; display_name: string } | undefined;
  const reviewerName = reviewer?.display_name ?? 'Ministry reviewer';
  const at = (days: number, time: string) => `${addDaysIso(today, days)} ${time}`;
  const added: string[] = [];

  // ---- THE SITE ----
  let facility = db.prepare(`SELECT id, site_id FROM facilities WHERE account_id = ? AND is_demo = 1 AND name_en = ?`).get(organizer.id, ACCEPTED_SITE_NAME) as
    { id: string; site_id: string | null } | undefined;
  if (!facility) {
    const id = nextRecordId('FC');
    const point = { lat: 33.8463, lng: 35.9020 };
    db.prepare(
      `INSERT INTO facilities (id, account_id, name_en, name_ar, category_key, address, municipality_en, municipality_ar, operating_hours,
         phone, email, access_point, ems_number, licensed_capacity, is_demo, operating_organization, latitude, longitude, map_confirmed_at)
       VALUES (?, ?, ?, ?, 'sports', ?, 'Zahle', 'زحلة', ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?)`,
    ).run(id, organizer.id, ACCEPTED_SITE_NAME, 'مجمّع زحلة الرياضي', 'Boulevard Street, Hoch Al Oumara', '07:00 – 22:00',
      '+961 8 812 300', 'operations@zahlesports.example', 'East gate, ambulance bay beside the main hall', '140',
      'Zahle Sports Complex Management', point.lat, point.lng, at(-60, '09:00:00'));
    const siteId = insertSite(db, { nameEn: ACCEPTED_SITE_NAME, nameAr: 'مجمّع زحلة الرياضي', municipalityEn: 'Zahle', municipalityAr: 'زحلة', district: 'Zahle', latitude: point.lat, longitude: point.lng, createdBy: organizer.id, isDemo: true, createdAt: at(-60, '09:00:00') });
    db.prepare('UPDATE facilities SET site_id = ? WHERE id = ?').run(siteId, id);
    db.prepare(`INSERT INTO facility_persons (facility_id, role, name_or_position, phone, email, updated_at) VALUES (?, 'coordinator', ?, ?, ?, ?)`)
      .run(id, 'Facilities manager', '+961 3 412 880', 'facilities@zahlesports.example', at(-60, '09:00:00'));
    const device = db.prepare(
      `INSERT INTO facility_devices (facility_id, label, identification, location_en, location_ar, accessible_hours, publicly_accessible, pediatric,
         operational, pad_expiry, battery_expiry, latest_check, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, ?, ?, ?)`,
    );
    device.run(id, 'AED-001', 'ZSC-HS1-24017', 'Main hall entrance', 'مدخل القاعة الرئيسية', 1, 'yes', addDaysIso(today, 300), addDaysIso(today, 900), addDaysIso(today, -20), at(-20, '10:00:00'), at(-60, '09:30:00'));
    device.run(id, 'AED-002', 'ZSC-HS1-24018', 'Swimming pool reception', 'استقبال المسبح', 0, 'na', addDaysIso(today, 240), addDaysIso(today, 900), addDaysIso(today, -20), at(-20, '10:15:00'), at(-60, '09:40:00'));
    const update = db.prepare(`INSERT INTO facility_device_updates (facility_id, device_label, purpose, representative, created_at) VALUES (?, ?, ?, 'Facilities manager', ?)`);
    update.run(id, 'AED-001', 'initial', at(-60, '09:30:00'));
    update.run(id, 'AED-002', 'initial', at(-60, '09:40:00'));
    update.run(id, 'AED-001', 'readinessCheck', at(-20, '10:00:00'));
    update.run(id, 'AED-002', 'readinessCheck', at(-20, '10:15:00'));
    db.prepare(`INSERT INTO facility_plan_confirmations (facility_id, checks, drill_date, coordinator, position, created_at, details_revision)
                VALUES (?, ?, ?, 'Facilities manager', '', ?, (SELECT details_revision FROM facilities WHERE id = ?))`)
      .run(id, JSON.stringify({ trained: true, signage: true, access: true, routes: true, staffKnow: true, drill: true }), addDaysIso(today, -45), at(-40, '11:00:00'), id);
    const version = submitSiteRegistration(id, organizer.id, true, { representative: 'R. Haddad', position: 'Operations manager' });
    db.prepare('UPDATE facility_submissions SET submitted_at = ? WHERE facility_id = ? AND version = ?').run(at(-35, '12:00:00'), id, version);
    const submissionId = (db.prepare('SELECT id FROM facility_submissions WHERE facility_id = ? AND version = ?').get(id, version) as { id: number }).id;
    const act = db.prepare(`INSERT INTO facility_review_acts (facility_id, submission_id, kind, note, actor_id, actor_name, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
    act.run(id, submissionId, 'reviewStarted', '', reviewer?.id ?? null, reviewerName, at(-33, '09:00:00'));
    act.run(id, submissionId, 'accepted', 'Registration and readiness record complete.', reviewer?.id ?? null, reviewerName, at(-30, '11:00:00'));
    facility = { id, site_id: siteId };
    added.push(`${id} ${ACCEPTED_SITE_NAME} (${siteId}) — accepted, readiness current`);
  }

  // ---- THE EVENT, at that site ----
  let event = db.prepare(`SELECT id FROM events WHERE account_id = ? AND is_demo = 1 AND name_en = ?`).get(organizer.id, ACCEPTED_EVENT_NAME) as { id: string } | undefined;
  if (!event) {
    const id = nextRecordId('EV');
    const start = addDaysIso(today, 21);
    const answers: DomainAnswers = DOMAINS.map(() => 0);
    const inputs: MinimumConditionInputs = { expectedMaxSimultaneousAttendance: 400, eventDisciplines: [], courseDistanceKm: null, venueLicensedCapacity: null, venueIsNightclubOrDanceVenue: false };
    const derivation = deriveLevel({ answers, inputs });
    db.prepare(
      `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, event_type, venue_route, municipalities, opening_time, closing_time,
         expected_participants, expected_spectators, expected_staff, previous_edition, recurring_fixed_venue, site_id, filed, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'gathering', ?, 'Zahle', '09:00', '15:00', 320, 0, 80, 0, 1, ?, 0, 1, ?)`,
    ).run(id, organizer.id, ACCEPTED_EVENT_NAME, 'معرض زحلة الصحي المجتمعي', start, start, `${ACCEPTED_SITE_NAME}, main hall`, facility.site_id, at(-40, '10:00:00'));
    db.prepare(`INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version, representative, position, created_at) VALUES (?, 1, ?, ?, ?, ?, 'R. Haddad', 'Operations manager', ?)`)
      .run(id, JSON.stringify(answers), JSON.stringify(inputs), JSON.stringify(derivation), NEHRAT_TOOL_VERSION, at(-40, '10:00:00'));
    // The organizer confirmed the site's information applies to this event, as the event page asks.
    db.prepare(`INSERT INTO event_site_confirmations (event_id, site_id, differences, confirmed_by, confirmed_at) VALUES (?, ?, '', ?, ?)`)
      .run(id, facility.site_id, organizer.id, at(-38, '10:00:00'));
    seedRecordAnswers(db, 'event', id, 1, at(-35, '10:00:00'), { organizer: organizer.display_name, ems: '', director: '' });
    db.prepare(`INSERT INTO submissions (event_id, declarations, insurance, representative, telephone, position, filed_at, moph_reference) VALUES (?, ?, '{}', 'R. Haddad', '+961 3 220 145', 'Operations manager', ?, ?)`)
      .run(id, JSON.stringify(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), true]))), at(-30, '12:00:00'), id);
    db.prepare(`UPDATE events SET filed = 1, moph_reference = ? WHERE id = ?`).run(id, id);
    const record = eventRecordRequirements(organizer.id, id);
    if (record) writeRequirementSnapshot('event', record, 1);
    db.prepare(`UPDATE requirement_snapshots SET filed_at = ? WHERE record_kind = 'event' AND record_id = ?`).run(at(-30, '12:00:00'), id);
    db.prepare(`INSERT INTO review_state (event_id, state, reviewer, updated_at) VALUES (?, 'progress', ?, ?)`).run(id, reviewerName, at(-28, '09:00:00'));
    db.prepare(`INSERT INTO determinations (event_id, outcome, note, recorded_by, recorded_at) VALUES (?, 'satisfied', '', ?, ?)`).run(id, reviewerName, at(-25, '14:00:00'));
    event = { id };
    added.push(`${id} ${ACCEPTED_EVENT_NAME} — Level ${derivation.finalLevel}, filed, requirements satisfied`);
  }
  return { facilityId: facility.id, eventId: event.id, added };
}
