import Link from 'next/link';
import { L } from './L';

/**
 * The master administrator's console, as one surface with four tabs.
 *
 * WHY THIS EXISTS. The administrator was a reviewer with fewer powers: it could see
 * five roles out of nine on a users screen, configure two instruments on two
 * unrelated screens, and read submissions through the reviewer's own queue. There was
 * no oversight anywhere -- no way to look at the platform rather than at one record
 * on it. Four tabs, and each one answers a question an overseeing profile has:
 *
 *   Records       what has been submitted, and what happened to each
 *   Users         who is on the platform, how they got here, what they hold
 *   Activity      who did what, when -- the audit trail as a surface
 *   Configuration what is set, what is unset, and from when
 *
 * The tabs are links, not client state: each is a route, so a reviewer can be sent
 * one, and the browser's own back button works.
 */

export const ADMIN_TABS = [
  { href: '/ministry/admin/records', en: 'Records', ar: 'السجلات' },
  { href: '/ministry/admin/users', en: 'Users', ar: 'المستخدمون' },
  { href: '/ministry/admin/activity', en: 'Activity', ar: 'النشاط' },
  { href: '/ministry/admin/configuration', en: 'Configuration', ar: 'الإعدادات' },
] as const;

export function AdminTabs({ current }: { current: string }): React.ReactElement {
  return (
    <div
      data-tabs=""
      data-region="admin-tabs"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockEnd: 28, borderBlockEnd: '1px solid var(--line)', paddingBlockEnd: 12 }}
    >
      {ADMIN_TABS.map((t) => {
        const on = current === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              paddingBlock: 8,
              paddingInline: 16,
              borderRadius: 999,
              fontSize: 14,
              background: on ? 'var(--brand-soft)' : 'transparent',
              color: on ? 'var(--brand)' : 'var(--muted)',
              fontWeight: on ? 500 : 400,
            }}
          >
            <L en={t.en} ar={t.ar} />
          </Link>
        );
      })}
    </div>
  );
}
