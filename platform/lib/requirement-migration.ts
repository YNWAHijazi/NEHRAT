/**
 * Maps the answers the platform stored BEFORE the single record page onto the
 * requirement catalogue's stable keys (brief item 19). Runs once per database (a
 * marker row records it) and once more at the end of the demonstration seeder, because
 * the seeder writes the old shapes after the migration has already run.
 *
 * THE RULE: never fabricate completion. An old free-text plan section becomes that
 * section's narrative text, which counts for a section that is answered by text and
 * NOT for one that is answered by a structured requirement row -- so a migrated draft
 * shows the newly required answers as pending. An old "covered" tick on a major-incident
 * item is a tick, not an answer, and is not carried. Only targets with no answer are
 * written, so re-running is harmless.
 *
 * Files keep their tables: event attachments stay in event_attachments under their old
 * document keys (the serving route, the viewer and the reviewer read them there) and
 * lib/record-facts.ts maps those keys to the catalogue's. Venue attachments move to the
 * catalogue key where the old key was a row number.
 */

import type { DatabaseSync } from 'node:sqlite';

/** Event attachment document key per catalogue key -- the one place the two vocabularies meet. */
export const EVENT_FILE_KEYS: Readonly<Record<string, string>> = {
  'P-M': 'siteMap',
  'P-D': 'deploymentMap',
  B17: 'insuranceEvidence',
  B2: 'planDocument',
};

/** Ministry "added measure" catalogue keys that name a requirement row. */
export const REQUESTED_KEYS: Readonly<Record<string, string>> = {
  plan: 'B2',
  siteMap: 'P-M',
  deploymentMap: 'P-D',
  insuranceEvidence: 'B17',
};

type Values = Record<string, string | boolean | number>;

function insertAnswer(d: DatabaseSync, kind: 'event' | 'venue', id: string, key: string, values: Values, role: string, name: string, at: string | null): void {
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && v !== null));
  if (Object.keys(clean).length === 0) return;
  d.prepare(
    `INSERT OR IGNORE INTO requirement_answers (record_kind, record_id, key, answers, author_role, author_name, version, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, COALESCE(?, now_stamp()))`,
  ).run(kind, id, key, JSON.stringify(clean), role, name, at);
}

/** Old venue field keys -> catalogue field keys, per row. Unlisted keys are dropped. */
const VENUE_FIELD_MAP: Readonly<Record<string, Readonly<Record<string, string | string[]>>>> = {
  4: { team: 'who', coverage: 'where' },
  5: { teams: 'team' },
  6: { location: 'location', staff: 'staff' },
  7: { arrangements: 'whereWhen', phone: ['phone', 'howToCall'] },
  8: { location: 'location', responders: 'responder' },
  9: { supplies: 'supplies', responsible: 'responsible' },
  10: { entrance: 'entrance', access: 'keeper' },
  11: { route: 'route', support: 'support' },
  12: { hospital: 'department', contact: 'contact' },
  14: { channel: 'method', backup: 'backup' },
  15: { lead: 'lead', contact: 'reporting' },
  16: { steps: ['how', 'when'], authority: ['guides', 'pause'] },
  17: { insurer: 'insurer', coverage: 'coveragePeriod' },
  18: { procedure: 'method' },
};

