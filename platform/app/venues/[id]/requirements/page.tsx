import Link from 'next/link';
import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { VenueRequirementList, VenueLinkedTeam } from '../../../../components/VenueRequirementList';
import { SectionHeading } from '../../../../components/SectionHeading';
import { L } from '../../../../components/L';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { alertBand, noticeBand } from '../../../../components/workspace-styles';

/** The venue's requirements in the event's shape: a title, the sections to jump to, the numbered sections, then review. */
export default async function VenueRequirements({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { account, w } = await ownedVenuePage(id);
  const q = await searchParams;
  const groups = [
    { key: 'organizer', en: 'Your requirements', ar: 'متطلباتكم', count: w.requirements.filter((r) => !r.optional && !r.clinical).length },
    { key: 'medical', en: 'Medical team requirements', ar: 'متطلبات الفريق الطبي', count: w.requirements.filter((r) => !r.optional && r.clinical).length },
    { key: 'optional', en: 'Recommended (optional)', ar: 'موصى به (اختياري)', count: w.requirements.filter((r) => r.optional).length },
  ].filter((g) => g.count > 0);

  return (
    <VenueWorkspace account={account} w={w} active="requirements">
      <h2 data-sec-h1="" style={{ margin: '0 0 14px', fontSize: 28 }}><L en="Requirements" ar="المتطلبات" /></h2>
      {q.error ? (
        <div role="alert" style={alertBand}>
          <L
            en={q.error === 'stale' ? 'This item changed while you were editing. Review the latest answers and try again.' : 'Complete the fields and attach a supported file, then try again.'}
            ar={q.error === 'stale' ? 'تغيّر هذا البند أثناء التعديل. راجعوا أحدث الإجابات وحاولوا مجدداً.' : 'أكملوا الحقول وأرفقوا ملفاً مدعوماً ثم حاولوا مجدداً.'}
          />
        </div>
      ) : null}
      {q.saved ? (
        <div role="status" style={noticeBand}><L en="Saved." ar="حُفظ." /></div>
      ) : null}

      {!w.assessmentDone ? (
        <div role="status" style={noticeBand}>
          <Link href={`/venues/${id}/assessment`}><L en="Complete the assessment to see your requirements." ar="أكملوا التقييم للاطلاع على المتطلبات." /></Link>
        </div>
      ) : (
        <>
          <p data-region="organizer-guidance" style={{ margin: '0 0 22px', color: 'var(--muted)', lineHeight: 1.6 }}>
            <L en="Complete your requirements. Your medical team completes theirs here. Review everything, then submit." ar="أكملوا متطلباتكم. يستكمل فريقكم الطبي متطلباته هنا. راجعوا الملف كاملاً ثم قدّموه." />
          </p>
          <nav data-region="preparation-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBlockEnd: 32 }}>
            {[
              ...groups.map((g, i) => ({ href: `#group-${g.key}`, en: `${i + 1}. ${g.en}`, ar: `${i + 1}. ${g.ar}` })),
              { href: `/venues/${id}/submit`, en: 'Submit', ar: 'تقديم الطلب' },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ padding: '12px 18px', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 14 }}>
                <L en={item.en} ar={item.ar} />
              </a>
            ))}
          </nav>

          <VenueLinkedTeam w={w} />
          <VenueRequirementList w={w} saved={q.saved} />

          <section id="review" data-region="review-submission" style={{ scrollMarginBlockStart: 24, padding: 24, background: 'var(--brand-soft)', borderRadius: 16, marginBlockEnd: 32 }}>
            <SectionHeading en="Review and submit" ar="المراجعة والتقديم" />
            <a href={`/venues/${id}/submit`} style={{ display: 'inline-flex', padding: '12px 20px', borderRadius: 24, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15 }}>
              <L en="Review submission" ar="مراجعة ملف التقديم" />
            </a>
          </section>
        </>
      )}
    </VenueWorkspace>
  );
}
