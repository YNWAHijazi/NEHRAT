import { notFound, redirect } from "next/navigation";
import { VenueRetiredNotice } from '../../../../components/venue/VenueRetiredNotice';
import Link from "next/link";
import { currentAccount } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { venueById, venueAssessmentsFor } from "../../../../lib/queries";
import { can } from "../../../../lib/rules/ministry";
import { PrintButton } from "../../../../components/PrintButton";
import { L } from "../../../../components/L";
import { siteIdForVenue } from "../../../../lib/sites";
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
  const siteId = siteIdForVenue(id);
  const row2 = (en: string, ar: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4px 24px', padding: '10px 0', borderBlockEnd: '1px solid var(--line)', fontSize: 15 }}>
      <span style={{ color: 'var(--muted)' }}><L en={en} ar={ar} /></span>
      <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>{value}</span>
    </div>
  );
  return (
    <main data-region="certificate" style={{ maxWidth: 820, margin: '40px auto', padding: 32 }}>
      <nav data-no-print="" style={{ marginBlockEnd: 24 }}>
        <Link href={owner.account_id === account.id ? `/venues/${id}` : '/ministry/venues'}><L en="Back" ar="رجوع" /></Link>
        {owner.account_id === account.id ? <div style={{ marginBlockStart: 16 }}><VenueRetiredNotice venueId={id} accountId={account.id} /></div> : null}
      </nav>
      <div style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 8 }}>
        <L en="Ministry of Public Health" ar="وزارة الصحة العامة" />
      </div>
      {/* The certificate's name and classification line are the partner's wording (Hosting Venue Registration, 8 October 2026). */}
      <h1 style={{ margin: '0 0 20px', fontSize: 28, lineHeight: 1.3, fontWeight: 600 }}>
        <L en="Hosting Venue Annual Health & Medical Readiness Certificate" ar="شهادة التأهب الصحي والطبي السنوية لموقع استضافة الفعاليات" />
      </h1>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600 }}>
        <L en={snapshot.nameEn ?? venue.nameEn} ar={snapshot.nameAr ?? venue.nameAr} />
      </h2>
      <p style={{ margin: '0 0 20px', color: 'var(--muted)' }}>
        <L en={snapshot.addressEn ?? venue.addressMunicipalityEn} ar={snapshot.addressAr ?? venue.addressMunicipalityAr} />
      </p>
      <p data-region="certificate-classification" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 600 }}>
        <L en={`Annual NEHRAT Classification: Level ${level ?? '—'}`} ar={`التصنيف السنوي وفق التقييم الوطني للمخاطر الصحية للفعاليات (NEHRAT): المستوى ${level ?? '—'}`} />
      </p>
      <div style={{ marginBlockEnd: 24 }}>
        {row2('Record ID', 'معرّف السجل', id)}
        {siteId ? row2('Site ID', 'معرّف المكان', siteId) : null}
        {row2('Certificate', 'الشهادة', String(row.version))}
        {row2('Valid', 'الصلاحية', <L en={`${row.effective} to ${row.valid_until}`} ar={`من ⁦${row.effective}⁩ إلى ⁦${row.valid_until}⁩`} />)}
        {snapshot.capacity ?? venue.licensedCapacity ? row2('Approved or licensed capacity', 'السعة المعتمدة أو المرخّصة', String(snapshot.capacity ?? venue.licensedCapacity)) : null}
      </div>
      <div data-region="certificate-scope" style={{ paddingBlock: 14, paddingInlineStart: 18, paddingInlineEnd: 18, background: 'var(--surface2)', borderInlineStart: '3px solid var(--brand)', borderRadius: 10, marginBlockEnd: 24, fontSize: 15, lineHeight: 1.7 }}>
        <p style={{ margin: '0 0 8px' }}>
          <L en="This certificate records the venue’s routine readiness baseline for one year. It is not an event registration." ar="تسجّل هذه الشهادة خط الأساس الاعتيادي لتأهب الموقع لمدة سنة واحدة. وهي ليست تسجيلاً لفعالية." />
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <L en="Each event held at the venue remains subject to its own event registration and to the health and medical preparedness requirements that apply to it." ar="تبقى كل فعالية تُقام في الموقع خاضعة لتسجيلها الخاص ولمتطلبات التأهب الصحي والطبي المنطبقة عليها." />
        </p>
        <p style={{ margin: 0 }}>
          <L en="The classification does not mean that EMS or an Event Medical Director is permanently provided at the venue." ar="ولا يعني التصنيف أن خدمات الإسعاف أو مديراً طبياً للفعالية متوفرة بشكل دائم في الموقع." />
        </p>
      </div>
      <PrintButton en="Print or save PDF" ar="طباعة أو حفظ PDF" />
    </main>
  );
}
