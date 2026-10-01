import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentAccount } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { venueById, venueAssessmentsFor } from "../../../../lib/queries";
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
      `SELECT version,derivation,effective,valid_until,certificate_snapshot FROM venue_assessments WHERE venue_id = ? AND certificate_issued=1 ${version ? "AND version = ?" : ""} ORDER BY version DESC LIMIT 1`,
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
  // Seeded certificates store a placeholder rather than a derivation: the certificate then states the
  // level the venue was certified at (the latest certificate) or the version's re-derived level.
  const latestIssued = (getDb().prepare('SELECT MAX(version) AS v FROM venue_assessments WHERE venue_id = ? AND certificate_issued = 1').get(id) as { v: number | null }).v;
  const certifiedLevel = (getDb().prepare('SELECT level FROM venues WHERE id = ?').get(id) as { level: number | null } | undefined)?.level ?? null;
  const level: number | null = derivation.finalLevel ?? (row.version === latestIssued ? certifiedLevel : null) ?? venueAssessmentsFor(owner.account_id, id).find((v) => v.version === row.version)?.derivation.finalLevel ?? null;
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
        {id}
      </p>
      <p>
        <L
          en={`Certificate ${row.version} · Level ${level ?? '—'}`}
          ar={`الشهادة ${row.version} · المستوى ${level ?? '—'}`}
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
