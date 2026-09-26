import { getDb } from "../../lib/db";
import { redirect } from "next/navigation";
import { GovernmentBand, Header } from "../../components/Header";
import { L } from "../../components/L";
import { currentAccount, organizationFor } from "../../lib/auth";
import { unreadCountFor } from "../../lib/queries";
import { registerOrganizationAction } from "../actions";
export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const account = await currentAccount();
  if (!account) redirect("/signin");
  const org = organizationFor(account.id);
  const phone = (
    getDb()
      .prepare("SELECT phone FROM accounts WHERE id = ?")
      .get(account.id) as { phone: string }
  ).phone;
  return (
    <>
      <GovernmentBand />
      <Header
        account={account}
        organization={org}
        unreadCount={unreadCountFor(account.id)}
        showBack={true}
      />
      <main
        data-pad=""
        style={{
          maxWidth: 780,
          marginInline: "auto",
          padding: "40px 32px 100px",
        }}
      >
        <h1>
          <L en="Organization details" ar="بيانات المؤسسة" />
        </h1>
        {error ? (
          <p role="alert">
            <L
              en={
                error === "phone"
                  ? "Enter a phone number with a country code, starting with +."
                  : "Enter the organization name in both languages."
              }
              ar={
                error === "phone"
                  ? "أدخلوا رقم الهاتف مع رمز البلد، بدءاً بعلامة +."
                  : "أدخلوا اسم المؤسسة باللغتين."
              }
            />
          </p>
        ) : null}
        {notice === "saved" ? (
          <p role="status">
            <L en="Details saved." ar="حُفظت البيانات." />
          </p>
        ) : null}
        <form
          action={registerOrganizationAction}
          style={{ display: "grid", gap: 20 }}
        >
          <label>
            <L
              en="Organization name (English)"
              ar="اسم المؤسسة (بالإنكليزية)"
            />
            <input
              name="nameEn"
              required
              defaultValue={org?.nameEn ?? ""}
              style={{ display: "block", width: "100%", padding: 12 }}
            />
          </label>
          <label>
            <L en="Organization name (Arabic)" ar="اسم المؤسسة (بالعربية)" />
            <input
              name="nameAr"
              required
              defaultValue={org?.nameAr ?? ""}
              dir="rtl"
              style={{ display: "block", width: "100%", padding: 12 }}
            />
          </label>
          <label>
            <L
              en="Phone number (with country code)"
              ar="رقم الهاتف مع رمز البلد"
            />
            <input
              name="phone"
              type="tel"
              defaultValue={phone}
              style={{ display: "block", width: "100%", padding: 12 }}
            />
          </label>
          <button type="submit">
            <L en="Save details" ar="حفظ البيانات" />
          </button>
        </form>
      </main>
    </>
  );
}
