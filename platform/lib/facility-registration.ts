import { facilityDevices, facilityPersons, facilityPlanConfirmation } from './queries';
import { facilityAedStatus, facilityPoint } from './facility-gis';
import { getDb } from './db';
import { facilityChecksComplete, facilityRegistrationChecks, type FacilityCheckKey, type FacilityRegistrationFacts } from './rules/facility-workflow';

/**
 * The facts the facility record's rules read (lib/rules/facility-workflow.ts), in one
 * place: the record page, the certificate and the public verification page all ask here,
 * so the step colours, the certificate and the lookup cannot disagree.
 */
export function facilityRegistrationFacts(id: string): FacilityRegistrationFacts {
  const devices = facilityDevices(id);
  const confirmation = facilityPlanConfirmation(id);
  const archived = getDb().prepare('SELECT archived_at FROM facilities WHERE id = ?').get(id) as { archived_at: string | null } | undefined;
  return {
    archived: Boolean(archived?.archived_at),
    mapConfirmed: Boolean(facilityPoint(id)),
    aedRequirement: facilityAedStatus(id),
    deviceCount: devices.length,
    devicesNotReady: devices.filter((d) => !d.operational || !d.accessibleHours).length,
    contactComplete: facilityPersons(id).some((p) => p.role === 'coordinator' && p.nameOrPosition && p.phone && p.email),
    confirmationRecorded: confirmation !== null,
    confirmationCurrent: Boolean(confirmation?.current),
  };
}

/** Where each item is completed: an anchor on the record page, or the details edit screen. */
export function facilityCheckHref(id: string, key: FacilityCheckKey): string {
  return key === 'details' ? `/facilities/${id}/profile`
    : key === 'devices' ? `/facilities/${id}?step=aeds#aeds`
      : key === 'persons' ? `/facilities/${id}?step=contact#contact`
        : `/facilities/${id}?step=plan#plan`;
}

/**
 * Where an old facility sub-route lands now that the record is one page (owner, 9 October
 * 2026): the step or section on the record, carrying a notice or an error the old link had.
 */
export function facilityRecordHref(id: string, step: 'aeds' | 'plan' | 'review' | 'incidents', query: { notice?: string; error?: string } = {}): string {
  const anchor = step === 'review' ? 'final-review' : step;
  const params = new URLSearchParams();
  if (step !== 'incidents') params.set('step', step);
  if (query.notice) params.set('notice', query.notice);
  if (query.error) params.set('error', query.error);
  const search = params.toString();
  return `/facilities/${id}${search ? `?${search}` : ''}#${anchor}`;
}

/** The registration items with where to complete each (the certificate's pending list). */
export function facilityPreparation(id: string) {
  return facilityRegistrationChecks(facilityRegistrationFacts(id)).map((c) => ({ ...c, href: facilityCheckHref(id, c.key) }));
}

/** The registration is complete when every preparation item is done: the certificate's one gate. */
export function facilityRegistrationComplete(id: string): boolean {
  return facilityChecksComplete(facilityRegistrationFacts(id));
}
