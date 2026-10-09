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
import { eventsAtVenuesOf, hostingVenueForEvent, hostingVenueOptions, isListableHostingVenue, resolveHostingVenue } from '../lib/hosting-venues';
import { matchHostingVenues, textNamesVenue } from '../lib/hosting-venue-match';
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

  it('stores nothing when no venue is chosen, and refuses an unlistable id whatever the tick says', () => {
    expect(resolveHostingVenue('', true)).toEqual({ ok: true, venueId: null });
    expect(resolveHostingVenue('  ', true)).toEqual({ ok: true, venueId: null });
    expect(resolveHostingVenue(null, false)).toEqual({ ok: true, venueId: null });
    expect(resolveHostingVenue(undefined, false)).toEqual({ ok: true, venueId: null });
    // The link no longer rides on the fixed-venue tick, so an unlistable id is refused on its own.
    expect(resolveHostingVenue('VN-9999', true)).toEqual({ ok: false });
    expect(resolveHostingVenue('VN-0032', false)).toEqual({ ok: false });
    expect(resolveHostingVenue('VN-0032', true)).toEqual({ ok: true, venueId: 'VN-0032' });
  });
});

describe('matching a typed query against the registered venues', () => {
  const venues = [
    { id: 'VN-0032', nameEn: 'Forum de Beyrouth', nameAr: 'فوروم دو بيروت', districtEn: 'Beirut', districtAr: 'بيروت' },
    { id: 'VN-0028', nameEn: 'Casino Hall', nameAr: 'قاعة الكازينو', districtEn: 'Keserwan', districtAr: 'كسروان' },
  ];
  it('matches the name in either language and the record id, not the district', () => {
    expect(matchHostingVenues(venues, 'forum').map((v) => v.id)).toEqual(['VN-0032']);
    expect(matchHostingVenues(venues, 'الكازينو').map((v) => v.id)).toEqual(['VN-0028']);
    expect(matchHostingVenues(venues, 'vn-0028').map((v) => v.id)).toEqual(['VN-0028']);
    expect(matchHostingVenues(venues, 'Keserwan')).toEqual([]);
    expect(matchHostingVenues(venues, 'Keserwan', { includeDistrict: true }).map((v) => v.id)).toEqual(['VN-0028']);
    expect(matchHostingVenues(venues, 'Jounieh old harbour')).toEqual([]);
  });
  it('keeps a link only while the text still reads as the linked venue’s name', () => {
    expect(textNamesVenue('Forum de Beyrouth', venues[0]!)).toBe(true);
    expect(textNamesVenue(' فوروم دو بيروت ', venues[0]!)).toBe(true);
    expect(textNamesVenue('Forum de Beyrouth, hall B', venues[0]!)).toBe(false);
    expect(textNamesVenue('', venues[0]!)).toBe(false);
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
    // Unticking the box does not remove the link: the tick describes the event, not the link.
    expect(await updateDraftEventAction(eventId, payload('VN-0032', false))).toEqual({ eventId });
    expect(stored(eventId)).toBe('VN-0032');
    expect(hostingVenueForEvent(eventId)).toEqual({ id: 'VN-0032', nameEn: 'Forum de Beyrouth', nameAr: 'فوروم دو بيروت' });
    // Removing the link clears it.
    expect(await updateDraftEventAction(eventId, payload(null, false))).toEqual({ eventId });
    expect(stored(eventId)).toBeNull();
    expect(hostingVenueForEvent(eventId)).toBeNull();
  });

  it('a venue chosen from the location field links an event that is not ticked as at a fixed venue', async () => {
    asDemoOrganizer();
    const created = await createEventAction(payload('VN-0032', false));
    const eventId = (created as { eventId: string }).eventId;
    expect(stored(eventId)).toBe('VN-0032');
    expect(hostingVenueForEvent(eventId)?.id).toBe('VN-0032');
    // The server refusal does not depend on the tick either.
    expect(await createEventAction(payload('VN-0900', false))).toEqual({ error: 'hosting-venue' });
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

describe('events at your venues: the venue owner’s dashboard list', () => {
  const EVENT_FIELDS = ['id', 'nameEn', 'nameAr', 'startDate', 'endDate', 'level', 'statusEn', 'statusAr'];
  let otherDemo = 0;
  let otherReal = 0;
  let demoOwner = 0;
  beforeAll(() => {
    const db = getDb();
    demoOwner = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer'`).get() as { id: number }).id;
    otherDemo = (db.prepare(`SELECT id FROM accounts WHERE login = 'test_organizer_pending'`).get() as { id: number }).id;
    otherReal = Number(
      db.prepare(`INSERT INTO accounts (login, display_name, role, is_demo) VALUES ('real_org_two', 'Second real organizer', 'organizer', 0)`).run().lastInsertRowid,
    );
    db.prepare(
      `INSERT INTO venues (id, account_id, name_en, name_ar, category, is_demo) VALUES ('VN-0950', ?, 'Other Hall', 'قاعة أخرى', 'hall', 1)`,
    ).run(otherDemo);
    const insert = db.prepare(
      `INSERT INTO events (id, account_id, name_en, name_ar, start_date, end_date, venue_route, municipalities,
         hosting_venue_id, lifecycle, archived_at, filed, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 'Private route note', 'Private municipality note', ?, ?, ?, ?, ?)`,
    );
    // Shown: another demonstration organizer's events at the owner's venue, filed and not.
    insert.run('EV-9001', otherDemo, 'Linked concert', 'حفل مرتبط', '2026-12-05', '2026-12-06', 'VN-0032', 'active', null, 1, 1);
    insert.run('EV-9002', otherDemo, 'Linked fair', 'معرض مرتبط', '2026-11-01', '2026-11-01', 'VN-0032', 'postponed', null, 0, 1);
    // Not shown: the owner's own event, a cancelled one, a shelved one, a concluded one,
    // an event at someone else's venue, and an event across the demonstration line.
    insert.run('EV-9003', demoOwner, 'Own event', 'فعالية خاصة', '2026-12-05', '2026-12-05', 'VN-0032', 'active', null, 0, 1);
    insert.run('EV-9004', otherDemo, 'Cancelled', 'ملغاة', '2026-12-05', '2026-12-05', 'VN-0032', 'cancelled', null, 0, 1);
    insert.run('EV-9005', otherDemo, 'Shelved', 'مؤرشفة', '2026-12-05', '2026-12-05', 'VN-0032', 'active', '2026-08-01', 0, 1);
    insert.run('EV-9006', otherDemo, 'Concluded', 'منتهية', '2025-01-01', '2025-01-01', 'VN-0032', 'active', null, 1, 1);
    insert.run('EV-9007', demoOwner, 'Elsewhere', 'في مكان آخر', '2026-12-05', '2026-12-05', 'VN-0950', 'active', null, 0, 1);
    insert.run('EV-9008', otherReal, 'Real event at demo venue', 'فعالية حقيقية', '2026-12-05', '2026-12-05', 'VN-0032', 'active', null, 0, 0);
    // The real side: a real organizer's event at the real venue.
    insert.run('EV-9009', otherReal, 'Real linked', 'فعالية حقيقية مرتبطة', '2026-12-10', '2026-12-10', 'VN-0900', 'active', null, 0, 0);
    db.prepare(
      `INSERT INTO assessments (event_id, version, answers, inputs, derivation, nehrat_tool_version, representative, position)
       VALUES ('EV-9001', 1, ?, ?, '{}', 'test', 'Private Representative', 'Director')`,
    ).run(
      JSON.stringify([2, 2, 1, 0, 1, 1, 1, 1, 0]),
      JSON.stringify({ expectedMaxSimultaneousAttendance: 3000, eventDisciplines: [], courseDistanceKm: null, venueLicensedCapacity: null, venueIsNightclubOrDanceVenue: false }),
    );
  });

  it('lists only other organizers’ live events at the owner’s venues, grouped by venue', () => {
    const groups = eventsAtVenuesOf(demoOwner, true);
    expect(groups.map((g) => g.venueId)).toEqual(['VN-0032']);
    expect(groups[0]!.events.map((e) => e.id).sort()).toEqual(['EV-9001', 'EV-9002']);
    // VN-0950 belongs to the other organizer, who sees the owner's event there and nothing at VN-0032.
    expect(eventsAtVenuesOf(otherDemo, true)).toEqual([
      { venueId: 'VN-0950', venueNameEn: 'Other Hall', venueNameAr: 'قاعة أخرى', events: [expect.objectContaining({ id: 'EV-9007' })] },
    ]);
    // The real owner sees the real event at the real venue; the demonstration world is not there.
    const real = eventsAtVenuesOf(realAccountId, false);
    expect(real.map((g) => g.venueId)).toEqual(['VN-0900']);
    expect(real[0]!.events.map((e) => e.id)).toEqual(['EV-9009']);
    // An account with no venue sees nothing.
    expect(eventsAtVenuesOf(otherReal, false)).toEqual([]);
  });

  it('returns only the name, dates, record id, derived level and plain status', () => {
    const groups = eventsAtVenuesOf(demoOwner, true);
    for (const g of groups) {
      expect(Object.keys(g).sort()).toEqual(['events', 'venueId', 'venueNameAr', 'venueNameEn']);
      for (const e of g.events) expect(Object.keys(e).sort()).toEqual([...EVENT_FIELDS].sort());
    }
    const concert = groups[0]!.events.find((e) => e.id === 'EV-9001')!;
    expect(concert).toEqual({
      id: 'EV-9001', nameEn: 'Linked concert', nameAr: 'حفل مرتبط', startDate: '2026-12-05', endDate: '2026-12-06',
      level: concert.level, statusEn: 'In process', statusAr: 'قيد المعالجة',
    });
    expect([1, 2, 3]).toContain(concert.level);
    const fair = groups[0]!.events.find((e) => e.id === 'EV-9002')!;
    expect(fair.level).toBeNull();
    expect(fair.statusEn).toBe('Postponed');
    // Nothing about the organizer, the place text, the answers or the certification.
    expect(JSON.stringify(groups)).not.toMatch(/Private|test_organizer_pending|S\. Khoury|R\. Haddad|3000/);
  });

  it('selects only those columns in SQL, not a wide row trimmed at render', () => {
    const db = getDb();
    const seen: string[] = [];
    const prepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      seen.push(sql);
      return prepare(sql);
    });
    try {
      eventsAtVenuesOf(demoOwner, true);
    } finally {
      spy.mockRestore();
    }
    const listSql = seen.find((s) => /JOIN venues v ON v\.id = e\.hosting_venue_id/.test(s) && /v\.account_id = \?/.test(s));
    expect(listSql).toBeDefined();
    const selected = listSql!
      .slice(listSql!.indexOf('SELECT') + 'SELECT'.length, listSql!.indexOf('FROM'))
      .split(',')
      .map((c) => c.trim().split(/\s+AS\s+/i).pop()!.replace(/^[ev]\./, ''));
    expect(selected.sort()).toEqual(
      ['archived_at', 'end_date', 'filed', 'id', 'lifecycle', 'name_ar', 'name_en', 'start_date', 'venue_id', 'venue_name_ar', 'venue_name_en'].sort(),
    );
  });
});
