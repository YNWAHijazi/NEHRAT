import { test } from '@playwright/test';

/** Demo seed dates move with Beirut today, except in the pinned development suite. */
export function seededDate(reference: string): string {
  const server = test.info().config.webServer;
  const today = server?.env?.REVIEW_CLOCK || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
  }).format(new Date());
  const shift = Date.parse(`${today}T00:00:00Z`) - Date.parse('2026-08-13T00:00:00Z');
  return new Date(Date.parse(`${reference}T00:00:00Z`) + shift).toISOString().slice(0, 10);
}