export function migrateLegacyRequirementAnswers(d: DatabaseSync): void {
  // ---- events: the written plan sections become narrative text on the plan sections;
  // the facility reference's confirmation and its two event facts become the REF answer.
  const plans = d.prepare(`SELECT p.event_id, p.sections, p.updated_at, p.updated_by, p.ref_confirmed, p.ref_admits_children, p.ref_temporary_areas, a.display_name, a.role FROM plans p LEFT JOIN accounts a ON a.id = p.updated_by`).all() as unknown as
    { event_id: string; sections: string; updated_at: string; ref_confirmed: number; ref_admits_children: number; ref_temporary_areas: number; display_name: string | null; role: string | null }[];
  for (const p of plans) {
    if (p.ref_confirmed === 1 || p.ref_admits_children === 1 || p.ref_temporary_areas === 1) {
      const owner = d.prepare(`SELECT a.display_name FROM events e JOIN accounts a ON a.id = e.account_id WHERE e.id = ?`).get(p.event_id) as { display_name: string } | undefined;
      insertAnswer(d, 'event', p.event_id, 'REF', { confirmed: p.ref_confirmed === 1, admitsChildren: p.ref_admits_children === 1, temporaryAreas: p.ref_temporary_areas === 1 }, 'organizer', owner?.display_name ?? '', p.updated_at);
    }
    let sections: Record<string, { text?: string }> = {};
    try { sections = JSON.parse(p.sections) as Record<string, { text?: string }>; } catch { continue; }
    for (const [n, s] of Object.entries(sections)) {
      const text = s?.text?.trim();
      if (!text || !/^\d+$/.test(n)) continue;
      const key = `P${n.padStart(2, '0')}`;
      insertAnswer(d, 'event', p.event_id, key, { text }, p.role === 'director' ? 'director' : 'ems', p.display_name ?? '', p.updated_at);
    }
  }

  // ---- events: the Level 2 EMS operational detail becomes the agency's shared answers
  const details = d.prepare(`SELECT event_id, name_en, ops_detail, answered_at FROM invitations WHERE kind = 'ems' AND status = 'confirmed' AND ops_detail != '{}'`).all() as unknown as
    { event_id: string; name_en: string; ops_detail: string; answered_at: string | null }[];
  for (const i of details) {
    let ops: Record<string, string> = {};
    try { ops = JSON.parse(i.ops_detail) as Record<string, string>; } catch { continue; }
    const t = (k: string) => (ops[k] ?? '').trim();
    const call = [t('contactName'), t('phone')].filter(Boolean).join(' · ');
    insertAnswer(d, 'event', i.event_id, 'B7', { whereWhen: [t('ambulances'), t('deployment')].filter(Boolean).join(' — '), howToCall: call }, 'ems', i.name_en, i.answered_at);
    insertAnswer(d, 'event', i.event_id, 'B5', { team: i.name_en, coverage: t('teams') }, 'ems', i.name_en, i.answered_at);
    insertAnswer(d, 'event', i.event_id, 'B12', { department: t('hospitals') }, 'ems', i.name_en, i.answered_at);
    insertAnswer(d, 'event', i.event_id, 'B14', { method: t('communications') }, 'ems', i.name_en, i.answered_at);
    insertAnswer(d, 'event', i.event_id, 'B11', { route: t('access') }, 'ems', i.name_en, i.answered_at);
    insertAnswer(d, 'event', i.event_id, 'B16', { when: t('escalation') }, 'ems', i.name_en, i.answered_at);
  }

  // ---- events: the insurance block of the compliance form becomes the insurance row
  const insurance = d.prepare(`SELECT s.event_id, s.insurance, a.display_name FROM submissions s JOIN events e ON e.id = s.event_id JOIN accounts a ON a.id = e.account_id WHERE s.insurance != '{}'`).all() as unknown as
    { event_id: string; insurance: string; display_name: string }[];
  for (const s of insurance) {
    let ins: Record<string, string> = {};
    try { ins = JSON.parse(s.insurance) as Record<string, string>; } catch { continue; }
    insertAnswer(d, 'event', s.event_id, 'B17', { insurer: ins['insurer'] ?? '', policyNumber: ins['policyNumber'] ?? '', coveragePeriod: ins['coveragePeriod'] ?? '' }, 'organizer', s.display_name, null);
  }

  // ---- venues: the package answers and partner contributions become the rows' answers
  const packages = d.prepare(`SELECT p.venue_id, p.answers, a.display_name FROM venue_packages p JOIN venues v ON v.id = p.venue_id JOIN accounts a ON a.id = v.account_id`).all() as unknown as
    { venue_id: string; answers: string; display_name: string }[];
  for (const p of packages) {
    let answers: Record<string, Record<string, string>> = {};
    try { answers = JSON.parse(p.answers) as Record<string, Record<string, string>>; } catch { continue; }
    const contributions = d.prepare(`SELECT c.requirement_key, c.completed_at, i.kind, i.name FROM venue_contributions c JOIN venue_invitations i ON i.token = c.invitation_token WHERE c.venue_id = ?`).all(p.venue_id) as unknown as
      { requirement_key: string; completed_at: string; kind: 'ems' | 'director'; name: string }[];
    for (const [n, old] of Object.entries(answers)) {
      const map = VENUE_FIELD_MAP[n];
      if (!map || !old) continue;
      const values: Values = {};
      for (const [from, to] of Object.entries(map)) {
        const v = (old[from] ?? '').trim();
        if (!v) continue;
        for (const target of Array.isArray(to) ? to : [to]) values[target] = v;
      }
      if (n === '7' && old['localConfirmed'] === 'yes') values['contacted'] = true;
      const by = contributions.find((c) => c.requirement_key === n);
      insertAnswer(d, 'venue', p.venue_id, `B${n}`, values, by?.kind ?? 'organizer', by?.name ?? p.display_name, by?.completed_at ?? null);
    }
  }
  // Venue files whose key was a row number take the catalogue key; per-agency declarations keep theirs.
  d.exec(`UPDATE venue_attachments SET doc_key = 'B17' WHERE doc_key = '17' AND NOT EXISTS (SELECT 1 FROM venue_attachments x WHERE x.venue_id = venue_attachments.venue_id AND x.doc_key = 'B17')`);
  d.exec(`UPDATE venue_attachments SET doc_key = 'B2' WHERE doc_key = '2' AND NOT EXISTS (SELECT 1 FROM venue_attachments x WHERE x.venue_id = venue_attachments.venue_id AND x.doc_key = 'B2')`);
}
