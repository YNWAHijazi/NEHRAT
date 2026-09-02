'use client';

/**
 * The registration card, from the reference: the five identity fields, the capacity,
 * the regularly-hosts question. Eligibility shows live -- eligible routes to the first
 * annual assessment; ineligible is a note, never a determination.
 */

import { useState } from 'react';
import { L } from '../../../components/L';
import { YesNoPair } from '../../../components/YesNoPair';
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

/* The issue tags ("English issue only") left the labels (partner ruling, second
   sweep): English governs, the ruling is made, and a form should not teach the
   reader the two issues of the regulation. The tags stay in the data. */
function QuestionLabel({ q }: { q: EligibilityQuestion }) {
  return (
    <span style={{ fontSize: '14.5px' }}>
      <L en={q.en} ar={q.ar} />
    </span>
  );
}

export function RegisterVenueForm({ fields }: { fields: Field[] }) {
  const [capacity, setCapacity] = useState('');
  const [regular, setRegular] = useState<boolean | null>(null);
  const [nightclub, setNightclub] = useState<boolean | null>(null);
  const capNumber = Number(capacity.replace(/[^0-9]/g, '')) || 0;
  const eligible = capNumber >= RECURRING_VENUE_MIN_CAPACITY && regular === true;
  // The outside-the-process note is a statement about the details given; until the
  // determining facts are answered there is nothing to state (rule 0's spirit: an
  // unset input is not a determination).
  const answered = capacity.trim() !== '' && regular !== null;

  return (
    <form action={registerVenueAction}>
      <div data-region="registration-form" style={{ padding: 29, background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBlockEnd: 20 }}>
          {fields.flatMap((f) => {
            const base = (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                  <L en={f.en} ar={f.ar} />
                  {f.key === 'contact' ? (
                    <span style={{ marginInlineStart: 6 }}>
                      <L en="(optional)" ar="(اختياري)" />
                    </span>
                  ) : null}
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
          <YesNoPair value={regular} onPick={setRegular} />
          {regular !== null ? <input type="hidden" name="regularlyHosts" value={regular ? 'yes' : 'no'} /> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingBlockStart: 16 }}>
          <QuestionLabel q={VENUE_ELIGIBILITY_QUESTIONS.nightclub} />
          <YesNoPair value={nightclub} onPick={setNightclub} />
          {nightclub !== null ? <input type="hidden" name="isNightclub" value={nightclub ? 'yes' : 'no'} /> : null}
        </div>
      </div>

      {!eligible && !answered ? null : eligible ? (
        <div style={{ padding: '26px 30px', border: '1px solid var(--brand)', background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, marginBlockEnd: 10 }}>
            <L en="This venue completes the annual assessment." ar="يستكمل هذا الموقع التقييم السنوي." />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--muted)', marginBlockEnd: 16 }}>
            <L
              en="The assessment covers one routine operating session and stands for twelve months."
              ar="يشمل التقييم فترة تشغيل اعتيادية واحدة ويسري اثني عشر شهراً."
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
        <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16 }}>
          <div style={{ fontSize: 16, lineHeight: 1.65, marginBlockEnd: 12 }}>
            <L
              en="On these details the venue is outside the annual assessment. Where that is uncertain, the Ministry decides."
              ar="بحسب هذه المعطيات يقع الموقع خارج التقييم السنوي. وعند عدم اليقين، تقرر الوزارة."
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
