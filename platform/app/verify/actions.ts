"use server";
import { redirect } from "next/navigation";
import {
  consumeEmailCode,
  pendingEmailChallenge,
  issueEmailChallenge,
} from "../../lib/email-verification";
import { startSession } from "../../lib/auth";
export async function verifyCode(form: FormData) {
  const verified = await consumeEmailCode(
    String(form.get("code") ?? "").trim(),
  );
  if (!verified) redirect("/verify?error=code");
  await startSession(verified.accountId);
  redirect(verified.next);
}
export async function resendCode() {
  const pending = await pendingEmailChallenge();
  if (!pending) redirect("/signin");
  const result = await issueEmailChallenge(
    pending.account_id,
    pending.next_path,
  );
  redirect(`/verify?notice=${result}`);
}
