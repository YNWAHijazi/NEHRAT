import { beforeAll, afterAll, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  send: vi.fn(),
  configured: vi.fn(),
  session: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) =>
      mocks.jar.has(key) ? { value: mocks.jar.get(key) } : undefined,
    set: (key: string, value: string) => mocks.jar.set(key, value),
    delete: (key: string) => mocks.jar.delete(key),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("../lib/auth", () => ({ startSession: mocks.session }));
vi.mock("../lib/email", () => ({
  emailConfigured: mocks.configured,
  sendLinkEmail: mocks.send,
}));
import { getDb } from "../lib/db";
import {
  consumeEmailCode,
  issueEmailChallenge,
  verifiedSignIn,
  safeNext,
} from "../lib/email-verification";
const folder = mkdtempSync(join(tmpdir(), "moph-otp-"));
let id: number;
beforeAll(() => {
  vi.stubEnv("DATABASE_PATH", join(folder, "test.db"));
  id = Number(
    getDb()
      .prepare(
        "INSERT INTO accounts(login,email,display_name,initials,role,is_demo) VALUES ('otp-user','otp@example.test','OTP user','OU','organizer',0)",
      )
      .run().lastInsertRowid,
  );
});
beforeEach(() => {
  getDb().prepare("DELETE FROM email_challenges").run();
  mocks.jar.clear();
  mocks.send.mockReset().mockResolvedValue("sent");
  mocks.configured.mockReturnValue(true);
  mocks.session.mockReset();
  vi.stubEnv("REQUIRE_EMAIL_OTP", "true");
});
afterAll(() => {
  getDb().close();
  vi.unstubAllEnvs();
  rmSync(folder, { recursive: true, force: true });
});
function code() {
  return (mocks.send.mock.calls[0]![0] as { text: string }).text.match(
    /\b\d{6}\b/,
  )![0];
}
test("code is one use; neither token nor code are stored in plain text", async () => {
  expect(await issueEmailChallenge(id, "/events/new")).toBe("sent");
  const secret = code();
  const token = mocks.jar.get("email_challenge")!;
  const stored = getDb()
    .prepare("SELECT token_hash,code_hash FROM email_challenges")
    .get();
  expect(JSON.stringify(stored)).not.toContain(token);
  expect(JSON.stringify(stored)).not.toContain(secret);
  expect(await consumeEmailCode(secret)).toEqual({
    accountId: id,
    next: "/events/new",
  });
  expect(await consumeEmailCode(secret)).toBeNull();
});
test("five wrong attempts block the valid code", async () => {
  await issueEmailChallenge(id, "/dashboard");
  const secret = code();
  const wrong = secret === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) expect(await consumeEmailCode(wrong)).toBeNull();
  expect(await consumeEmailCode(secret)).toBeNull();
});
test("expired and suspended accounts cannot verify", async () => {
  await issueEmailChallenge(id, "/dashboard");
  const secret = code();
  getDb().prepare("UPDATE email_challenges SET expires_ms = 0").run();
  expect(await consumeEmailCode(secret)).toBeNull();
  getDb()
    .prepare("UPDATE email_challenges SET expires_ms = ?")
    .run(Date.now() + 600000);
  getDb().prepare("UPDATE accounts SET suspended=1 WHERE id=?").run(id);
  expect(await consumeEmailCode(secret)).toBeNull();
  getDb().prepare("UPDATE accounts SET suspended=0 WHERE id=?").run(id);
});
test("resend is rate limited and failed delivery cannot start a session", async () => {
  await issueEmailChallenge(id, "/dashboard");
  expect(await issueEmailChallenge(id, "/dashboard")).toBe("limited");
  expect(mocks.send).toHaveBeenCalledTimes(1);
  mocks.configured.mockReturnValue(false);
  await expect(verifiedSignIn(id)).rejects.toThrow("otp-unavailable");
  expect(mocks.session).not.toHaveBeenCalled();
});
test("enabled OTP creates no session before successful verification", async () => {
  await expect(verifiedSignIn(id, "/events/new")).rejects.toThrow(
    "redirect:/verify",
  );
  expect(mocks.session).not.toHaveBeenCalled();
});
test("service destinations reject external redirects", () => {
  expect(safeNext("//evil.test")).toBe("/dashboard");
  expect(safeNext("/events/new")).toBe("/events/new");
  expect(safeNext("/\\evil.test")).toBe("/dashboard");
});
