import Link from "next/link";
import { L } from "../../components/L";
import { PublicShell } from "../../components/PublicShell";
import { pendingEmailChallenge } from "../../lib/email-verification";
import { verifyCode, resendCode } from "./actions";
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const pending = await pendingEmailChallenge();
  const { error, notice } = await searchParams;
  return (
    <PublicShell signedIn={false}>
      <section style={{ maxWidth: 460, margin: "40px auto" }}>
        <h1>
          <L en="Check your email" ar="تحقّقوا من بريدكم" />
        </h1>
        {pending ? (
          <>
            <p>
              <L
                en="Enter the 6-digit code. It is valid for 10 minutes."
                ar="أدخلوا الرمز المكوّن من 6 أرقام. صلاحيته 10 دقائق."
              />
            </p>
            {error ? (
              <p role="alert">
                <L
                  en="Invalid or expired code. Please try again."
                  ar="الرمز غير صحيح أو منتهي الصلاحية. حاولوا مجدداً."
                />
              </p>
            ) : null}
            <form action={verifyCode} style={{ display: "grid", gap: 16 }}>
              <label>
                <L en="Verification code" ar="رمز التحقق" />
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  style={{
                    display: "block",
                    fontSize: 26,
                    letterSpacing: 8,
                    padding: 12,
                    width: "100%",
                  }}
                />
              </label>
              <button type="submit">
                <L en="Verify and continue" ar="تحقق ومتابعة" />
              </button>
            </form>
            <form action={resendCode} style={{ marginBlock: 20 }}>
              <button>
                <L en="Send a new code" ar="إرسال رمز جديد" />
              </button>
            </form>
            {notice ? (
              <p role="status">
                <L
                  en={
                    notice === "sent"
                      ? "New code sent."
                      : notice === "limited"
                        ? "Please wait before requesting another code."
                        : "Email is unavailable. Please try later."
                  }
                  ar={
                    notice === "sent"
                      ? "أُرسل رمز جديد."
                      : notice === "limited"
                        ? "انتظروا قبل طلب رمز آخر."
                        : "البريد غير متاح. حاولوا لاحقاً."
                  }
                />
              </p>
            ) : null}
          </>
        ) : (
          <p>
            <L
              en="This code has expired or reached its attempt limit. Sign in again to get a new code."
              ar="انتهت صلاحية الرمز أو استُنفدت المحاولات. سجّلوا الدخول مجدداً لطلب رمز جديد."
            />
          </p>
        )}
        <Link href="/signin">
          <L en="Back to sign in" ar="العودة لتسجيل الدخول" />
        </Link>
      </section>
    </PublicShell>
  );
}
