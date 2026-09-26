import policy from "./auth-policy.json";
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { startSession } from "./auth";
import { emailConfigured, sendLinkEmail } from "./email";
import { landingRouteFor } from "./rules";
const COOKIE = "email_challenge";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const emailOtpEnabled = () => process.env.REQUIRE_EMAIL_OTP === "true";
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  return typeof value === "string" &&
    /^(\/events\/new|\/venues\/new|\/facilities\/new|\/invitations\/[a-f0-9]{48})$/.test(
      value,
    )
    ? value
    : fallback;
}
export function validPhone(value: string): boolean {
  return value === "" || /^\+[1-9]\d{7,14}$/.test(value.replace(/[ ()-]/g, ""));
}
export async function issueEmailChallenge(
  accountId: number,
  next: string,
): Promise<"sent" | "unavailable" | "limited"> {
  const db = getDb();
  const row = db
    .prepare("SELECT email, suspended, is_demo FROM accounts WHERE id = ?")
    .get(accountId) as
    { email: string; suspended: number; is_demo: number } | undefined;
  if (!row || row.suspended || row.is_demo || !emailConfigured())
    return "unavailable";
  const now = Date.now();
  const recent = db
    .prepare(
      "SELECT COUNT(*) AS n, MAX(created_ms) AS last FROM email_challenges WHERE account_id = ? AND created_ms > ?",
    )
    .get(accountId, now - 3600000) as { n: number; last: number | null };
  if (
    recent.n >= policy.maxCodesPerHour ||
    (recent.last !== null && now - recent.last < policy.resendDelayMs)
  )
    return "limited";
  const token = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  db.prepare(
    "INSERT INTO email_challenges (token_hash,account_id,code_hash,next_path,created_ms,expires_ms) VALUES (?,?,?,?,?,?)",
  ).run(
    digest(token),
    accountId,
    digest(token + code),
    next,
    now,
    now + policy.codeLifetimeMs,
  );
  const sent = await sendLinkEmail({
    to: row.email,
    path: "/verify",
    subject: "Your sign-in code / رمز تسجيل الدخول",
    text: `Your code is ${code}. It expires in 10 minutes. Do not share it.\nرمزكم هو ${code}. تنتهي صلاحيته خلال 10 دقائق. لا تشاركوه.`,
    isDemo: false,
  });
  if (sent !== "sent") {
    db.prepare("UPDATE email_challenges SET used = 1 WHERE token_hash = ?").run(
      digest(token),
    );
    return "unavailable";
  }
  db.prepare(
    "UPDATE email_challenges SET used = 1 WHERE account_id = ? AND token_hash != ?",
  ).run(accountId, digest(token));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return "sent";
}
/** Call only after checking a password or one-use reset link. OTP never falls back on failure. */
export async function verifiedSignIn(
  accountId: number,
  next?: string,
): Promise<void> {
  const row = getDb()
    .prepare("SELECT role,is_demo,suspended FROM accounts WHERE id = ?")
    .get(accountId) as
    { role: string; is_demo: number; suspended: number } | undefined;
  if (!row || row.suspended) redirect("/signin?error=credentials");
  if (emailOtpEnabled() && !row.is_demo) {
    const result = await issueEmailChallenge(
      accountId,
      safeNext(next, landingRouteFor(row.role)),
    );
    redirect(result === "sent" ? "/verify" : `/signin?error=otp-${result}`);
  }
  await startSession(accountId);
}
export async function pendingEmailChallenge() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      "SELECT account_id,next_path,expires_ms FROM email_challenges WHERE token_hash = ? AND used = 0 AND attempts < ?",
    )
    .get(digest(token), policy.maxCodeAttempts) as
    { account_id: number; next_path: string; expires_ms: number } | undefined;
  return row && row.expires_ms > Date.now() ? row : null;
}
export async function consumeEmailCode(
  code: string,
): Promise<{ accountId: number; next: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare(
        "SELECT account_id,code_hash,next_path FROM email_challenges WHERE token_hash = ? AND used = 0 AND attempts < ? AND expires_ms > ?",
      )
      .get(digest(token), policy.maxCodeAttempts, Date.now()) as
      { account_id: number; code_hash: string; next_path: string } | undefined;
    if (!row) {
      db.exec("COMMIT");
      return null;
    }
    db.prepare(
      "UPDATE email_challenges SET attempts = attempts + 1 WHERE token_hash = ?",
    ).run(digest(token));
    const matches =
      /^\d{6}$/.test(code) &&
      timingSafeEqual(
        Buffer.from(digest(token + code), "hex"),
        Buffer.from(row.code_hash, "hex"),
      );
    if (!matches) {
      db.exec("COMMIT");
      return null;
    }
    const account = db
      .prepare("SELECT suspended FROM accounts WHERE id = ?")
      .get(row.account_id) as { suspended: number } | undefined;
    db.prepare("UPDATE email_challenges SET used = 1 WHERE token_hash = ?").run(
      digest(token),
    );
    if (!account || account.suspended) {
      db.exec("COMMIT");
      return null;
    }
    db.prepare(
      "UPDATE accounts SET email_verified_at = now_stamp() WHERE id = ?",
    ).run(row.account_id);
    db.exec("COMMIT");
    (await cookies()).delete(COOKIE);
    return { accountId: row.account_id, next: row.next_path };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
