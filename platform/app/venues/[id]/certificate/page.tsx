import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentAccount } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { venueById } from "../../../../lib/queries";
import { can } from "../../../../lib/rules/ministry";
import { PrintButton } from "../../../../components/PrintButton";
import { L } from "../../../../components/L";
export default async function Certificate({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect("/signin");
  const { id } = await params;
  const { version } = await searchParams;
  const owner = getDb()
    .prepare("SELECT account_id, is_demo FROM venues WHERE id = ?")
    .get(id) as { account_id: number; is_demo: number } | undefined;
  if (
    !owner ||
    owner.is_demo !== Number(account.isDemo) ||
    (owner.account_id !== account.id && !can(account.role, "viewSubmission"))
  )
    notFound();
  const venue = venueById(owner.account_id, id);
  if (!venue) notFound();
  if (version && !/^[1-9]\d*$/.test(version)) notFound();
  const row = getDb()
    .prepare(
      `SELECT version,derivation,effective,valid_until,certificate_snapshot FROM venue_assessments WHERE venue_id = ? ${version ? "AND version = ?" : ""} ORDER BY version DESC LIMIT 1`,
    )
    .get(...(version ? [id, Number(version)] : [id])) as
    | {
        version: number;
        derivation: string;
        effective: string;
        valid_until: string;
        certificate_snapshot: string;
      }
    | undefined;
  if (!row) notFound();
  const snapshot = JSON.parse(row.certificate_snapshot);
  const derivation = JSON.parse(row.derivation);
  return (
    <main
      data-region="certificate"
      style={{ maxWidth: 820, margin: "40px auto", padding: 32 }}
    >
      <nav data-no-print="">
        <Link
          href={
            owner.account_id === account.id
              ? `/venues/${id}`
              : "/ministry/venues"
          }
        >
          <L en="Back" ar="رجوع" />
        </Link>
      </nav>
      <h1>
        <L
          en="Hosting venue classification certificate"
          ar="شهادة تصنيف موقع استضافة الفعاليات"
        />
      </h1>
      <h2>
        <L
          en={snapshot.nameEn ?? venue.nameEn}
          ar={snapshot.nameAr ?? venue.nameAr}
        />
      </h2>
      <p>
        {id} · {venue.mophReference}
      </p>
      <p>
        <L
          en={`Certificate ${row.version} · Level ${derivation.finalLevel}`}
          ar={`الشهادة ${row.version} · المستوى ${derivation.finalLevel}`}
        />
      </p>
      <p>
        <L
          en={`Valid from ${row.effective} to ${row.valid_until}`}
          ar={`صالحة من ${row.effective} إلى ${row.valid_until}`}
        />
      </p>
      <p>
        <L
          en={snapshot.addressEn ?? venue.addressMunicipalityEn}
          ar={snapshot.addressAr ?? venue.addressMunicipalityAr}
        />
      </p>
      <PrintButton en="Print or save PDF" ar="طباعة أو حفظ PDF" />
    </main>
  );
}
