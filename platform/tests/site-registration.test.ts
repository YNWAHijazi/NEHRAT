/**
 * THE FACILITY/SITE REGISTRATION (owner decision, 9 October 2026; latest revision, sections
 * 1-15): applicability, the product-defined statuses, the review page and its blockers, the
 * submission as a frozen version, the Ministry's acts, corrective-action closure, designation,
 * the reuse of a venue's infrastructure, the events held at the site and the incident's links.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';

const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', () => ({ currentAccount: async () => session.account }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('notFound'); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getDb } from '../lib/db';
import { registerFacilityAction, saveFacilityDeviceAction, saveFacilityProfileAction, saveFacilityPlanAction, submitFacilityIncidentAction } from '../app/actions';
import { addSiteEvidenceAction, requestSiteChangeAction, respondToSiteRequestAction, saveSiteInfrastructureAction, submitSiteRegistrationAction } from '../app/site-actions';
import {
  acceptSiteRegistrationAction, closeSiteCorrectiveAction, recordSiteOutcomeAction, raiseSiteCorrectiveAction, recordSiteDesignationAction,
  recordSiteInspectionAction, requestSiteInformationAction, startSiteReviewAction, reopenSiteForChangeAction, answerSiteChangeAction,
} from '../app/ministry-site-actions';
import { facilityRegistrationFacts } from '../lib/facility-registration';
import { facilityAedStatus } from '../lib/facility-gis';
import { facilityInfrastructure } from '../lib/site-infrastructure';
import { siteChangeRequests, siteChanges, siteEventsFor, siteRequests, siteReviewQueue, siteStatusFor, siteSubmissionSnapshot, siteSubmissions } from '../lib/site-registration';
import { siteChangeHref, siteChangeMode } from '../lib/rules/site-changes';
import {
  eventVenueThreshold, siteApplicability, siteOperatorStatusLabel, siteRecordLocked, siteReviewActions, siteStatus, siteSubmissionSummary, siteTabFor, type SiteSubmissionFacts,
} from '../lib/rules/site';
import { deviceRefusalMessage } from '../lib/rules/device-refusal';
import { confirmationFormRefusals, confirmationRefusalMessages } from '../lib/rules/confirmation-refusal';
import { facilityAedRequirement } from '../lib/rules/facility-intake';

const folder = mkdtempSync(join(tmpdir(), 'moph-site-'));
beforeAll(() => { vi.stubEnv('DATABASE_PATH', join(folder, 'test.db')); vi.stubEnv('REVIEW_CLOCK', '2026-08-13'); getDb(); as('test_organizer'); });
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });
function as(login: string) {
  const row = getDb().prepare('SELECT id, role, is_demo FROM accounts WHERE login = ?').get(login) as { id: number; role: Account['role']; is_demo: number };
  session.account = { ...row, login, displayName: login, initials: 'T', isDemo: row.is_demo === 1 };
}
function data(fields: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; }
const pdf = () => new File([Buffer.from('%PDF-1.4\n%%EOF\n')], 'letter.pdf', { type: 'application/pdf' });
const profile = {
  name: 'Site test arena', operatingOrganization: 'Arena operator', address: 'Main road', municipality: 'Beirut', hours: 'Daytime', phone: '+9611234567',
  email: 'arena@example.com', accessPoint: 'North gate', emsNumber: '140', coordinatorName: 'Duty manager', coordinatorPhone: '+9611234567',
  coordinatorEmail: 'duty@example.com', mapLat: '33.89', mapLng: '35.50', mapConfirmed: 'yes',
};
const declared = () => data({ confirm: 'yes', representative: 'Duty manager', position: 'Operations manager' });
const idOf = (name: string) => String((getDb().prepare('SELECT id FROM facilities WHERE name_en = ?').get(name) as { id: string }).id);

describe('the rules (lib/rules/site.ts)', () => {
  it('applies the objective categories automatically and the designated ones only by designation', () => {
    expect(siteApplicability({ categoryKey: 'sports', capacity: null, threshold: 1000, designatedOn: null })).toMatchObject({ key: 'covered', covered: true });
    expect(siteApplicability({ categoryKey: 'transport', capacity: null, threshold: null, designatedOn: null }).covered).toBe(true);
    expect(siteApplicability({ categoryKey: 'remote', capacity: null, threshold: 1000, designatedOn: null })).toMatchObject({ key: 'awaitingDesignation', covered: false });
    expect(siteApplicability({ categoryKey: 'priorArrest', capacity: null, threshold: 1000, designatedOn: '2026-08-01' })).toMatchObject({ key: 'designated', covered: true, en: 'Designated by the Ministry on 2026-08-01.' });
  });

  it('applies an event-hosting venue at or above the threshold, and names the unset threshold', () => {
    expect(siteApplicability({ categoryKey: 'eventVenue', capacity: 1000, threshold: 1000, designatedOn: null }).key).toBe('covered');
    expect(siteApplicability({ categoryKey: 'eventVenue', capacity: 999, threshold: 1000, designatedOn: null })).toMatchObject({ key: 'belowThreshold', en: 'The recorded capacity is below 1,000 persons, so this category does not cover the site.' });
    expect(siteApplicability({ categoryKey: 'eventVenue', capacity: null, threshold: 1000, designatedOn: null }).key).toBe('capacityMissing');
    expect(siteApplicability({ categoryKey: 'eventVenue', capacity: 5000, threshold: null, designatedOn: null }).key).toBe('thresholdUnset');
  });

  it('reads the threshold from the data, governed by a published Ministry value once in force', () => {
    expect(eventVenueThreshold(null, '2026-08-13')).toBe(1000);
    expect(eventVenueThreshold({ value: '1500', effective: '2026-08-01' }, '2026-08-13')).toBe(1500);
    expect(eventVenueThreshold({ value: '1500', effective: '2026-09-01' }, '2026-08-13')).toBe(1000);
    expect(eventVenueThreshold({ value: 'not a number', effective: null }, '2026-08-13')).toBe(1000);
  });

  it('requires an AED for every covered site, and leaves an undesignated one to the Ministry', () => {
    const base = { type: '', capacity: null, threshold: null };
    expect(facilityAedRequirement({ ...base, category: 'eventVenue', capacity: 1200, eventVenueThreshold: 1000 })).toBe('required');
    expect(facilityAedRequirement({ ...base, category: 'remote' })).toBe('review');
    expect(facilityAedRequirement({ ...base, category: 'remote', designated: true })).toBe('required');
  });

  it('derives the product-defined statuses with their precedence, never an event outcome', () => {
    const f = { archived: false, submissionCount: 1, actsOnLatest: [], openCorrective: 0 } as Parameters<typeof siteStatus>[0];
    expect(siteStatus({ ...f, submissionCount: 0 })).toBe('inPreparation');
    expect(siteStatus(f)).toBe('submitted');
    expect(siteStatus({ ...f, actsOnLatest: ['reviewStarted'] })).toBe('underReview');
    expect(siteStatus({ ...f, actsOnLatest: ['reviewStarted', 'accepted'] })).toBe('readinessCurrent');
    expect(siteStatus({ ...f, actsOnLatest: ['accepted'], openCorrective: 1, everAccepted: true })).toBe('correctiveActionRequired');
    // An open request older than the registration does not displace a first filing (owner, 10 October 2026):
    // it reads Submitted, and the record is read-only -- no second filing is offered.
    expect(siteStatus({ ...f, openCorrective: 1 })).toBe('submitted');
    expect(siteRecordLocked({ ...f, openCorrective: 1 })).toBe(true);
    expect(siteRecordLocked({ ...f, actsOnLatest: ['infoRequested'] })).toBe(false);
    expect(siteRecordLocked({ ...f, submissionCount: 0 })).toBe(false);
    expect(siteStatus({ ...f, actsOnLatest: ['accepted', 'correctionRequested'], openCorrective: 1 })).toBe('informationRequired');
    expect(siteStatus({ ...f, actsOnLatest: ['accepted', 'inspection'] })).toBe('readinessCurrent');
    expect(siteStatus({ ...f, archived: true })).toBe('noLongerCovered');
    expect(siteReviewActions({ ...f, actsOnLatest: ['infoRequested'] })).toMatchObject({ start: false, accept: false, request: false, record: true });
  });

  it('writes the review page as the revision lists it', () => {
    const facts: SiteSubmissionFacts = {
      profileComplete: true, mapConfirmed: true, contactComplete: true, emsAccessComplete: true, aedRequired: true, deviceCount: 2, devicesNotReady: 0,
      confirmationRecorded: true, confirmationCurrent: true, infrastructureRecorded: false, documentCount: 2, photoCount: 3, outsideCategory: false,
    };
    expect(siteSubmissionSummary(facts).map((l) => `${l.en} — ${l.valueEn}`)).toEqual([
      'Site profile — Complete', 'Responsible contact — Complete', 'EMS access — Complete', 'AED registration — 2 AEDs registered',
      'Cardiac emergency response plan — Complete', 'Readiness confirmation — Complete', 'Basic site infrastructure — None — optional',
      'Supporting evidence — 2 documents / 3 photographs',
    ]);
  });

  it('lands old step links on the matching tab', () => {
    expect(siteTabFor(null, 'aeds')).toBe('aeds');
    expect(siteTabFor(null, 'plan')).toBe('readiness');
    expect(siteTabFor('events', 'plan')).toBe('events');
    expect(siteTabFor('nonsense', null)).toBe('overview');
  });
});

describe('registration, submission and the Ministry review', () => {
  let id = '';

  it('an event-hosting venue below the threshold is not registered under that category', async () => {
    await expect(registerFacilityAction(data({ ...profile, name: 'Small hall', category: 'eventVenue', capacity: '400' }))).rejects.toThrow('error=capacity');
    await expect(registerFacilityAction(data({ ...profile, name: 'No capacity hall', category: 'eventVenue' }))).rejects.toThrow('error=capacity');
    await expect(registerFacilityAction(data({ ...profile, name: 'No organization', operatingOrganization: '', category: 'sports' }))).rejects.toThrow('error=details');
  });

  it('registers at or above it, with the operating organization, and opens in preparation', async () => {
    await expect(registerFacilityAction(data({ ...profile, category: 'eventVenue', capacity: '2500' }))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
    id = idOf(profile.name);
    expect(getDb().prepare('SELECT operating_organization FROM facilities WHERE id = ?').get(id)).toMatchObject({ operating_organization: 'Arena operator' });
    expect(facilityAedStatus(id)).toBe('required');
    expect(siteStatusFor(id)).toBe('inPreparation');
  });

  it('keeps the infrastructure optional, and the evidence typed and dated', async () => {
    const form = data({ zones: 'Main hall, east stand', firstAidRoom: 'no', firstAidLocation: 'should be dropped', configuration: 'indoor' });
    form.set('layoutMap', pdf());
    await expect(saveSiteInfrastructureAction(id, form)).rejects.toThrow('notice=infrastructure');
    const infra = facilityInfrastructure(id)!;
    expect(infra.answers).toEqual({ configuration: 'indoor', zones: 'Main hall, east stand', firstAidRoom: 'no' });
    expect(infra.layoutMap?.fileName).toBe('letter.pdf');
    const evidence = (fields: Record<string, string>) => { const f = data(fields); f.set('document', pdf()); return f; };
    await expect(addSiteEvidenceAction(id, evidence({ docType: 'made-up' }))).rejects.toThrow('error=evidence-details');
    await expect(addSiteEvidenceAction(id, evidence({ docType: 'thirdPartyCertificate', issuer: 'Readiness assessor', issueDate: '2026-07-01', reviewDate: '2027-07-01' }))).rejects.toThrow('notice=evidence');
    expect(facilityRegistrationFacts(id).documentCount).toBe(1);
  });

  it('refuses the submission until every required line is complete, then freezes version 1', async () => {
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow('error=submit');
    await expect(saveFacilityDeviceAction(id, data({ purpose: 'initial', identification: 'ARENA-1', location: 'Main entrance', accessibleHours: 'yes', publiclyAccessible: 'yes', pediatric: 'na', operational: 'yes', representative: 'Duty manager', separatePin: 'no' }))).rejects.toThrow('notice=saved');
    await expect(saveFacilityPlanAction(id, data({ check_trained: 'on', check_signage: 'on', check_access: 'on', check_routes: 'on', check_staffKnow: 'on', check_drill: 'on', drillDate: '2026-08-01', representative: 'Duty manager' })))
      .rejects.toThrow(/step=infrastructure&notice=confirmed/);
    expect(siteStatusFor(id)).toBe('inPreparation');
    // The declaration is signed, as on an event: unsigned, nothing is submitted.
    await expect(submitSiteRegistrationAction(id, data({ representative: 'Duty manager', position: 'Manager' }))).rejects.toThrow('error=submit');
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow(`redirect:/facilities/${id}/acknowledgment`);
    expect(siteStatusFor(id)).toBe('submitted');
    expect(siteSubmissions(id)[0]).toMatchObject({ version: 1, representative: 'Duty manager', position: 'Operations manager' });
    // The reviewers are notified, as on a venue submission.
    expect((getDb().prepare(`SELECT COUNT(*) AS n FROM notifications WHERE record_route = ?`).get(`/ministry/facilities/${id}`) as { n: number }).n).toBeGreaterThan(0);
    // With the Ministry, the record is read-only, as a filed event's is.
    expect(facilityRegistrationFacts(id).locked).toBe(true);
    await expect(saveSiteInfrastructureAction(id, data({ zones: 'Changed' }))).rejects.toThrow('error=locked');
    await expect(saveFacilityDeviceAction(id, data({ purpose: 'statusChange', label: 'AED-001', operational: 'no', accessibleHours: 'yes', representative: 'Duty manager' }))).rejects.toThrow('error=locked');
    const snapshot = siteSubmissionSnapshot(id, 1)!;
    expect(snapshot).toHaveProperty('infrastructure');
    expect((snapshot['documents'] as { purpose: string; docType: string }[]).map((d) => `${d.purpose}:${d.docType}`)).toEqual(['evidence:thirdPartyCertificate', 'layoutMap:']);
    expect(JSON.stringify(snapshot)).not.toContain('%PDF');
    // Submitted and not asked for anything: it cannot be submitted again.
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow('error=not-open');
  });

  it('only a Ministry role acts, inside its own demonstration boundary', async () => {
    await expect(startSiteReviewAction(id)).rejects.toThrow('ministry-permission');
    as('test_moph');
    expect(siteReviewQueue(true).some((r) => r.facilityId === id)).toBe(true);
    expect(siteReviewQueue(false).some((r) => r.facilityId === id)).toBe(false);
  });

  it('starts the review, asks for information, and takes the updated version', async () => {
    await expect(startSiteReviewAction(id)).rejects.toThrow('notice=started');
    expect(siteStatusFor(id)).toBe('underReview');
    await expect(requestSiteInformationAction(id, data({ kind: 'information', body: '' }))).rejects.toThrow('error=request');
    // The outcome form: a request needs its note, which is what the operator reads.
    await expect(recordSiteOutcomeAction(id, data({ outcome: 'information', note: '' }))).rejects.toThrow('error=note');
    await expect(recordSiteOutcomeAction(id, data({ outcome: 'information', note: 'Attach the licence showing the capacity.' }))).rejects.toThrow('notice=information');
    expect(siteStatusFor(id)).toBe('informationRequired');
    expect(siteRequests(id).find((r) => r.kind === 'information')).toMatchObject({ status: 'open', bodyEn: 'Attach the licence showing the capacity.' });
    as('test_organizer');
    // Returned: the record reopens for revision, exactly as an event's does.
    expect(facilityRegistrationFacts(id).locked).toBe(false);
    await expect(saveSiteInfrastructureAction(id, data({ zones: 'Main hall, east stand, west stand' }))).rejects.toThrow('notice=infrastructure');
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow('/acknowledgment');
    expect(siteSubmissions(id).map((s) => s.version)).toEqual([2, 1]);
    expect(siteRequests(id).find((r) => r.kind === 'information')).toMatchObject({ status: 'corrected', closeNote: 'Answered by the updated registration, version 2.' });
    expect(siteStatusFor(id)).toBe('submitted');
  });

  it('accepts: readiness current', async () => {
    as('test_moph');
    await expect(recordSiteOutcomeAction(id, data({ outcome: 'accept', note: 'Complete.' }))).rejects.toThrow('notice=accepted');
    expect(siteStatusFor(id)).toBe('readinessCurrent');
    // Accepted: maintained from the dashboard, never locked again.
    expect(facilityRegistrationFacts(id)).toMatchObject({ everAccepted: true, locked: false });
    await expect(acceptSiteRegistrationAction(id, data({}))).rejects.toThrow('error=act');
  });

  it('a corrective action is answered with evidence by the operator and closed by the Ministry with what was verified', async () => {
    await expect(raiseSiteCorrectiveAction(id, data({ deficiency: 'AED inaccessible during operating hours', action: '' }))).rejects.toThrow('error=corrective');
    await expect(raiseSiteCorrectiveAction(id, data({ deficiency: 'AED inaccessible during operating hours', action: 'Keep the cabinet unlocked while open', note: 'Seen at inspection' }))).rejects.toThrow('notice=corrective');
    expect(siteStatusFor(id)).toBe('correctiveActionRequired');
    const ca = siteRequests(id).find((r) => r.kind === 'corrective')!;
    // No corrective timeline is published: no due date is computed.
    expect(ca).toMatchObject({ status: 'open', deficiency: 'AED inaccessible during operating hours', bodyEn: 'Keep the cabinet unlocked while open', note: 'Seen at inspection', due: null });
    await expect(recordSiteInspectionAction(id, data({ date: '2026-08-12', findings: 'Cabinet locked at 18:00.' }))).rejects.toThrow('notice=inspection');
    await expect(recordSiteInspectionAction(id, data({ date: '2026-09-12', findings: 'Future.' }))).rejects.toThrow('error=inspection');
    as('test_organizer');
    await expect(respondToSiteRequestAction(id, ca.id, data({ note: '' }))).rejects.toThrow('error=response');
    const answer = data({ note: 'The lock is removed; the cabinet has a breakable seal.' });
    answer.set('evidence', pdf());
    await expect(respondToSiteRequestAction(id, ca.id, answer)).rejects.toThrow('notice=response');
    expect(siteRequests(id).find((r) => r.id === ca.id)!.responses).toHaveLength(1);
    expect(siteStatusFor(id)).toBe('correctiveActionRequired');
    as('test_moph');
    await expect(closeSiteCorrectiveAction(id, ca.id, data({ verified: '' }))).rejects.toThrow('error=verified');
    await expect(closeSiteCorrectiveAction(id, ca.id, data({ verified: 'Seal fitted; cabinet opens without a key.' }))).rejects.toThrow('notice=closed');
    expect(siteRequests(id).find((r) => r.id === ca.id)).toMatchObject({ status: 'corrected', closeNote: 'Seal fitted; cabinet opens without a key.' });
    expect(siteStatusFor(id)).toBe('readinessCurrent');
    as('test_organizer');
  });
});

describe('designation, reuse and links', () => {
  it('a designated category waits on the Ministry; the applicant cannot designate itself', async () => {
    as('test_organizer');
    await expect(registerFacilityAction(data({ ...profile, name: 'Mountain lodge', category: 'remote' }))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
    const id = idOf('Mountain lodge');
    expect(facilityRegistrationFacts(id)).toMatchObject({ aedRequirement: 'review' });
    await expect(recordSiteDesignationAction(id, data({}))).rejects.toThrow('ministry-permission');
    as('test_moph');
    await expect(recordSiteDesignationAction(id, data({ note: 'Access road closes in winter.' }))).rejects.toThrow('notice=designated');
    expect(facilityAedStatus(id)).toBe('required');
    // A category that takes no designation is refused.
    await expect(recordSiteDesignationAction(idOf(profile.name), data({}))).rejects.toThrow('error=designation');
    as('test_organizer');
  });

  it('a facility/site started from a venue reuses the venue’s infrastructure answers and layout map', async () => {
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO requirement_answers (record_kind, record_id, key, answers) VALUES ('venue', 'VN-0032', 'V2', ?)`).run(JSON.stringify({ entry: 'Service road, gate B', staging: 'Car park C' }));
    db.prepare(`INSERT OR REPLACE INTO requirement_answers (record_kind, record_id, key, answers) VALUES ('venue', 'VN-0032', 'V4', ?)`).run(JSON.stringify({ exists: 'yes', location: 'Ground floor, hall 2' }));
    await expect(registerFacilityAction(data({ ...profile, name: 'Forum site', category: 'sports', fromVenue: 'VN-0032' }))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
    const id = idOf('Forum site');
    const infra = facilityInfrastructure(id)!;
    expect(infra.answers).toMatchObject({ emergencyAccess: 'Service road, gate B', ambulanceWaiting: 'Car park C', firstAidRoom: 'yes', firstAidLocation: 'Ground floor, hall 2' });
    expect(infra.layoutMap?.fileName).toBe('forum-layout-map.pdf');
    const site = (db.prepare(`SELECT site_id FROM venues WHERE id = 'VN-0032'`).get() as { site_id: string }).site_id;
    expect(infra.siteId).toBe(site);
  });

  it('the events at the site show only name, dates, record id and where each stands for the site (owner, 10 October 2026)', () => {
    const db = getDb();
    const id = idOf(profile.name);
    const site = (db.prepare('SELECT site_id FROM facilities WHERE id = ?').get(id) as { site_id: string }).site_id;
    const other = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer_pending'`).get() as { id: number }).id;
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9901', ?, 'Other concert', 'حفل آخر', '2026-09-20', '2026-09-20', 1, ?)`).run(other, site);
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9902', ?, 'Own fair', 'معرض', '2026-09-25', '2026-09-26', 1, ?)`).run(session.account!.id, site);
    db.prepare(`INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, is_demo, site_id) VALUES ('EV-9903', ?, 'Real event', 'فعالية', '2026-09-25', '2026-09-26', 0, ?)`).run(other, site);
    const rows = siteEventsFor(session.account!.id, site, true);
    expect(rows.map((r) => [r.id, r.own])).toEqual([['EV-9901', false], ['EV-9902', true]]);
    expect(Object.keys(rows[0]!).sort()).toEqual(['endDate', 'id', 'nameAr', 'nameEn', 'own', 'stage', 'startDate', 'statusAr', 'statusEn']);
    expect(rows[0]).toMatchObject({ stage: 'planned', statusEn: 'Planned at your site' });
  });

  it('an incident links the site, the AED where known and an event held at the site', async () => {
    const id = idOf(profile.name);
    const incident = { date: '2026-08-12', time: '12:30', location: 'Main hall', emsContacted: 'yes', cprStarted: 'yes', aedAvailable: 'yes', aedApplied: 'yes', shock: 'unknown', guided: 'yes', emsAttended: 'yes', transportedBy: 'ems', returned: 'yes', problem: 'no', corrective: '' };
    expect(await submitFacilityIncidentAction(id, data({ ...incident, eventId: 'EV-0418' }))).toEqual({ error: 'incomplete' });
    expect(await submitFacilityIncidentAction(id, data({ ...incident, deviceLabel: 'AED-999' }))).toEqual({ error: 'incomplete' });
    await expect(submitFacilityIncidentAction(id, data({ ...incident, deviceLabel: 'AED-001', eventId: 'EV-9901' }))).rejects.toThrow('tab=incidents&notice=incident');
    const row = getDb().prepare('SELECT site_id, device_label, event_id FROM facility_incidents WHERE facility_id = ?').get(id) as { site_id: string; device_label: string; event_id: string };
    expect(row).toMatchObject({ device_label: 'AED-001', event_id: 'EV-9901' });
    expect(row.site_id).toMatch(/^SITE-\d+$/);
  });
});

describe('saving without the pin, and saying why a save was refused (owner, 10 October 2026)', () => {
  const name = 'Pinless test hall';
  let id = '';
  const details = { ...profile, name, hours: 'Evenings' };
  const aed = { purpose: 'initial', identification: 'PIN-1', location: 'Lobby', accessibleHours: 'yes', publiclyAccessible: 'yes', pediatric: 'na', operational: 'yes', representative: 'Duty manager', separatePin: 'no' };

  it('saves the site details with no pin, keeps any pin already placed, and says when one is still needed', async () => {
    await expect(registerFacilityAction(data({ ...details, category: 'sports' }))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
    id = idOf(name);
    const { mapLat: _lat, mapLng: _lng, mapConfirmed: _confirmed, ...noPin } = details;
    // A pin is already placed: saving without one keeps it.
    await expect(saveFacilityProfileAction(id, data({ ...noPin, hours: 'All day' }))).rejects.toThrow(`redirect:/facilities/${id}?notice=profile`);
    expect(facilityRegistrationFacts(id).mapConfirmed).toBe(true);
    // No pin at all: the details are saved, and the notice says the pin is still needed.
    getDb().prepare('UPDATE facilities SET latitude = NULL, longitude = NULL, map_confirmed_at = NULL WHERE id = ?').run(id);
    await expect(saveFacilityProfileAction(id, data({ ...noPin, operatingOrganization: 'Hall operator' }))).rejects.toThrow('notice=profile-nopin');
    expect(getDb().prepare('SELECT operating_organization FROM facilities WHERE id = ?').get(id)).toMatchObject({ operating_organization: 'Hall operator' });
    expect(facilityRegistrationFacts(id).mapConfirmed).toBe(false);
  });

  it('records an AED before the site pin is placed, and names the missing field when it refuses one', async () => {
    await expect(saveFacilityDeviceAction(id, data({ ...aed, separatePin: 'yes' }))).rejects.toThrow('error=details-pin');
    await expect(saveFacilityDeviceAction(id, data({ ...aed, identification: '' }))).rejects.toThrow('error=details-identification');
    await expect(saveFacilityDeviceAction(id, data({ ...aed, location: '' }))).rejects.toThrow('error=details-location');
    await expect(saveFacilityDeviceAction(id, data({ ...aed, representative: '' }))).rejects.toThrow('error=details-representative');
    await expect(saveFacilityDeviceAction(id, data(aed))).rejects.toThrow('notice=saved');
    expect(facilityRegistrationFacts(id).deviceCount).toBe(1);
    // Every refusal has a sentence, in both languages.
    for (const code of ['details', 'details-pin', 'details-identification', 'details-location', 'details-representative', 'photo-tooLarge', 'photo-empty', 'photo-type']) {
      const m = deviceRefusalMessage(code)!;
      expect(m.en && m.ar).toBeTruthy();
    }
  });

  it('names every reason a readiness confirmation is not recorded', async () => {
    // No pin on this site, nothing ticked, no drill date: three reasons, the site's first.
    await expect(saveFacilityPlanAction(id, data({ representative: 'Duty manager' }))).rejects.toThrow('error=readiness&why=map,checks,drill-missing');
    const ticks = { check_trained: 'on', check_signage: 'on', check_access: 'on', check_routes: 'on', check_staffKnow: 'on', check_drill: 'on' };
    await expect(saveFacilityPlanAction(id, data({ ...ticks, drillDate: '2026-08-01', representative: '' }))).rejects.toThrow('why=map,representative');
    // The pin placed, the same confirmation is recorded.
    getDb().prepare('UPDATE facilities SET latitude = 33.9, longitude = 35.5, map_confirmed_at = now_stamp() WHERE id = ?').run(id);
    await expect(saveFacilityPlanAction(id, data({ ...ticks, drillDate: '2026-08-01', representative: 'Duty manager' }))).rejects.toThrow('notice=confirmed');
  });

  it('checks the form’s own reasons from plain values', () => {
    const keys = ['a', 'b'];
    const base = { checks: { a: true, b: true }, checkKeys: keys, drill: '2026-08-01', representative: 'X', today: '2026-10-10' };
    expect(confirmationFormRefusals(base)).toEqual([]);
    expect(confirmationFormRefusals({ ...base, checks: { a: true } })).toEqual(['checks']);
    expect(confirmationFormRefusals({ ...base, drill: '' })).toEqual(['drill-missing']);
    expect(confirmationFormRefusals({ ...base, drill: '2026-10-11' })).toEqual(['drill-future']);
    expect(confirmationFormRefusals({ ...base, drill: '2025-10-09' })).toEqual(['drill-old']);
    expect(confirmationFormRefusals({ ...base, drill: '2025-10-10' })).toEqual([]);
    expect(confirmationFormRefusals({ ...base, representative: ' ' })).toEqual(['representative']);
    expect(confirmationRefusalMessages(['map', 'nonsense', 'checks']).map((m) => m.code)).toEqual(['map', 'checks']);
    expect(confirmationRefusalMessages(['drill-missing', 'drill-future', 'drill-old', 'representative', 'contact', 'aeds-none', 'aeds-not-ready']).every((m) => m.en && m.ar)).toBe(true);
  });

  it('reads In process to the operator while the Ministry holds a filing', () => {
    expect(siteOperatorStatusLabel('submitted')).toEqual({ en: 'In process', ar: 'قيد المعالجة' });
    expect(siteOperatorStatusLabel('underReview')).toEqual({ en: 'In process', ar: 'قيد المعالجة' });
    expect(siteOperatorStatusLabel('informationRequired').en).toBe('More information needed');
    expect(siteOperatorStatusLabel('readinessCurrent').en).toBe('Readiness current');
  });
});

describe('changing a site after it is filed (owner, 10 October 2026)', () => {
  const name = 'Change test pool';
  let id = '';
  const aed = { purpose: 'initial', identification: 'POOL-1', location: 'Pool deck', accessibleHours: 'yes', publiclyAccessible: 'yes', pediatric: 'na', operational: 'yes', representative: 'Duty manager', separatePin: 'no' };
  const ticks = { check_trained: 'on', check_signage: 'on', check_access: 'on', check_routes: 'on', check_staffKnow: 'on', check_drill: 'on' };

  it('decides how a change is made from where the registration stands', () => {
    expect(siteChangeMode({ status: 'inPreparation', everAccepted: false, archived: false })).toBe('direct');
    expect(siteChangeMode({ status: 'submitted', everAccepted: false, archived: false })).toBe('request');
    expect(siteChangeMode({ status: 'underReview', everAccepted: false, archived: false })).toBe('request');
    expect(siteChangeMode({ status: 'informationRequired', everAccepted: false, archived: false })).toBe('direct');
    expect(siteChangeMode({ status: 'readinessCurrent', everAccepted: true, archived: false })).toBe('direct');
    expect(siteChangeMode({ status: 'underReview', everAccepted: true, archived: false })).toBe('direct');
    expect(siteChangeMode({ status: 'noLongerCovered', everAccepted: true, archived: true })).toBe('none');
    expect(siteChangeHref('aedAdd', 'FC-1', false)).toBe('/facilities/FC-1?step=aeds#aeds');
    expect(siteChangeHref('aedAdd', 'FC-1', true)).toBe('/facilities/FC-1?tab=aeds#aeds');
    expect(siteChangeHref('contact', 'FC-1', true)).toBe('/facilities/FC-1/profile#contact');
  });

  it('while the Ministry holds the filing, the operator asks; the Ministry reopens it for the change', async () => {
    as('test_organizer');
    await expect(registerFacilityAction(data({ ...profile, name, category: 'sports' }))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
    id = idOf(name);
    // Before filing, nothing is asked: the change is made directly.
    await expect(requestSiteChangeAction(id, data({ aspect: 'aedAdd', description: 'x' }))).rejects.toThrow(`redirect:/facilities/${id}/change`);
    await expect(saveFacilityDeviceAction(id, data(aed))).rejects.toThrow('notice=saved');
    await expect(saveFacilityPlanAction(id, data({ ...ticks, drillDate: '2026-08-01', representative: 'Duty manager' }))).rejects.toThrow('notice=confirmed');
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow(`redirect:/facilities/${id}/acknowledgment`);
    // Filed and read-only: an AED cannot be added directly...
    await expect(saveFacilityDeviceAction(id, data({ ...aed, identification: 'POOL-2' }))).rejects.toThrow('error=locked');
    // ...so it is asked for: what and why, both required.
    await expect(requestSiteChangeAction(id, data({ description: 'A second AED' }))).rejects.toThrow('error=aspect');
    await expect(requestSiteChangeAction(id, data({ aspect: 'aedAdd' }))).rejects.toThrow('error=description');
    const form = data({ description: 'A second AED was installed at the gym entrance.' });
    form.append('aspect', 'aedAdd'); form.append('aspect', 'nonsense');
    await expect(requestSiteChangeAction(id, form)).rejects.toThrow(`redirect:/facilities/${id}/change?notice=requested`);
    expect(siteChangeRequests(id)[0]).toMatchObject({ aspects: ['aedAdd'], status: 'open', description: 'A second AED was installed at the gym entrance.' });
    // The reviewers are told, with the way to the request.
    expect((getDb().prepare(`SELECT COUNT(*) AS n FROM notifications WHERE record_route = ?`).get(`/ministry/facilities/${id}#change-requests`) as { n: number }).n).toBeGreaterThan(0);

    // The Ministry reopens it for the change: the registration is open again, as for a correction.
    as('test_moph');
    const requestId = siteChangeRequests(id)[0]!.id;
    await expect(reopenSiteForChangeAction(id, requestId, data({ note: 'Add it and resubmit.' }))).rejects.toThrow('notice=change-reopened');
    expect(siteStatusFor(id)).toBe('informationRequired');
    expect(siteChangeRequests(id)[0]).toMatchObject({ status: 'reopened', answer: 'Add it and resubmit.' });
    expect(siteRequests(id).find((r) => r.status === 'open')!.bodyEn).toContain('A second AED was installed at the gym entrance.');
    // A request already answered cannot be answered again.
    await expect(answerSiteChangeAction(id, requestId, data({ answer: 'Again' }))).rejects.toThrow('error=change');

    // The operator adds the AED and submits version 2.
    as('test_organizer');
    expect(facilityRegistrationFacts(id).locked).toBe(false);
    await expect(saveFacilityDeviceAction(id, data({ ...aed, identification: 'POOL-2', location: 'Gym entrance' }))).rejects.toThrow('notice=saved');
    // A new AED changes the plan, so the readiness confirmation is recorded again before resubmitting.
    expect(facilityRegistrationFacts(id).confirmationCurrent).toBe(false);
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow('error=submit');
    await expect(saveFacilityPlanAction(id, data({ ...ticks, drillDate: '2026-08-01', representative: 'Duty manager' }))).rejects.toThrow('notice=confirmed');
    await expect(submitSiteRegistrationAction(id, declared())).rejects.toThrow(`redirect:/facilities/${id}/acknowledgment`);
    expect(siteSubmissions(id).map((s) => s.version)).toContain(2);
    expect(facilityRegistrationFacts(id).deviceCount).toBe(2);
  });

  it('or the Ministry answers without reopening, and the answer is required', async () => {
    as('test_organizer');
    const form = data({ description: 'The contact is changing next month.' });
    form.append('aspect', 'contact');
    await expect(requestSiteChangeAction(id, form)).rejects.toThrow('notice=requested');
    as('test_moph');
    const requestId = siteChangeRequests(id)[0]!.id;
    await expect(answerSiteChangeAction(id, requestId, data({ answer: '' }))).rejects.toThrow('error=change-answer');
    await expect(answerSiteChangeAction(id, requestId, data({ answer: 'Update the contact once the review is complete.' }))).rejects.toThrow('notice=change-answered');
    expect(siteChangeRequests(id)[0]).toMatchObject({ status: 'answered', answer: 'Update the contact once the review is complete.' });
    expect(siteStatusFor(id)).toBe('submitted');
  });

  it('records an AED readiness check with its dates, and an AED not in order is not ready', async () => {
    as('test_moph');
    await expect(acceptSiteRegistrationAction(id, data({}))).rejects.toThrow('notice=accepted');
    as('test_organizer');
    const check = { purpose: 'readinessCheck', label: 'AED-001', checkDate: '2026-08-10', padExpiry: '2027-03-01', batteryExpiry: '', operational: 'yes', padsOk: 'yes', batteryOk: 'yes', signageOk: 'yes', representative: 'Duty manager' };
    await expect(saveFacilityDeviceAction(id, data({ ...check, checkDate: '2026-08-20' }))).rejects.toThrow('error=details-check-date');
    await expect(saveFacilityDeviceAction(id, data({ ...check, padExpiry: '' }))).rejects.toThrow('error=details-pad-expiry');
    await expect(saveFacilityDeviceAction(id, data({ ...check, batteryExpiry: 'soon' }))).rejects.toThrow('error=details-battery');
    await expect(saveFacilityDeviceAction(id, data(check))).rejects.toThrow('notice=saved');
    const row = getDb().prepare('SELECT latest_check, pad_expiry, operational FROM facility_devices WHERE facility_id = ? AND label = ?').get(id, 'AED-001');
    expect(row).toMatchObject({ latest_check: '2026-08-10', pad_expiry: '2027-03-01', operational: 1 });
    // Pads missing: recorded as not ready.
    await expect(saveFacilityDeviceAction(id, data({ ...check, padsOk: 'no' }))).rejects.toThrow('notice=saved');
    expect(getDb().prepare('SELECT operational FROM facility_devices WHERE facility_id = ? AND label = ?').get(id, 'AED-001')).toMatchObject({ operational: 0 });
    expect(facilityRegistrationFacts(id).devicesNotReady).toBe(1);
    // The check is in the site's history.
    expect(siteChanges(id).some((c) => c.en === 'AED readiness check recorded')).toBe(true);
    expect(siteChanges(id).some((c) => c.en === 'Change requested from the Ministry')).toBe(true);
  });
});
