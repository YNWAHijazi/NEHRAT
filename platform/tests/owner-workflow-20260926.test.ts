import {renewVenuePackageAction} from '../app/venues/actions';
import { beforeAll, afterAll, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Account } from "../lib/auth";
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock("../lib/auth", () => ({ currentAccount: async () => session.account }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getDb } from "../lib/db";
import {
  saveVenueAssessmentAction,
  notifySeriousIncidentAction,
  savePostEventReportAction,
  updateDraftEventAction,
  reapplyEventAction,
} from "../app/actions";
import { saveRequirementAnswerAction, saveRequirementFileAction } from "../app/record-actions";
import { eventRecordRequirements } from "../lib/record-facts";
import { canPreparePlan } from "../lib/rules/plan-responsibility";
import { planIsComplete } from "../lib/rules/submission";
import { recordNextStep, resolveRequirements } from "../lib/rules/record-requirements";
import { seriousIncidentGate, seriousIncidentTimeliness } from "../lib/rules/gates";
import {
  eventApplicability,
  facilityApplicability,
} from "../lib/rules/public-landing";
const folder = mkdtempSync(join(tmpdir(), "moph-owner-update-"));
beforeAll(() => {
  vi.stubEnv("DATABASE_PATH", join(folder, "test.db"));
  vi.stubEnv("REVIEW_CLOCK", "2026-08-13");
  getDb();
});
afterAll(() => {
  getDb().close();
  vi.unstubAllEnvs();
  rmSync(folder, { recursive: true, force: true });
});
function as(login: string) {
  const row = getDb()
    .prepare("SELECT id,role FROM accounts WHERE login = ?")
    .get(login) as { id: number; role: Account["role"] };
  session.account = {
    ...row,
    login,
    displayName: login,
    initials: "T",
    isDemo: true,
  };
}
/** A major-incident item's text on EV-0362, saved at the version the record holds. */
function saveItem(key: string, text: string) {
  const stored = getDb().prepare("SELECT version FROM requirement_answers WHERE record_kind = 'event' AND record_id = 'EV-0362' AND key = ?").get(key) as { version: number } | undefined;
  return saveRequirementAnswerAction("event", "EV-0362", key, { baseVersion: stored?.version ?? 0, values: { text } });
}
const itemText = (owner: number, key: string) => eventRecordRequirements(owner, "EV-0362")!.plan.find((s) => s.key === "P12")!.items.find((m) => m.key === key)!.text;
test("public check accepts any remaining criterion; objective facility/site categories route to registration, designated ones do not", () => {
  expect(eventApplicability([]).en).toBe("Certification not required");
  for (let i = 0; i < 5; i++)
    expect(eventApplicability([i]).route).toBe("/services/certify-an-event");
  expect(eventApplicability([5, NaN, -1]).route).toBeNull();
  // Sports and fitness, educational, transport and public access, event-hosting venues: objective.
  for (let i = 0; i < 4; i++)
    expect(facilityApplicability(i)?.route).toBe(
      "/services/register-a-facility",
    );
  // Remote access, a confirmed prior arrest, any other designation: the Ministry's, not the applicant's.
  for (let i = 4; i < 7; i++) {
    expect(facilityApplicability(i)?.route).toBeNull();
    expect(facilityApplicability(i)?.en).toBe("Registration follows a Ministry designation");
  }
  expect(facilityApplicability(7)).toBeNull();
});
test("Level 2 completes without major-incident section or checklist; Level 3 cannot", () => {
  const sections = Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => i + 1)
      .filter((n) => n !== 12)
      .map((n) => [String(n), { text: "Completed" }]),
  );
  const p = {
    mode: "write" as const,
    sections,
    majorIncident: {},
    attachedFile: null,
  };
  expect(planIsComplete(p, 2)).toBe(true);
  expect(planIsComplete(p, 3)).toBe(false);
});
test("organizer cannot edit any Level 3 plan section; confirmed EMS can prepare the major-incident items", async () => {
  as("test_organizer");
  const owner = session.account!.id;
  const before = itemText(owner, "M01");
  expect(await saveItem("M01", "Unauthorized override")).toEqual({ error: "forbidden" });
  expect(itemText(owner, "M01")).toBe(before);
  as("test_ems");
  expect(await saveItem("M01", "EMS major-incident arrangements")).toHaveProperty("ok", true);
  expect(itemText(owner, "M01")).toBe("EMS major-incident arrangements");
  // The same text at the version already superseded is a conflict, never an overwrite.
  const stale = getDb().prepare("SELECT version FROM requirement_answers WHERE record_kind = 'event' AND record_id = 'EV-0362' AND key = 'M01'").get() as { version: number };
  expect(await saveRequirementAnswerAction("event", "EV-0362", "M01", { baseVersion: stale.version - 1, values: { text: "Stale" } })).toEqual({ error: "conflict" });
});
test("only the confirmed medical team uploads the Level 3 deployment map, and it lands under the document key the reviewer reads", async () => {
  const form = new FormData();
  form.set("file", new File(["map"], "map.pdf", { type: "application/pdf" }));
  as("test_organizer");
  await expect(saveRequirementFileAction("event", "EV-0362", "P-D", form)).rejects.toThrow(
    "error=forbidden#req-P-D",
  );
  as("test_director");
  await expect(saveRequirementFileAction("event", "EV-0362", "P-D", form)).rejects.toThrow(
    "saved=P-D#req-P-D",
  );
  expect(
    getDb()
      .prepare(
        "SELECT file_name FROM event_attachments WHERE event_id='EV-0362' AND doc_key='deploymentMap'",
      )
      .get(),
  ).toHaveProperty("file_name", "map.pdf");
});
test("the incident notice never closes; a notice after the window is accepted and marked late (D6, 10 October 2026)", () => {
  const context = {
    finalLevel: 3 as const,
    eventStartDate: "2026-08-12",
    eventEndDate: "2026-08-12",
    eventEndTime: "18:00",
    filed: true,
    organizationStatus: "recorded" as const,
    now: new Date("2026-08-13T17:59:59+03:00"),
  };
  expect(seriousIncidentGate(context).behaviour).toBe("enabled");
  // Days after the event ended, still open.
  expect(seriousIncidentGate({ ...context, now: new Date("2026-08-20T09:00:00+03:00") }).behaviour).toBe("enabled");
  // Timeliness runs from the occurrence (Beirut wall-clock) to the stored UTC stamp.
  // 17:00 Beirut (UTC+3) = 14:00 UTC; 24 hours later is 14:00 UTC the next day.
  expect(seriousIncidentTimeliness("2026-08-12T17:00", "2026-08-13 14:00:00", 24)).toEqual({ late: false, hoursAfter: 24 });
  expect(seriousIncidentTimeliness("2026-08-12T17:00", "2026-08-13 14:01:00", 24)).toEqual({ late: true, hoursAfter: 24 });
  // A multi-day event: an incident on day 1 is late on day 3 though the event has not ended.
  expect(seriousIncidentTimeliness("2026-08-12T10:00", "2026-08-14 08:00:00", 24).late).toBe(true);
  // Winter (UTC+2).
  expect(seriousIncidentTimeliness("2026-01-12T17:00", "2026-01-13 15:00:00", 24).late).toBe(false);
  expect(seriousIncidentTimeliness("2026-01-12T17:00", "2026-01-13 15:30:00", 24).late).toBe(true);
});
test("a late incident notice is accepted; a submitted post-event report cannot be edited", async () => {
  as("test_organizer");
  const db = getDb();
  db.prepare(
    "UPDATE events SET start_date='2026-08-10', end_date='2026-08-10', closing_time='18:00', filed=1 WHERE id='EV-0362'",
  ).run();
  const count = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM serious_incident_notifications WHERE event_id='EV-0362'",
      )
      .get() as { n: number }
  ).n;
  const f = new FormData();
  f.set("incidentType", "major");
  f.set("occurredAt", "2026-08-10T17:00");
  await expect(notifySeriousIncidentAction("EV-0362", f)).rejects.toThrow(
    "notice=notified",
  );
  expect(
    (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM serious_incident_notifications WHERE event_id='EV-0362'",
        )
        .get() as { n: number }
    ).n,
  ).toBe(count + 1);
  db.prepare(
    "INSERT INTO post_event_reports(event_id,submitted_at) VALUES ('EV-0362','2026-08-12') ON CONFLICT(event_id) DO UPDATE SET submitted_at='2026-08-12'",
  ).run();
  expect(
    await savePostEventReportAction("EV-0362", {
      activity: {},
      significant: {},
      lessonsNone: true,
      lessonsText: "",
    }),
  ).toEqual({ error: "already-submitted" });
});
test("duplicates enter the editable application and preserve the source", async () => {
  as("test_organizer");
  const source = getDb()
    .prepare("SELECT * FROM events WHERE id='EV-0244'")
    .get();
  await expect(reapplyEventAction("EV-0244")).rejects.toThrow(
    /redirect:\/events\/EV-\d+\/prepare/,
  );
  expect(
    getDb().prepare("SELECT * FROM events WHERE id='EV-0244'").get(),
  ).toEqual(source);
});

