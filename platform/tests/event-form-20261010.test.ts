/**
 * THE EVENT FORM AFTER A FIRST-TIME USER (owner, 10 October 2026): one attendance figure decides
 * question 1; question 2 follows the event type where the type decides it; the Arabic name holds
 * Arabic letters only; every question carries one plain line saying what it asks.
 */
import { describe, expect, it } from 'vitest';
import { DOMAINS, attendanceBandScore } from '../lib/rules/load';
import { EVENT_TYPES, activityAnswerForType, isArabicName } from '../lib/rules/event-labels';

describe('question 1 follows the one attendance figure', () => {
  it('reads the option whose lowest attendance the figure reaches', () => {
    expect(attendanceBandScore(null)).toBeNull();
    expect(attendanceBandScore(0)).toBe(0);
    expect(attendanceBandScore(999)).toBe(0);
    expect(attendanceBandScore(1000)).toBe(1);
    expect(attendanceBandScore(9999)).toBe(1);
    expect(attendanceBandScore(10000)).toBe(2);
    expect(attendanceBandScore(25000)).toBe(2);
    expect(attendanceBandScore(-1)).toBeNull();
  });
});

describe('question 2 from the event type', () => {
  const type = (key: string) => EVENT_TYPES.find((t) => t.key === key)!;
  it('answers 2 for every endurance or combat type, 1 for a concert, 0 for a conference', () => {
    for (const key of ['running', 'cycling', 'triathlon', 'open_water', 'boxing', 'kickboxing', 'muay_thai', 'mma', 'motor']) {
      expect(activityAnswerForType(key, type(key).disciplines), key).toBe(2);
    }
    expect(activityAnswerForType('concert', [])).toBe(1);
    expect(activityAnswerForType('gathering', [])).toBe(0);
  });
  it('an added endurance activity raises a concert or conference to 2', () => {
    expect(activityAnswerForType('gathering', ['running'])).toBe(2);
  });
  it('leaves the types that could fall under more than one option to the organizer', () => {
    for (const key of ['other_sport', 'nightclub', 'other']) expect(activityAnswerForType(key, []), key).toBeNull();
  });
});

describe('the Arabic event name', () => {
  it('takes Arabic letters, digits and punctuation, and refuses Latin letters', () => {
    expect(isArabicName('ماراتون بيروت 2026')).toBe(true);
    expect(isArabicName('مهرجان صور الصيفي - الدورة ٣')).toBe(true);
    expect(isArabicName('Bla bla')).toBe(false);
    expect(isArabicName('ماراتون Beirut')).toBe(false);
  });
});

describe('every question says what it asks', () => {
  it('carries a plain lead in both languages', () => {
    expect(DOMAINS).toHaveLength(9);
    for (const d of DOMAINS) {
      expect(d.leadEn.trim(), String(d.number)).not.toBe('');
      expect(d.leadAr.trim(), String(d.number)).not.toBe('');
    }
    expect(DOMAINS[6]!.leadEn).toBe('In an emergency, how is a patient reached and carried out to an ambulance?');
  });
});
