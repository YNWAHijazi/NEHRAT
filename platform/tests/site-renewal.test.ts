/**
 * EXPIRY AND THE ARCHIVE (owner, 9 October 2026).
 *  - A site's readiness EXPIRES when its annual readiness confirmation or annual drill is past
 *    12 months (the policy's own cadence -- there is no site licence term), and shows EXPIRING
 *    SOON from the Ministry-set notice window before that date (60 days by default).
 *  - An event held at such a site carries an alert, including when the date falls before or
 *    during the event.
 *  - A duplicated event carries the organizer's own text and choices, never a confirmation and
 *    never another party's answer.
 */
import { describe, expect, it } from 'vitest';
import { effectiveCycles } from '../lib/rules/ministry';
import { facilityLedger } from '../lib/rules/facility';
import {
  eventSiteAlert, siteCertificateAvailable, siteRenewal, siteRenewalNotice, siteStatus, siteStatusLabel, siteStatusTone,
} from '../lib/rules/site';
import { carriedAnswer } from '../lib/rules/record-requirements';

const ledger = (confirmedAt: string | null, drillDate: string | null, today: string, lapseWindowDays?: number) =>
  facilityLedger({
    earliestPadExpiry: null, padAffirmed: null, earliestBatteryExpiry: null, batteryAffirmed: null, oldestCheck: null,
    drillDate, confirmedAt, coordinatorUpdatedAt: confirmedAt, hasDevices: false, today,
    cycles: effectiveCycles({ lapseWindowDays: lapseWindowDays ?? null }),
  });

const site = { nameEn: 'Hamra Hall', nameAr: 'قاعة الحمراء', siteId: 'SITE-000123' };

