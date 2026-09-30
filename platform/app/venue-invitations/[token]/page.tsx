import Link from 'next/link';
import {AUTH_POLICY} from '../../../lib/rules';
import {notFound} from 'next/navigation';
import {venueInvitation} from '../../../lib/venue/collaboration';
import {venuePackageFor} from '../../../lib/venue/workspace';
import {getDb} from '../../../lib/db';
import {currentAccount} from '../../../lib/auth';
import {GovernmentBand,Header} from '../../../components/Header';
import {L} from '../../../components/L';
import {respondVenueInvitationAction,createVenuePartnerAccountAction} from '../../venues/team-actions';
export default async function Invitation({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{error?:string}>}) {
 const {token}=await params,inv=venueInvitation(token);if(!inv)notFound();const a=await currentAccount(),q=await searchParams;
 const owner=getDb().prepare('SELECT account_id FROM venues WHERE id=?').get(inv.venue_id) as {account_id:number};const w=venuePackageFor(owner.account_id,inv.venue_id)!;
 const live=(inv.status==='nominated'&&new Date(inv.expires_at).getTime()>Date.now()||inv.status==='confirmed')&&!w.venue.archivedAt;
 const path=`/venue-invitations/${token}`;
 const contact=a?getDb().prepare('SELECT email,phone FROM accounts WHERE id=?').get(a.id) as {email:string;phone:string}:null;
 const mine=a&&a.role===inv.kind&&contact?.email?.toLowerCase()===inv.email;
 const input:React.CSSProperties={display:'block',width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:8,marginBlock:'6px 16px'};
 return <><GovernmentBand/><Header account={a} organization={null} unreadCount={0} showBack={Boolean(a)}/><main data-pad="" style={{maxWidth:900,marginInline:'auto',padding:'44px 32px 120px'}}><h1><L en="Venue medical team invitation" ar="دعوة إلى الفريق الطبي للموقع"/></h1>
 {!live?<p><L en="This invitation is closed or expired. Contact the organizer for a new invitation." ar="هذه الدعوة مغلقة أو منتهية. تواصلوا مع المنظّم للحصول على دعوة جديدة."/></p>:<><h2>{w.venue.nameEn} · {w.venue.nameAr}</h2><p>{inv.venue_id} · <L en={`Level ${w.level??'—'}`} ar={`المستوى ${w.level??'—'}`}/></p><p>{w.venue.addressMunicipalityEn} · {w.district}</p><p><L en={inv.kind==='director'?'You are invited as Medical Director. Review the medical arrangements and approve the Level 3 plan.':'Your EMS agency is invited to confirm its staff, equipment and medical arrangements.'} ar={inv.kind==='director'?'أنتم مدعوّون بصفتكم مديراً طبياً. راجعوا الترتيبات الطبية واعتمدوا خطة المستوى الثالث.':'جهة الإسعاف مدعوّة لتأكيد طاقمها ومعدّاتها وترتيباتها الطبية.'}/></p>
 {q.error?<p role="alert"><L en={q.error==='account'?'Sign in with the invited email and role.':q.error==='existing'?'An account already uses this email. Sign in below.':'Check your details. Use a valid phone number and a strong password.'} ar={q.error==='account'?'سجّلوا الدخول بالبريد والدور المدعوّين.':q.error==='existing'?'يوجد حساب بهذا البريد. سجّلوا الدخول أدناه.':'تحقّقوا من البيانات. استخدموا رقم هاتف صالحاً وكلمة مرور قوية.'}/></p>:null}
 {mine&&inv.status==='confirmed'?<Link href={`/venue-team/${inv.venue_id}`}><L en="Open venue requirements" ar="فتح متطلبات الموقع"/></Link>:null}
 {mine&&inv.status==='nominated'&&w.editable?<form action={respondVenueInvitationAction.bind(null,token)}><label><L en="Phone number (include country code)" ar="رقم الهاتف (مع رمز البلد)"/><input name="phone" type="tel" defaultValue={contact?.phone??''} style={input}/></label>{inv.kind==='director'?<label><L en="Medical licence number" ar="رقم ترخيص الطبيب"/><input name="licence" style={input}/></label>:null}<label><L en="Reason if declining" ar="سبب الاعتذار"/><textarea name="note" style={input}/></label><div style={{display:'flex',gap:16}}><button name="response" value="accept"><L en="Accept invitation" ar="قبول الدعوة"/></button><button name="response" value="decline"><L en="Decline invitation" ar="رفض الدعوة"/></button></div></form>:null}
 {!mine?<><p><Link href={`/signin?next=${encodeURIComponent(path)}`}><L en="Sign in with the invited email" ar="تسجيل الدخول بالبريد المدعوّ"/></Link> · {inv.email}</p>{!a&&inv.status==='nominated'&&w.editable?<details><summary><L en="Create an account" ar="إنشاء حساب"/></summary><form action={createVenuePartnerAccountAction.bind(null,token)}><label><L en="Full name" ar="الاسم الكامل"/><input name="name" autoComplete="name" required style={input}/></label><label><L en="Phone number (include country code)" ar="رقم الهاتف (مع رمز البلد)"/><input name="phone" type="tel" autoComplete="tel" required style={input}/></label><label><L en="Password" ar="كلمة المرور"/><input name="password" type="password" autoComplete="new-password" required minLength={AUTH_POLICY.password.minLength} style={input}/></label><p><L en={`Use at least ${AUTH_POLICY.password.minLength} characters.`} ar={`استخدموا ${AUTH_POLICY.password.minLength} محارف على الأقل.`}/></p><button><L en="Create account" ar="إنشاء حساب"/></button></form></details>:null}</>:null}</>}</main></>;
}
