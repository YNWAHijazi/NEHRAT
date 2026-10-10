/**
 * CHANGING A SITE AFTER IT IS FILED (owner, 10 October 2026: "if someone filled a site and
 * they want to change something after they submitted ... add an AED ... they would send a
 * request with what they want to change").
 *
 * Three cases, by where the registration stands (lib/rules/site.ts):
 *  - In preparation, or asked for information: the record is open -- the change is made
 *    directly, and the registration is submitted (again).
 *  - With the Ministry (submitted or under review): the record is read-only, as a filed event
 *    is. The operator REQUESTS the change -- what and why -- and the Ministry reopens the
 *    registration for it, or answers without reopening.
 *  - Accepted: the site is maintained, not re-registered (revision section 14). Every change
 *    is made directly on the record and kept in its history, which the Ministry sees.
 */
import type { SiteStatusKey } from './site';

export type SiteChangeAspectKey = 'aedAdd' | 'aedChange' | 'contact' | 'emsAccess' | 'details' | 'layout' | 'other';

/** What an operator may need to change, in the revision's own list (section 14) plus an AED added. */
export const SITE_CHANGE_ASPECTS: readonly { key: SiteChangeAspectKey; en: string; ar: string }[] = [
  { key: 'aedAdd', en: 'Add an AED', ar: 'إضافة جهاز إزالة رجفان' },
  { key: 'aedChange', en: 'An AED moved, replaced or out of service', ar: 'نقل جهاز أو استبداله أو توقفه عن العمل' },
  { key: 'contact', en: 'Responsible contact', ar: 'جهة الاتصال المسؤولة' },
  { key: 'emsAccess', en: 'EMS access', ar: 'وصول خدمات الطوارئ الطبية' },
  { key: 'details', en: 'Site details or operating hours', ar: 'تفاصيل الموقع أو ساعات العمل' },
  { key: 'layout', en: 'Location or layout', ar: 'الموقع أو المخطط' },
  { key: 'other', en: 'Something else', ar: 'أمر آخر' },
];

export function isSiteChangeAspect(key: string): key is SiteChangeAspectKey {
  return SITE_CHANGE_ASPECTS.some((a) => a.key === key);
}

export type SiteChangeMode = 'direct' | 'request' | 'none';

/**
 * How a change is made now: directly, by request to the Ministry, or not at all (archived).
 * Requested only while the Ministry holds a filing that has never been accepted.
 */
export function siteChangeMode(f: { status: SiteStatusKey; everAccepted: boolean; archived: boolean }): SiteChangeMode {
  if (f.archived) return 'none';
  if (f.everAccepted) return 'direct';
  return f.status === 'submitted' || f.status === 'underReview' ? 'request' : 'direct';
}

export type SiteChangeRequestStatus = 'open' | 'reopened' | 'answered';

/** The request's state as the operator and the Ministry read it. Neither is a determination. */
export function siteChangeRequestLabel(status: SiteChangeRequestStatus): { en: string; ar: string } {
  if (status === 'reopened') return { en: 'Reopened for the change', ar: 'أُعيد فتحه لإجراء التغيير' };
  if (status === 'answered') return { en: 'Answered by the Ministry', ar: 'أجابت عنه الوزارة' };
  return { en: 'Sent to the Ministry', ar: 'أُرسل إلى الوزارة' };
}

/** Where each change is made on the record, while it is being prepared (steps) or once accepted (tabs). */
export function siteChangeHref(key: SiteChangeAspectKey, facilityId: string, managing: boolean): string {
  const base = `/facilities/${facilityId}`;
  switch (key) {
    case 'aedAdd':
    case 'aedChange':
      return managing ? `${base}?tab=aeds#aeds` : `${base}?step=aeds#aeds`;
    case 'contact':
      return `${base}/profile#contact`;
    case 'layout':
      return managing ? `${base}?tab=overview#infrastructure` : `${base}?step=infrastructure#infrastructure`;
    case 'emsAccess':
    case 'details':
    case 'other':
      return `${base}/profile`;
  }
}
