import { notFound, redirect } from "next/navigation";
import { getDb } from "../../../../lib/db";
import { currentAccount, organizationFor } from "../../../../lib/auth";
import {
  eventFor,
  assessmentsFor,
  postEventReportFor,
  seriousIncidentNotificationsFor,
  unreadCountFor,
} from "../../../../lib/queries";
import { GovernmentBand, Header } from "../../../../components/Header";
import { L } from "../../../../components/L";
import {
  BANDS,
  DOMAINS,
  DOMAIN_COUNT,
  MAX_SCORE_PER_DOMAIN,
  MINIMUM_CONDITIONS,
} from "../../../../lib/rules";
import { AssessmentForm } from "../../new/AssessmentForm";
import { PreviousIncidentNotice } from "./PreviousIncidentNotice";
export default async function Prepare({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect("/signin");
  const { id } = await params;
  const event = eventFor(account.id, id);
  if (!event) notFound();
  if (event.filed) redirect(`/events/${id}`);
  const assessment = assessmentsFor(account.id, id)[0];
  if (!assessment) redirect(`/events/${id}/edit`);
  const row = getDb()
    .prepare(
      "SELECT event_type, venue_route, municipalities, opening_time, closing_time, expected_participants, expected_spectators, expected_staff, previous_edition, recurring_fixed_venue FROM events WHERE id = ? AND account_id = ?",
    )
    .get(id, account.id)!;
  const source = event.copiedFrom
    ? eventFor(account.id, event.copiedFrom)
    : null;
  const report = source ? postEventReportFor(account.id, source.id) : null;
  const incidents = source
    ? seriousIncidentNotificationsFor(account.id, source.id)
    : [];
  const hasIncident =
    incidents.length > 0 ||
    Object.values(report?.significant ?? {}).some(Boolean);
  return (
    <>
      <GovernmentBand />
      <Header
        unreadCount={unreadCountFor(account.id)}
        account={account}
        organization={organizationFor(account.id)}
        showBack={true}
      />
      <main
        data-pad=""
        style={{
          maxWidth: 1160,
          marginInline: "auto",
          padding: "40px 32px 100px",
        }}
      >
        {source ? (
          <p>
            <L
              en={`Copied from ${source.nameEn}. Enter the new dates and review the details.`}
              ar={`نُسخت من ${source.nameAr}. أدخلوا التواريخ الجديدة وراجعوا التفاصيل.`}
            />
          </p>
        ) : null}
        {source && hasIncident ? (
          <PreviousIncidentNotice
            sourceId={source.id}
            hasReport={Boolean(report)}
            count={incidents.length}
          />
        ) : null}
        <AssessmentForm
          domains={[...DOMAINS]}
          conditions={[...MINIMUM_CONDITIONS]}
          bands={[...BANDS]}
          maxScore={DOMAIN_COUNT * MAX_SCORE_PER_DOMAIN}
          draft={{
            eventId: id,
            nameEn: event.nameEn,
            nameAr: event.nameAr,
            startDate: event.startDate ?? "",
            endDate: event.endDate ?? "",
            answers: assessment.answers,
            inputs: assessment.inputs,
            representative: "",
            position: "",
            partA: {
              eventType: String(row.event_type ?? ""),
              venueRoute: String(row.venue_route ?? ""),
              municipalities: String(row.municipalities ?? ""),
              openingTime: String(row.opening_time ?? ""),
              closingTime: String(row.closing_time ?? ""),
              expectedParticipants: row.expected_participants as number | null,
              expectedSpectators: row.expected_spectators as number | null,
              expectedStaff: row.expected_staff as number | null,
              previousEdition: Boolean(row.previous_edition),
              recurringFixedVenue: Boolean(row.recurring_fixed_venue),
            },
          }}
        />
      </main>
    </>
  );
}