test("a venue is history: renewal and reassessment are refused, and the earlier certificate and record stay as they were", async () => {
  // Hosting venue registration is replaced by Facility/Site registration (owner, 9 October 2026).
  as("test_organizer");
  const db = getDb();
  const venue = db
    .prepare(
      "SELECT id, moph_reference FROM venues WHERE account_id = ? AND level IS NOT NULL LIMIT 1",
    )
    .get(session.account!.id) as { id: string; moph_reference: string };
  const before = db
    .prepare("SELECT version, certificate_snapshot FROM venue_assessments WHERE venue_id = ? ORDER BY version")
    .all(venue.id);
  db.prepare("INSERT INTO venue_changes (venue_id, aspects, description, effective_date) VALUES (?, ?, ?, ?)").run(venue.id, JSON.stringify(['name']), 'Venue renamed', '2026-09-26');
  await expect(renewVenuePackageAction(venue.id)).rejects.toThrow(`redirect:/venues/${venue.id}`);
  expect(
    await saveVenueAssessmentAction(venue.id, {
      answers: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      attendance: 1500,
      representative: "Test representative",
      position: "Operator",
    }),
  ).toEqual({ error: "locked" });
  expect(db.prepare("SELECT id, moph_reference FROM venues WHERE id = ?").get(venue.id)).toEqual(venue);
  expect(
    db.prepare("SELECT version, certificate_snapshot FROM venue_assessments WHERE venue_id = ? ORDER BY version").all(venue.id),
  ).toEqual(before);
});

