/**
 * What every surface that renders a record's requirements needs, assembled once: the
 * resolved record, the stored content types for the inline viewer, and the two derived
 * plan sections' text. The organizer's page, the Director's page, the EMS agency's
 * pages and the reviewer all read the same object, so they cannot disagree.
 */

import { organizationFor } from './auth';
import { attachmentsFor, eventFor, facilityById, facilityDevices, facilityPlanConfirmation, governanceFor, venueRouteFor } from './queries';
import { catalogueKeyForDocument, eventRecordRequirements, type RecordRequirements } from './record-facts';
import type { ReferenceDeviceFacts } from './rules';

export interface RecordView {
  record: RecordRequirements;
  contentTypes: Record<string, string | null>;
  derived: { scheduleEn: string; scheduleAr: string; contactsEn: string; contactsAr: string; organizerPhoneMissing: boolean };
  /** The Director's clinical-governance text, read into plan sections 10 and 12. */
  governance: Record<string, string>;
  /** Set where the venue is itself a registered covered facility (SPEC 2e): a reference, never a copy. */
  facility: { nameEn: string; nameAr: string; devices: number; facts: ReferenceDeviceFacts } | null;
}

export function eventRecordView(ownerId: number, eventId: string): RecordView | null {
  const record = eventRecordRequirements(ownerId, eventId);
  const event = eventFor(ownerId, eventId);
  if (!record || !event) return null;
  const organization = organizationFor(ownerId);
  const contentTypes: Record<string, string | null> = {};
  for (const a of attachmentsFor(ownerId, eventId)) {
    const key = catalogueKeyForDocument(a.docKey);
    if (key) contentTypes[key] = a.contentType;
  }
  const venueRoute = venueRouteFor(ownerId, eventId);
  const dates = event.startDate === event.endDate ? (event.startDate ?? '—') : `${event.startDate} — ${event.endDate}`;
  const confirmed = record.parties.filter((p) => p.status === 'confirmed');
  const organizerName = record.facts?.organizerContact?.name ?? '';
  const facilityRow = event.venueFacilityId ? facilityById(ownerId, event.venueFacilityId) : null;
  const refDevices = facilityRow ? facilityDevices(facilityRow.id) : [];
  const facility = facilityRow
    ? {
        nameEn: facilityRow.nameEn, nameAr: facilityRow.nameAr, devices: refDevices.length,
        facts: {
          count: refDevices.length,
          locationsEn: refDevices.map((d) => d.locationEn),
          locationsAr: refDevices.map((d) => d.locationAr),
          anyPediatric: refDevices.some((d) => d.pediatric === 'yes'),
          planConfirmed: facilityPlanConfirmation(facilityRow.id)?.current === true,
        },
      }
    : null;
  return {
    record,
    contentTypes,
    governance: governanceFor(eventId),
    facility,
    derived: {
      scheduleEn: `${event.nameEn} · ${dates}${venueRoute ? ` · ${venueRoute}` : ''}`,
      scheduleAr: `${event.nameAr} · ⁦${dates}⁩${venueRoute ? ` · ${venueRoute}` : ''}`,
      contactsEn: [organization?.nameEn ?? organizerName, ...confirmed.map((p) => `${p.name} (${p.kind === 'ems' ? 'EMS agency' : 'Medical Director'})`)].filter(Boolean).join(' · '),
      contactsAr: [organization?.nameAr ?? organizerName, ...confirmed.map((p) => `${p.name} (${p.kind === 'ems' ? 'جهة الإسعاف' : 'المدير الطبي'})`)].filter(Boolean).join(' · '),
      organizerPhoneMissing: !record.facts?.organizerContact?.phone,
    },
  };
}
