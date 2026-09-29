import Link from 'next/link';
import { L } from './L';

export function EventWorkspaceNav({ eventId, active }: { eventId: string; active: 'overview' | 'requirements' | 'director' | 'ems' | 'plan' }) {
  const items = [
    { key: 'overview', path: '', en: 'Overview', ar: 'نظرة عامة' },
    { key: 'requirements', path: '/requirements', en: 'Requirements', ar: 'المتطلبات' },
    { key: 'director', path: '/medical-team?tab=director', en: 'Medical Director', ar: 'المدير الطبي' },
    { key: 'ems', path: '/medical-team?tab=ems', en: 'EMS agencies', ar: 'جهات الإسعاف' },
  ];
  return <nav aria-label="Event sections" data-region="event-workspace-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBlockEnd: '1px solid var(--line)', paddingBlockEnd: 12, marginBlock: '16px 28px' }}>
    {items.map(item => <Link key={item.key} href={`/events/${eventId}${item.path}`} aria-current={active === item.key ? 'page' : undefined} style={{ padding: '10px 16px', borderRadius: 8, textDecoration: 'none', background: active === item.key ? 'var(--brand-soft)' : 'transparent', color: active === item.key ? 'var(--brand)' : 'var(--muted)', fontWeight: active === item.key ? 600 : 400 }}><L en={item.en} ar={item.ar} /></Link>)}
  </nav>;
}
