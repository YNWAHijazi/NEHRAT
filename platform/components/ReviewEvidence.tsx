import { L } from './L';
import { InfoNote } from './InfoNote';
import { DECLARATION_ITEMS, ROLES_CONTENT, type Level } from '../lib/rules';
import type { reviewEvidenceFor } from '../lib/review-evidence';

type Evidence = NonNullable<ReturnType<typeof reviewEvidenceFor>>;
const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBlockEnd: 24, scrollMarginBlockStart: 24 };
const answer: React.CSSProperties = { margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 18 };
const states = { nominated: ['Invitation pending', 'الدعوة قيد الانتظار'], confirmed: ['Confirmed', 'مؤكّد'], declined: ['Declined', 'مرفوض'], removed: ['Removed', 'تمت الإزالة'], withdrawn: ['Withdrawn', 'مسحوب'] } as const;

function Value({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || String(value).trim() === '') return <L en="Not provided" ar="غير مقدّم" />;
  // Counts read with separators (25,000), as they do on the invitation and the organizer's screens.
  return <>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</>;
}

export function ReviewFileSummary({ evidence }: { evidence: Evidence }) {
  const e = evidence.event;
  const facts = [
    ['Event dates', 'تواريخ الفعالية', [e.start_date, e.end_date].filter(Boolean).join(' — ')],
    ['Opening and closing time', 'وقت الافتتاح والإقفال', [e.opening_time, e.closing_time].filter(Boolean).join(' — ')],
    ['Venue or route', 'الموقع أو المسار', e.venue_route], ['Municipalities', 'البلديات', e.municipalities],
    ['Participants', 'المشاركون', e.expected_participants], ['Spectators', 'الجمهور', e.expected_spectators],
    ['Staff and volunteers', 'الموظفون والمتطوعون', e.expected_staff],
    ['Organizer contact', 'جهة اتصال المنظّم', evidence.compliance?.representative],
    ['Telephone', 'الهاتف', evidence.compliance?.telephone],
  ] as const;
  return <section id="review-file" data-region="review-file-summary" style={panel}>
    <h2 style={{ fontSize: 20, marginBlockStart: 0 }}><L en="Application at a glance" ar="ملخص الطلب" /></h2>
    <dl style={grid}>{facts.map(([en, ar, value]) => <div key={en}><dt style={{ color: 'var(--muted)', fontSize: 13 }}><L en={en} ar={ar} /></dt><dd style={answer}><Value value={value} /></dd></div>)}</dl>
    <details data-region="review-document-checklist">
      <summary><L en="Required and optional documents" ar="المستندات المطلوبة والاختيارية" /></summary>
      <div style={{ marginBlockStart: 12 }}>
        {evidence.documents.map(d => <div key={d.key} data-review-document={d.key} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingBlock: 12, borderBlockStart: '1px solid var(--line)' }}>
          <span><L en={d.en} ar={d.ar} /></span>
          <span style={{ color: d.complete ? 'var(--brand)' : d.optional ? 'var(--muted)' : 'var(--accent-ink)' }}>
            <L en={d.optional ? (d.key === 'plan' ? 'Recommended' : 'Optional') : 'Required'} ar={d.optional ? (d.key === 'plan' ? 'موصى به' : 'اختياري') : 'مطلوب'} /> · <L en={d.complete ? 'Provided' : 'Not provided'} ar={d.complete ? 'مقدّم' : 'غير مقدّم'} />
          </span>
        </div>)}
      </div>
    </details>
    {evidence.compliance && <details data-region="review-organizer-declarations" style={{ marginBlockStart: 18 }}>
      <summary><L en="Organizer’s declarations" ar="إقرارات المنظّم" /></summary>
      <p><Value value={evidence.compliance.representative} /> · <Value value={evidence.compliance.position} /></p>
      {evidence.compliance.declarations.map((d, index) => <div key={index} style={{ paddingBlock: 10, borderBlockStart: '1px solid var(--line)' }}><L en={d.en} ar={d.ar} /> — <L en={d.declared ? 'Confirmed by organizer' : 'Not confirmed'} ar={d.declared ? 'أكّده المنظّم' : 'غير مؤكّد'} /></div>)}
    </details>}
  </section>;
}