test("an incident can be recorded inside the window but future occurrences are refused", async () => {
  as("test_organizer");
  const db = getDb();
  db.prepare(
    "UPDATE events SET start_date='2026-08-12', end_date='2026-08-13', closing_time='18:00', filed=1 WHERE id='EV-0362'",
  ).run();
  const form = new FormData();
  form.set("incidentType", "major");
  form.set("occurredAt", "2026-08-13T13:00");
  await expect(notifySeriousIncidentAction("EV-0362", form)).rejects.toThrow(
    "error=incomplete",
  );
  form.set("occurredAt", "2026-08-13T11:00");
  await expect(notifySeriousIncidentAction("EV-0362", form)).rejects.toThrow(
    "notice=notified",
  );
  expect(
    db
      .prepare(
        "SELECT incident_type FROM serious_incident_notifications WHERE event_id='EV-0362' AND occurred_at='2026-08-13T11:00'",
      )
      .get(),
  ).toHaveProperty("incident_type", "major");
});

test("every superseded plan answer stays readable in the answer history", async () => {
  as("test_ems");
  const owner = Number(getDb().prepare("SELECT account_id FROM events WHERE id='EV-0362'").get()!.account_id);
  const before = itemText(owner, "M02");
  expect(await saveItem("M02", "Replaced wording")).toHaveProperty("ok", true);
  expect(itemText(owner, "M02")).toBe("Replaced wording");
  const current = getDb().prepare("SELECT version FROM requirement_answers WHERE record_kind='event' AND record_id='EV-0362' AND key='M02'").get() as { version: number };
  const old = getDb().prepare("SELECT answers FROM requirement_answer_history WHERE record_kind='event' AND record_id='EV-0362' AND key='M02' AND version=?").get(current.version - 1) as { answers: string } | undefined;
  expect(old ? (JSON.parse(old.answers) as { text: string }).text : null).toBe(before);
});

test("removed medical partners and lower-level organizers cannot edit plans",async()=>{
 as('test_ems');
 getDb().prepare("UPDATE invitations SET status='removed' WHERE event_id='EV-0362' AND account_id=? AND kind='ems'").run(session.account!.id);
 expect(await saveItem('M03','Removed agency')).toEqual({error:'not-found'});
 // A Level 2 organizer owns the record and still may not write the plan: the catalogue names the medical team.
 as('test_organizer');expect(await saveRequirementAnswerAction('event','EV-0418','P13',{baseVersion:0,values:{text:'Organizer Level 2 plan'}})).toEqual({error:'forbidden'});
});

test('plan responsibility and organizer next steps follow the level',()=>{
 for(const level of [1,2,3]) expect(canPreparePlan(level,'organizer')).toBe(false);
 for(const role of ['ems','director'] as const)expect(canPreparePlan(1,role)).toBe(false);
 // D1: the EMS agency prepares the Level 2 plan; there is no Director below Level 3.
 expect(canPreparePlan(2,'ems')).toBe(true);expect(canPreparePlan(2,'director')).toBe(false);
 expect(canPreparePlan(3,'organizer')).toBe(false);expect(canPreparePlan(3,'ems')).toBe(true);expect(canPreparePlan(3,'director')).toBe(true);
 // The plan is the medical team's work at both levels: the organizer's next step waits on them, never asks them to write it.
 const base={service:'event' as const,editable:true,filed:false,returned:false,organizationPending:false};
 const waiting=(level:2|3)=>recordNextStep({...base,level,instances:resolveRequirements({service:'event',level,answers:{},files:{},organizerContact:{name:'O',phone:'1'},assessmentComplete:true,ems:[{token:'e',name:'EMS',status:'confirmed'}],director:{token:'d',name:'Dr',status:'confirmed'},planApprovalCurrent:false,declaration:{statementsComplete:true,certificationComplete:true},requested:level===2?['B2']:[]})});
 expect(waiting(3)!.kind).toBe('requirements');
 expect(waiting(2)!.kind).toBe('requirements');
});
