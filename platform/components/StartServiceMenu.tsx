'use client';

/**
 * "Start a service" -- the searchable three-item menu from the reference. This is how a
 * new service is started; the three journeys, each naming its instrument.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { L } from './L';

const ITEMS = [
  {
    href: '/events/new',
    en: 'Certify an event', ar: 'اعتماد فعالية',
    descEn: 'Complete the assessment and file before the deadline your level sets.',
    descAr: 'استكملوا التقييم وقدّموا قبل المهلة التي يحددها مستواكم.',
    instrEn: 'Mass-gathering events', instrAr: 'الفعاليات الجماهيرية',
    color: 'var(--brand)',
    kw: 'event certify assessment level deadline submission race concert فعالية اعتماد تقييم مستوى مهلة',
  },
  {
    href: '/venues/new',
    en: 'Register a recurring venue', ar: 'تسجيل موقع فعاليات متكرر',
    descEn: 'Annual classification for a venue licensed for 1,000 or more.',
    descAr: 'تصنيف سنوي لموقع مرخّص لألف شخص أو أكثر.',
    instrEn: 'Mass-gathering events', instrAr: 'الفعاليات الجماهيرية',
    color: 'var(--brand)',
    kw: 'venue hall stadium capacity annual classification موقع قاعة ملعب سعة تصنيف سنوي',
  },
  {
    href: '/facilities/new',
    en: 'Register a facility', ar: 'تسجيل منشأة',
    descEn: 'Register the facility, its coordinator and each defibrillator, and keep the response plan current.',
    descAr: 'سجّلوا المنشأة ومنسّقها وكل جهاز، واحفظوا خطة الاستجابة محدّثة.',
    instrEn: 'Cardiac-arrest readiness', instrAr: 'الجاهزية لتوقف القلب',
    color: 'var(--accent-ink)',
    kw: 'facility aed defibrillator cardiac gym pool school coordinator منشأة جهاز إزالة رجفان قلب صالة مسبح مدرسة منسّق',
  },
];

export function StartServiceMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const items = query
    ? ITEMS.filter((i) =>
        `${i.en} ${i.descEn} ${i.kw}`.toLowerCase().includes(query),
      )
    : ITEMS;

  return (
    <div style={{ flex: 'none', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          height: 44,
          paddingInline: 20,
          border: 0,
          borderRadius: 22,
          background: 'var(--brand)',
          color: 'var(--bg)',
          fontSize: '14.5px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <L en="Start a service" ar="بدء خدمة" />
        <span style={{ fontSize: 11, opacity: 0.8 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div
          data-svc-menu=""
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            top: 52,
            zIndex: 30,
            width: 380,
            maxWidth: '86vw',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            boxShadow: '0 18px 44px rgba(0,0,0,.16)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 18px', borderBlockEnd: '1px solid var(--line)' }}>
            <input
              type="search"
              aria-label="Search services"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                paddingInline: 12,
                background: 'var(--surface2)',
                borderRadius: 20,
                fontSize: '14.5px',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)' }}>
            {items.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                style={{
                  textAlign: 'start',
                  background: 'var(--bg)',
                  border: 0,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'start',
                }}
              >
                <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: item.color, marginBlockStart: 7 }} />
                <span>
                  <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 500, lineHeight: 1.4 }}>
                    <L en={item.en} ar={item.ar} />
                  </span>
                  <span style={{ display: 'block', fontSize: '12.5px', lineHeight: 1.5, color: 'var(--muted)', marginBlockStart: 3 }}>
                    <L en={item.descEn} ar={item.descAr} />
                  </span>
                  <span style={{ display: 'block', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockStart: 5 }}>
                    <L en={item.instrEn} ar={item.instrAr} />
                  </span>
                </span>
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
              <L
                en="Nothing matches that. All three services are listed when the field is empty."
                ar="لا شيء يطابق ذلك. تُعرض الخدمات الثلاث جميعها عندما يكون الحقل فارغاً."
              />
            </div>
          ) : null}
          <div style={{ padding: '14px 18px', borderBlockStart: '1px solid var(--line)', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted)' }}>
            <L en="All three run on this account. Each produces its own record." ar="تعمل الثلاث على هذا الحساب. وينتج كل منها سجله الخاص." />
          </div>
        </div>
      ) : null}
    </div>
  );
}
