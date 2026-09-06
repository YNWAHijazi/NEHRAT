'use client';

/**
 * The registration card: the identity fields, the capacity, and the two questions
 * the assessment derives from -- then Submit (partner ruling, 2026-09-05). The
 * live eligibility verdict and its "outside the annual assessment / contact the
 * Ministry" outcome are gone: registering is not the place to refuse an operator.
 */

import { useState } from 'react';
import { L } from '../../../components/L';
import { YesNoPair } from '../../../components/YesNoPair';
import { registerVenueAction } from '../../actions';
import {
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

      <button
        type="submit"
        style={{ height: 48, paddingInline: 26, border: 0, borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}
      >
        <L en="Submit" ar="إرسال" />
      </button>
    </form>
  );
}
