/**
 * Structured requirement answers for the demonstration events, so the Ministry can
 * walk the single record page over coherent records (non-negotiable 8: demonstration
 * rows are real rows). Written by the seeder only, after the records exist; the
 * values are illustrative English and Arabic in the register of the instrument.
 *
 * What is seeded, and why: EV-0362 (Level 3, returned for revision) carries a complete
 * plan and the Director's approval, so the revision re-file walkthrough can complete;
 * EV-0244 (Level 3, satisfied) and EV-0301 / EV-0455 (Level 2, filed) read as the
 * records the Ministry determined; EV-0418 (Level 2, in preparation) carries the
 * organizer's rows and leaves the agency's for the walkthrough to complete.
 */

import type { DatabaseSync } from 'node:sqlite';
import { fieldsFor, planTextKeys, resolveRequirements, type Level, type RecordFacts } from './rules';

type Values = Record<string, string | boolean | number>;

const SAMPLE: Readonly<Record<string, string>> = {
  name: 'Nour Khoury', phone: '+961 3 456 789',
  who: 'Lebanese Red Cross first-aid volunteers', where: 'Beside the main entrance', contact: 'Steward radio, channel 2', training: 'First-aid certificate, renewed this year',
  team: 'Lebanese Red Cross Beirut station', coverage: 'Start and finish areas, from opening to closing',
  location: 'First-aid tent beside the finish', hours: 'Opening to closing', staff: 'Two EMTs and a nurse', support: 'Oxygen and a stretcher',
  whereWhen: 'One ambulance at the finish from 06:00 to 12:00', howToCall: 'Radio channel 1 or 140', ifLeaves: 'The second unit covers until it returns',
  responder: 'EMT on duty at the tent', access: 'Marked on the site map; the steward brings it',
  supplies: 'First-aid kits, splints, cold packs and dressings', responsible: 'The medical team lead',
  entrance: 'Gate B on the corniche', keeper: 'Parking marshals', route: 'Paved path from the course to Gate B; no stairs',
  department: 'Rafik Hariri University Hospital emergency department', backup: 'Hotel-Dieu de France',
  method: 'Radios on two channels', whoCalls: 'The medical team lead',
  lead: 'Dr Karim Saad', reporting: 'Team leads report to the Director; the Director makes medical decisions',
  when: 'Any case beyond first aid, or two simultaneous casualties', told: 'Radio channel 1', pause: 'The race director, on the Director’s advice',
  how: 'Calls 140', guides: 'The site manager',
  insurer: 'Cedar Assurance SAL', policyNumber: 'CA-2026-11842', coveragePeriod: 'Event dates, participants and spectators',
  provider: 'Lebanese Red Cross', text: 'Documented in the shared plan.',
  roles: 'Nearest responder starts CPR, the tent calls 140 and brings the AED, the EMT hands over to the ambulance crew',
  units: 'Two BLS ambulances at the finish and one at the 6 km mark, 06:00 to 12:00, dispatched by radio channel 1',
  whileTransporting: 'The second unit moves to the finish; the station sends a replacement within 20 minutes',
  extraResources: 'The medical lead calls the Red Cross dispatcher on 140 and names the extra units needed',
  alternate: 'Hotel-Dieu de France emergency department', travelTime: '12 minutes to Rafik Hariri, 18 minutes to Hotel-Dieu', limitations: 'No paediatric intensive care at the alternate',
  recognition: 'Stewards and runners report a collapse by radio channel 2; the control post locates it on the course map',
  equipment: 'Finish tent: trauma bag, oxygen, AED, stretcher, checked by the EMT lead at 05:30; each ambulance: standard BLS kit',
  advanced: 'Two oxygen cylinders at the tent, one per ambulance; two AEDs; airway adjuncts and a bag-valve mask with each EMT',
  replacement: 'The tent holds a reserve kit; the station restocks on request by radio',
};

function valuesFor(key: string, level: Level, service: 'event' | 'venue', fill = true): Values | null {
  const fields = fieldsFor(key, level, service);
  if (!fields) return null;
  const out: Values = {};
  for (const f of fields) {
    if (f.showWhen && f.showWhen.equals !== 'yes') continue;
    if (f.type === 'checkbox') out[f.key] = fill;
    else if (f.type === 'number') out[f.key] = 6;
    else if (f.type === 'choice') out[f.key] = 'yes';
    else out[f.key] = SAMPLE[f.key] ?? SAMPLE['text']!;
  }
  return out;
}

function write(db: DatabaseSync, kind: 'event' | 'venue', id: string, key: string, values: Values, role: 'organizer' | 'ems' | 'director', name: string, at: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO requirement_answers (record_kind, record_id, key, answers, author_role, author_name, version, saved_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(kind, id, key, JSON.stringify(values), role, name, at);
}

/**
 * Every row the level asks of the record, answered by the party named first on it;
 * `only` narrows to a set of roles (the organizer's rows alone, for a record still in
 * preparation). Plan texts and major-incident items follow at Levels 2 and 3.
 */
export function seedRecordAnswers(db: DatabaseSync, kind: 'event' | 'venue', id: string, level: Level, at: string, names: { organizer: string; ems: string; director: string }, only?: readonly ('organizer' | 'ems' | 'director')[]): void {
  const facts: RecordFacts = {
    service: kind, level, answers: {}, files: {}, organizerContact: null, assessmentComplete: true,
    ems: [], director: null, planApprovalCurrent: false, declaration: { statementsComplete: true, certificationComplete: true }, requested: [],
  };
  for (const inst of resolveRequirements(facts)) {
    if (inst.fields.length === 0 || inst.authors.length === 0) continue;
    const role = inst.authors[0]!;
    if (only && !inst.authors.some((a) => only.includes(a))) continue;
    const author = only ? (inst.authors.find((a) => only.includes(a)) ?? role) : role;
    const values = valuesFor(inst.key, level, kind);
    if (values) write(db, kind, id, inst.key, values, author, names[author], at);
  }
  if (level >= 2 && (!only || only.includes('ems') || only.includes('director'))) {
    // The plan's own text is the medical team's: the agency at Level 2, the Director at Level 3 (D1).
    const author = level === 3 ? 'director' : 'ems';
    for (const key of planTextKeys()) {
      if (key.startsWith('M') && level < 3) continue;
      write(db, kind, id, key, { text: SAMPLE['text']! }, author, names[author], at);
    }
  }
}
