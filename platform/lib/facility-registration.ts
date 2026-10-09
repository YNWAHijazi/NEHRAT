import { facilityDevices, facilityPersons, facilityPlanConfirmation } from './queries';
import { facilityAedStatus, facilityPoint } from './facility-gis';
import { getDb } from './db';
import { facilityInfrastructure } from './site-infrastructure';
import { aedPhotoCount, evidenceDocumentCount, siteApplicabilityFor, siteStatusFacts } from './site-registration';
import { categoryApplicabilityMode, siteRecordLocked, siteStatus } from './rules/site';
import { type FacilityRegistrationFacts } from './rules/facility-workflow';

/**
 * The facts the facility/site record's rules read (lib/rules/facility-workflow.ts and
 * lib/rules/site.ts), in one place: the record page, the certificate, the public
 * verification page and the Ministry's review screen all ask here, so the step colours,
 * the review page, the status and the certificate cannot disagree.
 */
export function facilityRegistrationFacts(id: string): FacilityRegistrationFacts {
  const devices = facilityDevices(id);
  const confirmation = facilityPlanConfirmation(id);
  const f = getDb()
    .prepare(`SELECT archived_at, name_en, operating_organization, address, municipality_en, operating_hours, phone, email,
                     access_point, ems_number, category_key, licensed_capacity FROM facilities WHERE id = ?`)
    .get(id) as {
      archived_at: string | null; name_en: string; operating_organization: string; address: string; municipality_en: string;
      operating_hours: string; phone: string; email: string; access_point: string; ems_number: string; category_key: string; licensed_capacity: number | null;
    } | undefined;
  const filled = (v: string | null | undefined) => Boolean(v && v.trim());
  const capacityNeeded = categoryApplicabilityMode(f?.category_key ?? '') === 'capacity';
  const infrastructure = facilityInfrastructure(id);
  const applicability = siteApplicabilityFor(id);
  const statusFacts = siteStatusFacts(id);
  return {
    archived: Boolean(f?.archived_at),
    mapConfirmed: Boolean(facilityPoint(id)),
    aedRequirement: facilityAedStatus(id),
    deviceCount: devices.length,
    devicesNotReady: devices.filter((d) => !d.operational || !d.accessibleHours).length,
    contactComplete: facilityPersons(id).some((p) => p.role === 'coordinator' && p.nameOrPosition && p.phone && p.email),
    confirmationRecorded: confirmation !== null,
    confirmationCurrent: Boolean(confirmation?.current),
    profileComplete: Boolean(f) && [f!.name_en, f!.operating_organization, f!.address, f!.municipality_en, f!.operating_hours, f!.phone, f!.email].every(filled)
      && (!capacityNeeded || f!.licensed_capacity !== null),
    emsAccessComplete: filled(f?.access_point) && filled(f?.ems_number),
    infrastructureRecorded: Boolean(infrastructure && (Object.keys(infrastructure.answers).length > 0 || infrastructure.layoutMap)),
    documentCount: evidenceDocumentCount(id),
    photoCount: aedPhotoCount(id),
    outsideCategory: applicability.key === 'belowThreshold' || applicability.key === 'thresholdUnset',
    submissionCount: statusFacts.submissionCount,
    status: siteStatus(statusFacts),
    everAccepted: Boolean(statusFacts.everAccepted),
    locked: siteRecordLocked(statusFacts),
  };
}

/**
 * Where an old facility sub-route lands now: the step while the registration is in
 * preparation, the matching tab of the dashboard once it is submitted -- the page maps one
 * to the other (lib/rules/site.ts siteTabFor). A notice or an error the old link had rides along.
 */
export function facilityRecordHref(id: string, step: 'aeds' | 'plan' | 'review' | 'incidents', query: { notice?: string; error?: string } = {}): string {
  const anchor = step === 'review' ? 'final-review' : step;
  const params = new URLSearchParams();
  if (step === 'incidents') params.set('tab', 'incidents');
  else params.set('step', step);
  if (query.notice) params.set('notice', query.notice);
  if (query.error) params.set('error', query.error);
  return `/facilities/${id}?${params.toString()}#${anchor}`;
}
