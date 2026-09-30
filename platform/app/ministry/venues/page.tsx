import { VENUE_STATUS, type VenuePackageStatus } from '../../../lib/rules/venue-workflow';
import { ServiceSearch } from "../../../components/ServiceSearch";
import Link from "next/link";
import { MinistryShell } from "../../../components/MinistryShell";
import { L } from "../../../components/L";
import { requireMinistryPage } from "../../../lib/ministry-auth";
import { getDb } from "../../../lib/db";
import { beirutToday } from "../../../lib/clock";
export default async function Venues({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const account = await requireMinistryPage("viewMinistry");
  const { q = "" } = await searchParams;
  const rows = getDb()
    .prepare(
      "SELECT v.id,v.name_en,v.name_ar,v.level,v.valid_until,v.moph_reference,p.status,p.submitted_at FROM venues v LEFT JOIN venue_packages p ON p.venue_id=v.id WHERE v.is_demo = ? ORDER BY CASE WHEN p.status='submitted' THEN 0 ELSE 1 END,p.submitted_at DESC,v.valid_until ASC",
    )
    .all(Number(account.isDemo)) as unknown as {
    status:string|null;submitted_at:string|null;
    id: string;
    name_en: string;
    name_ar: string;
    level: number | null;
    valid_until: string | null;
    moph_reference: string | null;
  }[];
  const today = beirutToday();
  const filtered = rows.filter((v) =>
    Object.values(v).join(" ").toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <MinistryShell account={account}>
      <h1>
        <L en="Hosting venues" ar="مواقع استضافة الفعاليات" />
      </h1>
      <p>
        <L
          en={`${rows.length} venues · ${rows.filter((v) => v.valid_until && v.valid_until < today).length} expired certificates`}
          ar={`${rows.length} مواقع · ${rows.filter((v) => v.valid_until && v.valid_until < today).length} شهادات منتهية`}
        />
      </p>
      <ServiceSearch
        value={q}
        en="Search hosting venues"
        ar="البحث عن مواقع استضافة الفعاليات"
      />
      {filtered.length === 0 ? (
        <p>
          <L en="No matching hosting venues." ar="لا توجد مواقع مطابقة." />
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((v) => (
          <article
            key={v.id}
            style={{
              background: "var(--surface2)",
              padding: 20,
              borderRadius: 12,
            }}
          >
            <h2 style={{ fontSize: 18 }}>
              <L en={v.name_en} ar={v.name_ar} />
            </h2>
            <p>
              {v.id}
            </p>
            <p>
              <L
                en={
                  v.valid_until
                    ? `Valid until ${v.valid_until}`
                    : "Assessment pending"
                }
                ar={
                  v.valid_until
                    ? `صالحة حتى ${v.valid_until}`
                    : "بانتظار التقييم"
                }
              />
            </p>
            {v.status&&v.status in VENUE_STATUS?<p><L en={VENUE_STATUS[v.status as VenuePackageStatus].en} ar={VENUE_STATUS[v.status as VenuePackageStatus].ar}/></p>:null}
            {v.submitted_at?<p><Link href={`/ministry/venues/${v.id}`}><L en="Review submission" ar="مراجعة الطلب"/></Link></p>:null}
            {v.valid_until ? (
              <>
                <Link href={`/venues/${v.id}/certificate`}>
                  <L en="View certificate" ar="عرض الشهادة" />
                </Link>
                <details>
                  <summary>
                    <L en="Certificate history" ar="الشهادات السابقة" />
                  </summary>
                  {(
                    getDb()
                      .prepare(
                        "SELECT version,effective,valid_until FROM venue_assessments WHERE venue_id = ? AND certificate_issued=1 ORDER BY version DESC",
                      )
                      .all(v.id) as unknown as {
                      version: number;
                      effective: string;
                      valid_until: string;
                    }[]
                  ).map((a) => (
                    <p key={a.version}>
                      <Link
                        href={`/venues/${v.id}/certificate?version=${a.version}`}
                      >
                        {a.effective} — {a.valid_until}
                      </Link>
                    </p>
                  ))}
                </details>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </MinistryShell>
  );
}
