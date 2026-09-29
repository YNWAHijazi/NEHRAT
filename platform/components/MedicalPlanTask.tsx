import Link from 'next/link';
import { L } from './L';
import { addedMeasuresFor, planFor } from '../lib/queries';
import { planRequirement } from '../lib/rules/plan-responsibility';
import { planIsComplete, type Level } from '../lib/rules';

/** Render only after the route confirms this medical party's event access. */
export function MedicalPlanTask({ eventId, ownerId, level }: { eventId: string; ownerId: number; level: Level | null }) {
  const requirement = planRequirement(level, addedMeasuresFor(eventId).some(m => m.catalogKey === 'plan' && !m.clearedAt));
  if (requirement === 'notRequired') return null;
  const plan = planFor(ownerId, eventId);
  const complete = level !== null && planIsComplete(plan, level);
  return <section data-region="medical-plan-task" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBlockEnd: 24 }}>
    <div><h3 style={{ margin: '0 0 8px', fontSize: 18 }}><L en="Shared medical plan" ar="الخطة الطبية المشتركة" /></h3>
      <L en={requirement === 'required' ? 'Required' : 'Recommended — not required to submit'} ar={requirement === 'required' ? 'مطلوبة' : 'موصى بها — ليست شرطاً للتقديم'} />
      <span style={{ display: 'block', marginBlockStart: 6, color: complete ? 'var(--brand)' : 'var(--muted)' }}><L en={complete ? 'All sections provided' : plan ? 'In progress' : 'Not started'} ar={complete ? 'جميع الأقسام مقدّمة' : plan ? 'قيد الإعداد' : 'لم تبدأ بعد'} /></span>
    </div>
    <Link href={`/events/${eventId}/plan`} className="requirement-action"><L en="Open shared medical plan" ar="فتح الخطة الطبية المشتركة" /></Link>
  </section>;
}