export function ReviewMedicalAnswers({ evidence, level }: { evidence: Evidence; level: Level | null }) {
  return <section id="review-medical-team" data-region="review-medical-answers" style={panel}>
    <h2 style={{ fontSize: 20, marginBlockStart: 0 }}><L en="Medical team answers" ar="إجابات الفريق الطبي" /><InfoNote><L en="Saved answers and signed declarations are shown here. Check their content before recording a decision." ar="تظهر هنا الإجابات المحفوظة والإقرارات الموقّعة. راجعوا محتواها قبل تسجيل القرار." /></InfoNote></h2>
    {evidence.parties.length === 0 && <p><L en="No medical team has been named." ar="لم يُسمَّ فريق طبي بعد." /></p>}
    {evidence.parties.map((p, index) => <details key={index} data-review-party={p.kind} style={{ borderBlockStart: '1px solid var(--line)', paddingBlock: 16 }}>
      <summary style={{ cursor: 'pointer', overflowWrap: 'anywhere' }}><L en={p.nameEn} ar={p.nameAr} /> · <L en={p.kind === 'ems' ? 'EMS agency' : 'Medical Director'} ar={p.kind === 'ems' ? 'جهة إسعاف' : 'المدير الطبي'} /> · <L en={states[p.status][0]} ar={states[p.status][1]} /></summary>
      <p>{p.email}</p>
      {p.responseNote && <p style={{ whiteSpace: 'pre-wrap' }}>{p.responseNote}</p>}
      {p.kind === 'ems' && Object.values(p.opsDetail).some(v => v.trim()) && <dl style={grid}>
        {ROLES_CONTENT.ems.level2Fields.map(f => <div key={f.key}><dt style={{ fontSize: 13, color: 'var(--muted)' }}><L en={f.en} ar={f.ar} /></dt><dd style={answer}><Value value={p.opsDetail[f.key]} /></dd></div>)}
      </dl>}
      {p.kind === 'ems' && level !== 3 && !Object.values(p.opsDetail).some(v => v.trim()) && <p><L en="No operational details have been shared." ar="لم تُشارك تفاصيل تشغيلية بعد." /></p>}
      {p.kind === 'ems' && level === 3 && <div data-region="review-agency-declaration">
        <h3 style={{ fontSize: 16 }}><L en="EMS readiness declaration" ar="إقرار جاهزية الإسعاف" /> — <L en={p.declaration === 'signed' ? 'Signed' : 'Not submitted'} ar={p.declaration === 'signed' ? 'موقّع' : 'غير مقدّم'} /></h3>
        {p.declaration === 'signed' && <><p>{p.signedAt}</p><dl style={grid}>{ROLES_CONTENT.ems.certificationFields.map(f => <div key={f.key}><dt><L en={f.en} ar={f.ar} /></dt><dd style={answer}><Value value={p.certification[f.key]} /></dd></div>)}</dl>
          {DECLARATION_ITEMS.map((item, i) => <p key={i}><L en={item.en} ar={item.ar} /> — <L en={p.declarationItems[i] ? 'Confirmed by agency' : 'Not confirmed'} ar={p.declarationItems[i] ? 'أكّدته الجهة' : 'غير مؤكّد'} /></p>)}</>}
      </div>}
    </details>)}
    {level === 3 && <details data-region="review-director-arrangements" style={{ paddingBlockStart: 16, borderBlockStart: '1px solid var(--line)' }}><summary><L en="Medical Director’s arrangements" ar="ترتيبات المدير الطبي" /></summary><dl>{ROLES_CONTENT.director.govSections.map(s => <div key={s.key} style={{ marginBlock: 16 }}><dt style={{ fontWeight: 600 }}><L en={'readerEn' in s ? s.readerEn : s.en} ar={'readerAr' in s ? s.readerAr : s.ar} /></dt><dd style={answer}><Value value={evidence.governance[s.key]} /></dd></div>)}</dl></details>}
  </section>;
}