describe('the annual renewal', () => {
  it('runs on the policy cadence and the Ministry window, 60 days by default', () => {
    expect(effectiveCycles({}).annualMonths).toBe(12);
    expect(effectiveCycles({}).lapseWindowDays).toBe(60);
  });

  it('is current, then expiring soon inside the window, then expired the day after', () => {
    // Confirmed 2025-10-20, drill 2025-11-30: the confirmation falls due first, on 2026-10-20.
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-08-20'))).toEqual({ key: 'current', dueDate: '2026-10-20', obligations: ['annualConfirmation'] });
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-08-21')).key).toBe('expiringSoon');
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-10-20')).key).toBe('expiringSoon');
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-10-21')).key).toBe('expired');
  });

  it('reads the window the Ministry publishes, not a fixed number', () => {
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-09-01', 30)).key).toBe('current');
    expect(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-09-21', 30)).key).toBe('expiringSoon');
  });

  it('names the drill when the drill falls due first, and both when they fall due together', () => {
    expect(siteRenewal(ledger('2026-03-01', '2025-11-30', '2026-10-01')).obligations).toEqual(['drill']);
    expect(siteRenewal(ledger('2025-11-30', '2025-11-30', '2026-10-01')).obligations).toEqual(['annualConfirmation', 'drill']);
  });

  it('never guesses a date that was never recorded', () => {
    expect(siteRenewal(ledger(null, null, '2026-10-01'))).toEqual({ key: 'notRecorded', dueDate: null, obligations: [] });
  });

  it('turns an accepted site Expiring soon or Expired; the certificate stands while it is only expiring', () => {
    const accepted = { archived: false, submissionCount: 1, actsOnLatest: ['accepted' as const], openCorrective: 0, everAccepted: true };
    expect(siteStatus({ ...accepted, renewal: 'current' })).toBe('readinessCurrent');
    expect(siteStatus({ ...accepted, renewal: 'expiringSoon' })).toBe('expiringSoon');
    expect(siteStatus({ ...accepted, renewal: 'expired' })).toBe('expired');
    expect(siteStatus({ ...accepted, renewal: 'expired', openCorrective: 1 })).toBe('correctiveActionRequired');
    expect(siteStatus({ ...accepted, actsOnLatest: [], renewal: 'expired' })).toBe('submitted');
    expect(siteCertificateAvailable('expiringSoon')).toBe(true);
    expect(siteCertificateAvailable('expired')).toBe(false);
    expect(siteStatusLabel('expiringSoon')).toEqual({ en: 'Expiring soon', ar: 'تنتهي قريباً' });
    expect(siteStatusLabel('expired')).toEqual({ en: 'Expired', ar: 'منتهية' });
    expect(siteStatusTone('expiringSoon')).toBe('accent');
    expect(siteStatusTone('expired')).toBe('bad');
  });

  it('tells the site what is due and by when, in both languages', () => {
    const soon = siteRenewalNotice(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-09-01')))!;
    expect(soon.en).toBe('The annual readiness confirmation is due by 2026-10-20. Record it before then to keep the site’s readiness current.');
    expect(soon.ar).toContain('تأكيد الجاهزية السنوي');
    const lapsed = siteRenewalNotice(siteRenewal(ledger('2025-10-20', '2025-10-20', '2026-11-01')))!;
    expect(lapsed.en).toBe('The annual readiness confirmation and the annual practical drill were due by 2026-10-20. The site’s readiness is not current until they are recorded.');
    expect(siteRenewalNotice(siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-01-01')))).toBeNull();
  });
});

describe('the event held at the site', () => {
  const current = siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-03-01'));
  const soon = siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-09-01'));
  const expired = siteRenewal(ledger('2025-10-20', '2025-11-30', '2026-11-01'));

  it('alerts while the site has expired', () => {
    expect(eventSiteAlert(expired, { startDate: '2026-12-01', endDate: '2026-12-01' }, site)?.key).toBe('expired');
  });

  it('alerts when the date falls before or during the event, even outside the notice window', () => {
    expect(eventSiteAlert(current, { startDate: '2026-12-01', endDate: '2026-12-02' }, site)?.key).toBe('dueBeforeEventEnds');
    expect(eventSiteAlert(current, { startDate: '2026-10-19', endDate: '2026-10-21' }, site)?.key).toBe('dueBeforeEventEnds');
    expect(eventSiteAlert(current, { startDate: '2026-10-20', endDate: null }, site)?.key).toBe('dueBeforeEventEnds');
  });

  it('alerts while the site is expiring soon, and not otherwise', () => {
    expect(eventSiteAlert(soon, { startDate: '2026-09-10', endDate: '2026-09-10' }, site)?.key).toBe('expiringSoon');
    expect(eventSiteAlert(current, { startDate: '2026-04-01', endDate: '2026-04-01' }, site)).toBeNull();
    expect(eventSiteAlert(siteRenewal([]), { startDate: '2026-04-01', endDate: '2026-04-01' }, site)).toBeNull();
  });

  it('names the site and its Site ID in both languages', () => {
    const a = eventSiteAlert(current, { startDate: '2026-12-01', endDate: '2026-12-01' }, site)!;
    expect(a.en).toBe('For the site this event is held at, Hamra Hall (SITE-000123), the annual readiness confirmation is due by 2026-10-20, before this event ends. Unless the site records it by then, its readiness will not be current for the event.');
    expect(a.ar).toContain('قاعة الحمراء');
    expect(a.ar).toContain('SITE-000123');
  });
});

describe('a duplicated event', () => {
  it('carries the organizer’s text and choices, never a confirmation, a party’s answer or the site AED answer', () => {
    expect(carriedAnswer('B8', 'organizer', { aed: true, responder: true, note: 'Two AEDs at the finish' })).toEqual({ note: 'Two AEDs at the finish' });
    expect(carriedAnswer('B8', 'organizer', { aed: true })).toBeNull();
    expect(carriedAnswer('B8', 'ems', { note: 'x' })).toBeNull();
    expect(carriedAnswer('REF', 'organizer', { reuse: 'yes' })).toBeNull();
    expect(carriedAnswer('NOT-A-KEY', 'organizer', { note: 'x' })).toBeNull();
  });
});
