import type { BrowserContext } from '@playwright/test';

/**
 * Completing a journey in Arabic, not merely visiting it.
 *
 * The language is a `lang` cookie the server reads before it renders, so the whole
 * page arrives in one language and nothing flashes. Setting it here means a journey
 * runs in Arabic from its first request -- including the redirects, the server
 * actions' notices and the validation messages, which a click on the toggle
 * mid-journey would not cover.
 *
 * WHY BOTH LANGUAGES MATTER FOR A JOURNEY RATHER THAN A SCREEN: parity is checked
 * per string by the bilingual guard, and per screen by the visual comparison. Neither
 * of them can tell you that the ARABIC path completes -- that every button a person
 * has to press exists, is reachable, and leads to the next screen when the layout is
 * mirrored. That is a property of the journey, and only a journey can prove it.
 */
export async function useLanguage(context: BrowserContext, lang: 'en' | 'ar'): Promise<void> {
  // The port is the run's, not a constant: the suite runs on E2E_PORT so a developer's
  // own dev server on 3000 does not block it.
  const port = process.env['E2E_PORT'] ?? '3000';
  await context.addCookies([
    { name: 'lang', value: lang, url: `http://localhost:${port}` },
  ]);
}

/** The language a journey is running in, for naming its test. */
export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];
