'use client';

/**
 * The registration card, from the reference: the five identity fields, the capacity,
 * the regularly-hosts question. Eligibility shows live -- eligible routes to the first
 * annual assessment; ineligible is a note, never a determination.
 */

import { useState } from 'react';
import { L } from '../../../components/L';
import { registerVenueAction } from '../../actions';
import {
  RECURRING_VENUE_MIN_CAPACITY,
  VENUE_CAPACITY_FIELD,
  VENUE_ELIGIBILITY_QUESTIONS,
  type EligibilityQuestion,
} from '../../../lib/rules';

interface Field {
  key: string;
  en: string;
  ar: string;
  bilingual?: boolean;
}

const inputStyle: React.CSSProperties = {
  height: 44,
  paddingInline: 14,
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

function QuestionLabel({ q }: { q: EligibilityQuestion }) {
  return (
    <span style={{ fontSize: '14.5px' }}>
      <L en={q.en} ar={q.ar} />
      {q.issue !== 'both' ? (
        <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '0 6px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', verticalAlign: 'middle' }}>
          {q.issue === 'en-only' ? (
            <L en="English issue only" ar="الإصدار الإنكليزي فقط" />
          ) : (
            <L en="Arabic issue only" ar="الإصدار العربي فقط" />
          )}
        </span>
      ) : null}
    </span>
  );
}

export function RegisterVenueForm({ fields }: { fields: Field[] }) {
  const [capacity, setCapacity] = useState('');
  const [regular, setRegular] = useState(false);
  const [nightclub, setNightclub] = useState(false);
  const capNumber = Number(capacity.replace(/[^0-9]/g, '')) || 0;
  const eligible = capNumber >= RECURRING_VENUE_MIN_CAPACITY && regular;

  return (
    <form action={registerVenueAction}>
      <div data-region="registration-form" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, marginBlockEnd: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
          {fields.flatMap((f) => {
            const base = (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en={f.en} ar={f.ar} />
                </span>
                <input name={f.key} required={f.key !== 'contact'} style={inputStyle} />
              </label>
            );
            if (!f.bilingual) return [base];
            return [
              base,
              <label key={`${f.key}Ar`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en={`${f.en} (Arabic)`} ar={`${f.ar} (بالعربية)`} />
                </span>
                <input name={`${f.key}Ar`} dir="rtl" required={true} style={inputStyle} />
              </label>,
            ];
          })}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
              <L en={VENUE_CAPACITY_FIELD.en} ar={VENUE_CAPACITY_FIELD.ar} />
            </span>
            <input
              name="capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
              style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingBlockStart: 20, borderBlockStart: '1px solid var(--line)' }}>
          <QuestionLabel q={VENUE_ELIGIBILITY_QUESTIONS.regularlyHosts} />
          <button
            type="button"
            aria-pressed={regular}
            onClick={() => setRegular((v) => !v)}
            style={{ height: 36, paddingInline: 18, border: `1px solid ${regular ? 'var(--brand)' : 'var(--line)'}`, background: regular ? 'var(--brand-soft)' : 'var(--bg)', color: regular ? 'var(--brand)' : 'var(--ink)', borderRadius: 18, fontSize: 14, cursor: 'pointer' }}
          >
            {regular ? <L en="Yes" ar="نعم" /> : <L en="No" ar="لا" />}
          </button>
          <input type="hidden" name="regularlyHosts" value={regular ? 'yes' : 'no'} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingBlockStart: 16 }}>
          <QuestionLabel q={VENUE_ELIGIBILITY_QUESTIONS.nightclub} />
          <button
            type="button"
            aria-pressed={nightclub}
            onClick={() => setNightclub((v) => !v)}
            style={{ height: 36, paddingInline: 18, border: `1px solid ${nightclub ? 'var(--brand)' : 'var(--line)'}`, background: nightclub ? 'var(--brand-soft)' : 'var(--bg)', color: nightclub ? 'var(--brand)' : 'var(--ink)', borderRadius: 18, fontSize: 14, cursor: 'pointer' }}
          >
            {nightclub ? <L en="Yes" ar="نعم" /> : <L en="No" ar="لا" />}
          </button>
          <input type="hidden" name="isNightclub" value={nightclub ? 'yes' : 'no'} />
        </div>
      </div>

      {eligible ? (
        <div style={{ padding: '26px 30px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 14, marginBlockEnd: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 10 }}>
            <L en="This venue completes the annual assessment." ar="يستكمل هذا الموقع التقييم السنوي." />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--muted)', marginBlockEnd: 16 }}>
            <L
              en="The assessment records an effective date and an expiry date. Assess one routine operating session under the risk assessment. The classification runs for twelve months from the date it is recorded."
              ar="يُحدَّد في التقييم تاريخ بدء سريانه وتاريخ انتهاء صلاحيته. قيّموا فترة تشغيل اعتيادية واحدة وفق التقييم الوطني للمخاطر. يسري التصنيف اثني عشر شهراً من تاريخ تسجيله."
            />
          </div>
          <button
            type="submit"
            style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <L en="Open the annual assessment" ar="فتح التقييم السنوي" />
          </button>
        </div>
      ) : (
        <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 14 }}>
          <div style={{ fontSize: 16, lineHeight: 1.65, marginBlockEnd: 12 }}>
            <L
              en="On these details the venue falls outside the annual assessment. The Ministry determines applicability where it is uncertain, so this is not a determination that the venue is outside the process."
              ar="بحسب هذه المعطيات يقع الموقع خارج التقييم السنوي. تتخذ الوزارة القرار النهائي عند عدم اليقين بالانطباق، ولذلك لا يُعتبر هذا قراراً بأن الموقع خارج الآلية."
            />
          </div>
          <a href="/notifications" style={{ fontSize: 15, borderBlockEnd: '1px solid var(--brand)', paddingBlockEnd: 2 }}>
            <L en="Contact the Ministry about applicability" ar="مراسلة الوزارة بشأن الانطباق" />
          </a>
        </div>
      )}
    </form>
  );
}
