'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Text that can only be ONE language at a time. Everywhere else both languages sit in
 * the DOM as data-l spans and CSS shows one; an <option> holds plain text only, so it
 * cannot carry two spans. Until now dropdowns showed "English · العربية" in both
 * interfaces. This renders the document's current language and follows the toggle,
 * which flips <html lang> without a reload.
 *
 * The server renders the language from the cookie (the root layout passes it in), so
 * the first paint is already right and hydration matches.
 */
const ServerLang = createContext<'en' | 'ar'>('en');

export function LangProvider({ lang, children }: { lang: 'en' | 'ar'; children: ReactNode }) {
  return <ServerLang.Provider value={lang}>{children}</ServerLang.Provider>;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return () => observer.disconnect();
}

export function useDocumentLang(): 'en' | 'ar' {
  const initial = useContext(ServerLang);
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.lang === 'ar' ? 'ar' : 'en'),
    () => initial,
  );
}

export function OptionText({ en, ar }: { en: string; ar: string }) {
  return <>{useDocumentLang() === 'ar' ? ar : en}</>;
}
