import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AUTH_POLICY } from '../../../lib/rules';
import { venueInvitation } from '../../../lib/venue/collaboration';
import { venueDistrictLabel } from '../../../lib/rules/venue-intake';
import { venuePackageFor } from '../../../lib/venue/workspace';
import { getDb } from '../../../lib/db';
import { currentAccount } from '../../../lib/auth';
import { GovernmentBand, Header } from '../../../components/Header';
import { RecordHeader } from '../../../components/RecordHeader';
import { L } from '../../../components/L';
import { alertBand, noticeBand, fieldInput, primaryButton, secondaryButton } from '../../../components/workspace-styles';
import { respondVenueInvitationAction, createVenuePartnerAccountAction } from '../../venues/team-actions';

const label: React.CSSProperties = { display: 'grid', gap: 6, marginBlockEnd: 16 };
const labelText: React.CSSProperties = { fontSize: 13, color: 'var(--muted)' };
const card: React.CSSProperties = { padding: '22px 24px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg)' };

/** The page an invited EMS agency or Medical Director opens: who invited them to what, then one way forward. */
export default async function VenueInvitation({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const inv = venueInvitation(token);
  if (!inv) notFound();
  const a = await currentAccount();
  const q = await searchParams;
  const owner = getDb().prepare('SELECT account_id FROM venues WHERE id = ?').get(inv.venue_id) as { account_id: number };
  const w = venuePackageFor(owner.account_id, inv.venue_id)!;
  const live = ((inv.status === 'nominated' && new Date(inv.expires_at).getTime() > Date.now()) || inv.status === 'confirmed') && !w.venue.archivedAt;
  const path = `/venue-invitations/${token}`;
  const contact = a ? (getDb().prepare('SELECT email, phone FROM accounts WHERE id = ?').get(a.id) as { email: string; phone: string }) : null;
  const mine = Boolean(a && a.role === inv.kind && contact?.email?.toLowerCase() === inv.email);
  const director = inv.kind === 'director';

  return (
    <>
      <GovernmentBand />
      <Header account={a} organization={null} unreadCount={0} showBack={Boolean(a)} />
      <main data-pad="" style={{ maxWidth: 960, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBlockEnd: 14 }}>
          <L en="Venue medical team invitation" ar="دعوة إلى الفريق الطبي للموقع" />
        </div>
        <RecordHeader
          facts={[
            { en: 'Record ID', ar: 'معرّف السجل', value: inv.venue_id, strong: true },
            { en: 'Invited as', ar: 'مدعوّ بصفة', value: <L en={director ? 'Medical Director' : 'EMS agency'} ar={director ? 'المدير الطبي' : 'جهة الإسعاف'} /> },
          ]}
          nameEn={w.venue.nameEn}
          nameAr={w.venue.nameAr}
          stats={[{ en: 'Level', ar: 'المستوى', value: w.level ?? '—', valueStyle: { color: w.level ? `var(--l${w.level})` : 'var(--muted)' } }]}
        />

        {!live ? (
          <div role="status" style={noticeBand}>
            <L en="This invitation is closed or expired. Contact the organizer for a new invitation." ar="هذه الدعوة مغلقة أو منتهية. تواصلوا مع المنظّم للحصول على دعوة جديدة." />
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.65, maxWidth: '70ch' }}>
              <L
                en={director ? 'You are invited as Medical Director. Review the medical arrangements and approve the Level 3 plan.' : 'Your EMS agency is invited to confirm its staff, equipment and medical arrangements.'}
                ar={director ? 'أنتم مدعوّون بصفتكم مديراً طبياً. راجعوا الترتيبات الطبية واعتمدوا خطة المستوى الثالث.' : 'جهة الإسعاف مدعوّة لتأكيد طاقمها ومعدّاتها وترتيباتها الطبية.'}
              />
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 14, marginBlockStart: 6 }}>
                <L en={w.venue.addressMunicipalityEn} ar={w.venue.addressMunicipalityAr || w.venue.addressMunicipalityEn} />{w.district ? <> · <L en={venueDistrictLabel(w.district).en} ar={venueDistrictLabel(w.district).ar} /></> : ''}
              </span>
            </p>

            {q.error ? (
              <div role="alert" style={alertBand}>
                <L
                  en={q.error === 'account' ? 'Sign in with the invited email and role.' : q.error === 'existing' ? 'An account already uses this email. Sign in instead.' : 'Check your details. Use a valid phone number and a strong password.'}
                  ar={q.error === 'account' ? 'سجّلوا الدخول بالبريد والدور المدعوّين.' : q.error === 'existing' ? 'يوجد حساب بهذا البريد. سجّلوا الدخول بدلاً من ذلك.' : 'تحقّقوا من البيانات. استخدموا رقم هاتف صالحاً وكلمة مرور قوية.'}
                />
              </div>
            ) : null}

            {mine && inv.status === 'confirmed' ? (
              <Link href={`/venue-team/${inv.venue_id}`} style={primaryButton}><L en="Open venue requirements" ar="فتح متطلبات الموقع" /></Link>
            ) : null}

            {mine && inv.status === 'nominated' && w.editable ? (
              <form action={respondVenueInvitationAction.bind(null, token)} style={{ ...card, maxWidth: 560 }}>
                <label style={label}>
                  <span style={labelText}><L en="Phone number (include country code)" ar="رقم الهاتف (مع رمز البلد)" /></span>
                  <input name="phone" type="tel" defaultValue={contact?.phone ?? ''} style={fieldInput} />
                </label>
                {director ? (
                  <label style={label}>
                    <span style={labelText}><L en="Medical licence number" ar="رقم ترخيص الطبيب" /></span>
                    <input name="licence" style={fieldInput} />
                  </label>
                ) : null}
                <label style={label}>
                  <span style={labelText}><L en="Reason if declining" ar="سبب الاعتذار" /></span>
                  <textarea name="note" rows={3} style={fieldInput} />
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button name="response" value="accept" style={primaryButton}><L en="Accept invitation" ar="قبول الدعوة" /></button>
                  <button name="response" value="decline" style={secondaryButton}><L en="Decline invitation" ar="الاعتذار عن الدعوة" /></button>
                </div>
              </form>
            ) : null}

            {!mine ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16, alignItems: 'start' }}>
                <div style={card}>
                  <div style={{ fontSize: 17, fontWeight: 600, marginBlockEnd: 8 }}><L en="Already have an account?" ar="لديكم حساب؟" /></div>
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
                    <L en="Sign in with the invited email:" ar="سجّلوا الدخول بالبريد المدعوّ:" /> <bdi>{inv.email}</bdi>
                  </p>
                  <Link href={`/signin?next=${encodeURIComponent(path)}`} style={secondaryButton}><L en="Sign in with the invited email" ar="تسجيل الدخول بالبريد المدعوّ" /></Link>
                </div>
                {!a && inv.status === 'nominated' && w.editable ? (
                  <form action={createVenuePartnerAccountAction.bind(null, token)} style={card}>
                    <div style={{ fontSize: 17, fontWeight: 600, marginBlockEnd: 14 }}><L en="Create an account" ar="إنشاء حساب" /></div>
                    <label style={label}>
                      <span style={labelText}><L en="Full name" ar="الاسم الكامل" /></span>
                      <input name="name" autoComplete="name" required style={fieldInput} />
                    </label>
                    <label style={label}>
                      <span style={labelText}><L en="Phone number (include country code)" ar="رقم الهاتف (مع رمز البلد)" /></span>
                      <input name="phone" type="tel" autoComplete="tel" required style={fieldInput} />
                    </label>
                    <label style={label}>
                      <span style={labelText}><L en={`Password (at least ${AUTH_POLICY.password.minLength} characters)`} ar={`كلمة المرور (${AUTH_POLICY.password.minLength} محارف على الأقل)`} /></span>
                      <input name="password" type="password" autoComplete="new-password" required minLength={AUTH_POLICY.password.minLength} style={fieldInput} />
                    </label>
                    <button style={primaryButton}><L en="Create account" ar="إنشاء حساب" /></button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
