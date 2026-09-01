import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { currentAccount } from '../lib/auth';
import { DemonstrationBand } from '../components/DemonstrationBand';
import { ControlDock } from '../components/ControlDock';
import './globals.css';

export const metadata = {
  title: 'National Health and Medical Readiness — Ministry of Public Health',
  description:
    'Health and medical preparedness at mass-gathering events, and cardiac-arrest readiness in designated facilities. Republic of Lebanon.',
};

/**
 * The html attributes -- lang, dir, theme, palette, text size -- come from cookies so
 * the server renders the chosen state and nothing flashes. Arabic sets dir=rtl and the
 * whole layout mirrors through the logical properties in globals.css.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const lang = jar.get('lang')?.value === 'ar' ? 'ar' : 'en';
  const theme = jar.get('theme')?.value === 'dark' ? 'dark' : 'light';
  const palette = jar.get('palette')?.value === 'cedar' ? 'cedar' : 'petrol';
  const textsizeRaw = jar.get('textsize')?.value;
  const textsize = textsizeRaw === '112' || textsizeRaw === '125' ? textsizeRaw : '100';
  // The band is a property of the SESSION, not of the route, so it is resolved once here
  // rather than by each screen remembering to render it. A screen that forgot would be
  // the one screenshotted.
  const account = await currentAccount();
  const demonstration = account?.isDemo === true;

  return (
    <html
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-theme={theme}
      data-palette={palette}
      data-textsize={textsize}
      {...(demonstration ? { 'data-demonstration': '' } : {})}
      style={textsize === '100' ? undefined : { fontSize: `${textsize}%` }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {demonstration ? <DemonstrationBand /> : null}
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{children}</div>
        <ControlDock />
      </body>
    </html>
  );
}
