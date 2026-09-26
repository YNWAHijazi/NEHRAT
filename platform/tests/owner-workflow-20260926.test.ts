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
  uploadPlanFileAction,
  saveVenueAssessmentAction,
  savePlanAction,
  attachDocumentAction,
  notifySeriousIncidentAction,
  savePostEventReportAction,
  updateDraftEventAction,
  reapplyEventAction,
  type PlanPayload,
} from "../app/actions";
import { planFor } from "../lib/queries";
import { planIsComplete } from "../lib/rules/submission";
import { seriousIncidentGate } from "../lib/rules/gates";
import {
  eventApplicability,
  venueApplicability,
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
function payload(owner: number): PlanPayload {
  const p = planFor(owner, "EV-0362")!;
  return { ...p, baseVersion: p.version };
}
test("public check accepts any remaining criterion and all six facility categories", () => {
  expect(eventApplicability([]).en).toBe("Certification not required");
  for (let i = 0; i < 5; i++)
    expect(eventApplicability([i]).route).toBe("/services/certify-an-event");
  expect(eventApplicability([5, NaN, -1]).route).toBeNull();
  expect(venueApplicability(true, false).route).toBeNull();
  expect(venueApplicability(true, true).route).toBe(
    "/services/register-a-venue",
  );
  for (let i = 0; i < 6; i++)
    expect(facilityApplicability(i)?.route).toBe(
      "/services/register-a-facility",
    );
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
test("organizer cannot overwrite the medical section; EMS can only update that section", async () => {
  as("test_organizer");
  const owner = session.account!.id;
  const before = planFor(owner, "EV-0362")!;
  const org = payload(owner);
  org.sections = { ...org.sections, "12": { text: "Unauthorized override" } };
  org.majorIncident = { "1": { covered: false } };
  expect(await savePlanAction("EV-0362", org)).toHaveProperty("ok", true);
  expect(planFor(owner, "EV-0362")!.sections["12"]).toEqual(
    before.sections["12"],
  );
  expect(planFor(owner, "EV-0362")!.majorIncident).toEqual(
    before.majorIncident,
  );
  as("test_ems");
  const ems = payload(owner);
  ems.sections = {
    "1": { text: "Unauthorized general section" },
    "12": { text: "EMS major-incident arrangements" },
  };
  expect(await savePlanAction("EV-0362", ems)).toHaveProperty("ok", true);
  const after = planFor(owner, "EV-0362")!;
  expect(after.sections["1"]).toEqual(before.sections["1"]);
  expect(after.sections["12"]?.text).toBe("EMS major-incident arrangements");
  expect(await savePlanAction("EV-0362", ems)).toEqual({ error: "conflict" });
});
test("only confirmed Level 3 director can upload the deployment map", async () => {
  const form = new FormData();
  form.set("docKey", "deploymentMap");
  form.set("file", new File(["map"], "map.pdf", { type: "application/pdf" }));
  as("test_organizer");
  await expect(attachDocumentAction("EV-0362", form)).rejects.toThrow(
    "redirect:/dashboard",
  );
  as("test_ems");
  await expect(attachDocumentAction("EV-0362", form)).rejects.toThrow(
    "redirect:/dashboard",
  );
  as("test_director");
  await expect(attachDocumentAction("EV-0362", form)).rejects.toThrow(
    "/requirements",
  );
  expect(
    getDb()
      .prepare(
        "SELECT file_name FROM event_attachments WHERE event_id='EV-0362' AND doc_key='deploymentMap'",
      )
      .get(),
  ).toHaveProperty("file_name", "map.pdf");
});
test("incident window closes exactly 24 hours after the recorded closing time in Beirut", () => {
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
  expect(
    seriousIncidentGate({
      ...context,
      now: new Date("2026-08-13T18:00:00+03:00"),
    }),
  ).toHaveProperty("reasonKey", "gate.seriousIncidentClosed");
  const winter = {
    ...context,
    eventStartDate: "2026-01-12",
    eventEndDate: "2026-01-12",
    now: new Date("2026-01-13T18:00:00+02:00"),
  };
  expect(seriousIncidentGate(winter)).toHaveProperty(
    "reasonKey",
    "gate.seriousIncidentClosed",
  );
});
test("direct requests cannot report incidents after the window or edit submitted reports", async () => {
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
    "error=closed",
  );
  expect(
    (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM serious_incident_notifications WHERE event_id='EV-0362'",
        )
        .get() as { n: number }
    ).n,
  ).toBe(count);
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

test("renewal keeps the venue ID and reference while earlier certificate details stay unchanged", async () => {
  as("test_organizer");
  const db = getDb();
  const venue = db
    .prepare(
      "SELECT id, moph_reference FROM venues WHERE account_id = ? AND level IS NOT NULL LIMIT 1",
    )
    .get(session.account!.id) as { id: string; moph_reference: string };
  const previous = db
    .prepare(
      "SELECT version, certificate_snapshot FROM venue_assessments WHERE venue_id = ? ORDER BY version DESC LIMIT 1",
    )
    .get(venue.id) as { version: number; certificate_snapshot: string };
  db.prepare("UPDATE venues SET name_en = ? WHERE id = ?").run(
    "Updated venue name",
    venue.id,
  );
  expect(
    await saveVenueAssessmentAction(venue.id, {
      answers: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      attendance: 1500,
      representative: "Test representative",
      position: "Operator",
    }),
  ).toHaveProperty("level");
  expect(
    db
      .prepare("SELECT id, moph_reference FROM venues WHERE id = ?")
      .get(venue.id),
  ).toEqual(venue);
  expect(
    db
      .prepare(
        "SELECT certificate_snapshot FROM venue_assessments WHERE venue_id = ? AND version = ?",
      )
      .get(venue.id, previous.version),
  ).toHaveProperty("certificate_snapshot", previous.certificate_snapshot);
  const latest = db
    .prepare(
      "SELECT version, certificate_snapshot FROM venue_assessments WHERE venue_id = ? ORDER BY version DESC LIMIT 1",
    )
    .get(venue.id) as { version: number; certificate_snapshot: string };
  expect(latest.version).toBe(previous.version + 1);
  expect(JSON.parse(latest.certificate_snapshot).nameEn).toBe(
    "Updated venue name",
  );
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

test("a replacement Level 3 plan requires a fresh medical review and keeps the previous version", async () => {
  as("test_organizer");
  const before = planFor(session.account!.id, "EV-0362")!;
  const form = new FormData();
  form.set("baseVersion", String(before.version));
  form.set(
    "file",
    new File(["%PDF-1.4 replacement"], "replacement.pdf", {
      type: "application/pdf",
    }),
  );
  const result = await uploadPlanFileAction("EV-0362", form);
  expect(result).toHaveProperty("ok", true);
  const after = planFor(session.account!.id, "EV-0362")!;
  expect(after.version).toBe(before.version + 1);
  expect(after.sections["12"]).toBeUndefined();
  expect(after.majorIncident).toEqual({});
  expect(after.attachedFile).toBe("replacement.pdf");
  const old = getDb()
    .prepare(
      "SELECT sections FROM plan_versions WHERE event_id = ? AND version = ?",
    )
    .get("EV-0362", before.version) as { sections: string };
  expect(JSON.parse(old.sections)).toEqual(before.sections);
});
