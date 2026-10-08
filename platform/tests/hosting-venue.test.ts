import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';

/**
 * THE HOSTING VENUE (platform owner, 8 October 2026). An event at a fixed venue that
 * hosts events repeatedly names a registered venue. The server stores only an id the
 * account may choose: registered, not archived, and on the same side of the
 * demonstration line as the account (non-negotiable 8).
 */
const session = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../lib/auth', () => ({ currentAccount: async () => session.account }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getDb } from '../lib/db';
import { hostingVenueForEvent, hostingVenueOptions, isListableHostingVenue, resolveHostingVenue } from '../lib/hosting-venues';
import { createEventAction, editEventDetailsAction, updateDraftEventAction, type AssessmentSubmission } from '../app/actions';

const folder = mkdtempSync(join(tmpdir(), 'moph-hosting-venue-'));
let realAccountId = 0;
beforeAll(() => {
  vi.stubEnv('DATABASE_PATH', join(folder, 'test.db'));
  vi.stubEnv('REVIEW_CLOCK', '2026-08-13');
  const db = getDb();
  realAccountId = Number(
    db.prepare(`INSERT INTO accounts (login, display_name, role, is_demo) VALUES ('real_org', 'Real organizer', 'organizer', 0)`).run().lastInsertRowid,
  );
  db.prepare(
    `INSERT INTO venues (id, account_id, name_en, name_ar, category, responsible_contact, district, is_demo)
     VALUES ('VN-0900', ?, 'Real Hall', 'القاعة الحقيقية', 'hall', 'Private Person +961 1 000 000', 'Matn', 0)`,
  ).run(realAccountId);
  db.prepare(
    `INSERT INTO venues (id, account_id, name_en, name_ar, category, is_demo, archived_at)
     VALUES ('VN-0901', ?, 'Closed Hall', 'القاعة المغلقة', 'hall', 0, '2026-08-01')`,
  ).run(realAccountId);
});
afterAll(() => { getDb().close(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

function asDemoOrganizer() {
  const row = getDb().prepare(`SELECT id, role FROM accounts WHERE login = 'test_organizer'`).get() as { id: number; role: Account['role'] };
  session.account = { ...row, login: 'test_organizer', displayName: 'test_organizer', initials: 'T', isDemo: true };
}
function asRealOrganizer() {
  session.account = { id: realAccountId, role: 'organizer', login: 'real_org', displayName: 'Real organizer', initials: 'R', isDemo: false };
}

function payload(hostingVenueId: string | null, recurringFixedVenue = true): AssessmentSubmission {
  return {
    nameEn: 'Hosted concert', nameAr: 'حفل مستضاف', startDate: '2026-12-01', endDate: '2026-12-01',
    partA: {
      eventType: 'Concert', venueRoute: 'Hall', municipalities: 'Beirut', openingTime: '19:00', closingTime: '23:00',
      expectedParticipants: 10, expectedSpectators: 400, expectedStaff: 20, previousEdition: false,
      recurringFixedVenue, hostingVenueId,
    },
    answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    inputs: { expectedMaxSimultaneousAttendance: 430, eventDisciplines: [], courseDistanceKm: null, venueLicensedCapacity: null, venueIsNightclubOrDanceVenue: false },
    representative: 'R. Haddad', position: 'Director',
  };
}
const stored = (eventId: string) =>
  (getDb().prepare(`SELECT hosting_venue_id FROM events WHERE id = ?`).get(eventId) as { hosting_venue_id: string | null }).hosting_venue_id;

describe('which venues are listable', () => {
  it('lists unarchived venues on the account’s side of the demonstration line, with no contact details', () => {
    const demo = hostingVenueOptions(true);
    expect(demo.map((v) => v.id)).toContain('VN-0032');
    expect(demo.map((v) => v.id)).not.toContain('VN-0900');
    const real = hostingVenueOptions(false);
    expect(real.map((v) => v.id)).toEqual(['VN-0900']);
    expect(real[0]).toEqual({ id: 'VN-0900', nameEn: 'Real Hall', nameAr: 'القاعة الحقيقية', districtEn: 'Matn', districtAr: 'المتن' });
    expect(JSON.stringify(real)).not.toMatch(/Private Person|961/);
  });

  it('refuses an unknown id, an archived venue, and a venue across the demonstration line', () => {
    expect(isListableHostingVenue('VN-9999', true)).toBe(false);
    expect(isListableHostingVenue('not-a-venue', false)).toBe(false);
    expect(isListableHostingVenue('VN-0901', false)).toBe(false);
    expect(isListableHostingVenue('VN-0032', false)).toBe(false);
    expect(isListableHostingVenue('VN-0900', true)).toBe(false);
    expect(isListableHostingVenue('VN-0032', true)).toBe(true);
    expect(isListableHostingVenue('VN-0900', false)).toBe(true);
  });

  it('stores nothing when the event is not at a fixed venue, or no venue is chosen', () => {
    expect(resolveHostingVenue(false, 'VN-9999', true)).toEqual({ ok: true, venueId: null });
    expect(resolveHostingVenue(true, '', true)).toEqual({ ok: true, venueId: null });
    expect(resolveHostingVenue(true, null, false)).toEqual({ ok: true, venueId: null });
  });
});

describe('the event actions validate the choice on the server', () => {
  it('a demonstration organizer stores a demonstration venue and is refused an unknown or a real one', async () => {
    asDemoOrganizer();
    const created = await createEventAction(payload('VN-0032'));
    expect('eventId' in created).toBe(true);
    const eventId = (created as { eventId: string }).eventId;
    expect(stored(eventId)).toBe('VN-0032');
    expect(hostingVenueForEvent(eventId)).toEqual({ id: 'VN-0032', nameEn: 'Forum de Beyrouth', nameAr: 'فوروم دو بيروت' });

    const before = (getDb().prepare(`SELECT COUNT(*) AS n FROM events`).get() as { n: number }).n;
    expect(await createEventAction(payload('VN-9999'))).toEqual({ error: 'hosting-venue' });
    expect(await createEventAction(payload('VN-0900'))).toEqual({ error: 'hosting-venue' });
    expect((getDb().prepare(`SELECT COUNT(*) AS n FROM events`).get() as { n: number }).n).toBe(before);

    // Editing the draft carries the same refusal and keeps the stored choice.
    expect(await updateDraftEventAction(eventId, payload('VN-0900'))).toEqual({ error: 'hosting-venue' });
    expect(stored(eventId)).toBe('VN-0032');
    // Unticking the box clears the venue.
    expect(await updateDraftEventAction(eventId, payload('VN-0032', false))).toEqual({ eventId });
    expect(stored(eventId)).toBeNull();
    expect(hostingVenueForEvent(eventId)).toBeNull();
  });

  it('a real organizer stores a real venue and is refused a demonstration one', async () => {
    asRealOrganizer();
    expect(await createEventAction(payload('VN-0032'))).toEqual({ error: 'hosting-venue' });
    const created = await createEventAction(payload('VN-0900'));
    const eventId = (created as { eventId: string }).eventId;
    expect(stored(eventId)).toBe('VN-0900');

    // The edit-details screen refuses on the same rule.
    const form = new FormData();
    form.set('nameEn', 'Hosted concert'); form.set('nameAr', 'حفل مستضاف');
    form.set('startDate', '2026-12-01'); form.set('endDate', '2026-12-01');
    form.set('hostingVenueId', 'VN-0032');
    await expect(editEventDetailsAction(eventId, form)).rejects.toThrow('error=hosting-venue');
    expect(stored(eventId)).toBe('VN-0900');
    form.set('hostingVenueId', '');
    await expect(editEventDetailsAction(eventId, form)).rejects.toThrow('notice=details-saved');
    expect(stored(eventId)).toBeNull();
  });
});
