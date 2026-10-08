'use server';
import {randomBytes} from 'node:crypto';
import {redirect,notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {currentAccount} from '../../lib/auth';
import {getDb} from '../../lib/db';
import {venueInvitation,venueInvitations,venueAccountMayTake} from '../../lib/venue/collaboration';
import {venueInvitationState} from '../../lib/venue/briefing';
import {venuePackageFor,ensureVenuePackage} from '../../lib/venue/workspace';
import {sendLinkEmail} from '../../lib/email';
import {verifiedSignIn,validPhone} from '../../lib/email-verification';
import {checkPasswordPolicy,hashPassword,verifyPassword} from '../../lib/password';
import {forgetSignInFields,rememberSignInFields} from '../../lib/auth';
import {requirementApplies} from '../../lib/rules';
import {verbatimQuote} from '../../lib/rules/verbatim';
export async function inviteVenuePartnerAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w)notFound();
 const kind=String(form.get('kind'));const row=kind==='director'?'B3':'B7';const back=(q='')=>`/venues/${id}?${q}${q?'&':''}step=${row}#req-${row}`;
 if(!w.editable||!w.level)redirect(back());
 const name=String(form.get('name')??'').trim(),email=String(form.get('email')??'').trim().toLowerCase();
 if(!['ems','director'].includes(kind)||!name||!/^\S+@\S+\.\S+$/.test(email))redirect(back('invite=details'));
 // The Director is a Level 3 role (decision D1): below it there is no Director to invite.
 if(kind==='director'&&!requirementApplies('B3',w.level,'venue'))redirect(`/venues/${id}?step=B7#req-B7`);
 if(venueInvitations(id).some(i=>['nominated','confirmed'].includes(i.status)&&(i.kind===kind&&(i.email===email||kind==='director'))))redirect(back('invite=duplicate'));
 const token=randomBytes(24).toString('hex');const db=getDb();
 db.prepare('INSERT INTO venue_invitations(token,venue_id,kind,name,email,expires_at) VALUES(?,?,?,?,?,?)').run(token,id,kind,name,email,new Date(Date.now()+30*86400000).toISOString());
 ensureVenuePackage(a.id,id);
 db.prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);
 db.prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
 const recipient=db.prepare('SELECT id FROM accounts WHERE email=? AND role=? AND is_demo=? AND suspended=0').get(email,kind,+a.isDemo) as {id:number}|undefined;
 if(recipient)db.prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,'needs_action',?,?,?,?,?,now_stamp(),?)").run(recipient.id,`Venue invitation: ${id}`,`دعوة لموقع: ${id}`,`Review your invitation for ${w.venue.nameEn}`,`راجعوا الدعوة للموقع ${w.venue.nameAr}`,`/venue-invitations/${token}`,+a.isDemo);
 const delivery=await sendLinkEmail({to:email,path:`/venue-invitations/${token}`,subject:`Venue medical team invitation: ${id}`,text:`You are invited to support ${w.venue.nameEn}. Review the venue and your tasks, then sign in or create an account to accept.\nدُعيتم للمشاركة في الفريق الطبي للموقع. راجعوا التفاصيل ثم سجّلوا الدخول أو أنشئوا حساباً للقبول.`,isDemo:a.isDemo});
 db.prepare('UPDATE venue_invitations SET delivery=? WHERE token=?').run(delivery,token);
 revalidatePath(`/venues/${id}`,'layout');revalidatePath('/dashboard');redirect(back(`invited=${kind}&mail=${delivery}`));
}
export async function withdrawVenuePartnerAction(id:string,token:string) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w?.editable)notFound();
 const inv=venueInvitation(token);if(!inv||inv.venue_id!==id)notFound();
 getDb().prepare("UPDATE venue_invitations SET status='withdrawn',responded_at=now_stamp() WHERE token=?").run(token);
 getDb().prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);
 getDb().prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
 const row=inv.kind==='director'?'B3':'B7';
 revalidatePath(`/venues/${id}`,'layout');revalidatePath('/dashboard');redirect(`/venues/${id}?step=${row}#req-${row}`);
}
/** The row on the operator's record that names the party: the Director row, or the EMS row. */
const partyRow=(kind:'ems'|'director')=>kind==='director'?'B3':'B7';
const roleName=(kind:'ems'|'director')=>kind==='director'?{en:'Medical Director',ar:'المدير الطبي'}:{en:'EMS agency',ar:'جهة الإسعاف'};
function notifyOperator(venueId:string,kind:'needs_action'|'for_information',subjectEn:string,subjectAr:string,bodyEn:string,bodyAr:string,route:string) {
 const v=getDb().prepare('SELECT account_id,is_demo FROM venues WHERE id=?').get(venueId) as {account_id:number;is_demo:number}|undefined;if(!v)return;
 getDb().prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,?,?,?,?,?,?,now_stamp(),?)").run(v.account_id,kind,subjectEn,subjectAr,bodyEn,bodyAr,route,v.is_demo);
}
/**
 * The venue nomination response -- the SAME three answers as an event's (owner,
 * 8 October 2026), on the same terms. The token is the credential (rule 6): the holder
 * reads and answers this one invitation and sees no other venue. Accepting needs the
 * invited role's account under the invited email, on the venue's side of the
 * demonstration boundary; declining (with a reason) and asking a question do not, as
 * on an event. A decline is reported to the operator with the reason as written.
 */
export async function respondVenueInvitationAction(token:string,form:FormData) {
 const state=venueInvitationState(token);if(!state)notFound();const {inv}=state;
 const back=`/venue-invitations/${token}`;
 // A closed invitation -- answered, withdrawn, expired, or on a venue no longer in preparation -- accepts no response.
 if(!state.open)redirect(back);
 const a=await currentAccount();const db=getDb();
 const response=String(form.get('response')??'');
 // 'note' is the field name the earlier venue form used; links and forms in flight keep working.
 const reason=String(form.get('reason')??form.get('note')??'').trim();
 const role=roleName(inv.kind),row=partyRow(inv.kind),venueName=(db.prepare('SELECT name_en,name_ar FROM venues WHERE id=?').get(inv.venue_id) as {name_en:string;name_ar:string});
 const takes=Boolean(a&&venueAccountMayTake(a.id,token));
 if(response==='accept'){
  // Acceptance requires the nominee's account, as on an event.
  if(!a||a.role!==inv.kind)redirect(`${back}/account`);
  if(inv.account_id!==null&&inv.account_id!==a.id)redirect('/dashboard');
  if(!takes)redirect(`${back}/account?error=invited-email`);
  db.prepare("UPDATE venue_invitations SET status='confirmed',account_id=?,responded_at=now_stamp() WHERE token=?").run(a.id,token);
  db.prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(inv.venue_id);db.prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(inv.venue_id);
  notifyOperator(inv.venue_id,'for_information',`A named party has accepted — ${venueName.name_en}`,`قبل طرف مُسمّى — ${venueName.name_ar}`,`The nominated ${role.en} has accepted the nomination.`,`قبل ${role.ar} المُرشَّح الترشيح.`,`/venues/${inv.venue_id}?step=${row}#req-${row}`);
  revalidatePath(`/venues/${inv.venue_id}`,'layout');revalidatePath('/dashboard');
  // The linked nominee lands on its one page for the venue.
  redirect(`/venue-team/${inv.venue_id}?notice=accepted`);
 }
 if(response==='decline'){
  if(!reason)redirect(`${back}?error=reason`);
  db.prepare("UPDATE venue_invitations SET status='declined',account_id=COALESCE(?,account_id),note=?,responded_at=now_stamp() WHERE token=?").run(takes?a!.id:null,reason,token);
  // Declining is a change the operator must act on: another party has to be invited.
  notifyOperator(inv.venue_id,'needs_action',`A named party has declined — ${venueName.name_en}`,`اعتذر طرف مُسمّى — ${venueName.name_ar}`,
   `The nominated ${role.en} has declined. The reason, as written: “${verbatimQuote(reason)}”. Invite a replacement from the venue record.`,
   `اعتذر ${role.ar} المُرشَّح. والسبب كما كُتب: «${verbatimQuote(reason)}». ادعوا طرفاً بديلاً من سجل الموقع.`,
   `/venues/${inv.venue_id}?step=${row}#req-${row}`);
  revalidatePath(`/venues/${inv.venue_id}`,'layout');revalidatePath('/dashboard');redirect(`${back}?notice=declined`);
 }
 if(response==='modification'){
  if(!reason)redirect(`${back}?error=reason`);
  // Not an invitation state: the invitation stays open with the note attached.
  db.prepare('UPDATE venue_invitations SET note=?,account_id=COALESCE(?,account_id) WHERE token=?').run(reason,takes?a!.id:null,token);
  notifyOperator(inv.venue_id,'needs_action',`A named party requests a modification — ${venueName.name_en}`,`طلب طرف مُسمّى تعديلاً — ${venueName.name_ar}`,
   `The nominated party can serve the venue but not as described. The reason, as written: “${verbatimQuote(reason)}”. The nomination remains open.`,
   `يمكن للطرف المُرشَّح خدمة الموقع لكن ليس بالصيغة الموصوفة. والسبب كما كُتب: «${verbatimQuote(reason)}». ويبقى الترشيح قائماً.`,
   `/venues/${inv.venue_id}?step=${row}#req-${row}`);
  revalidatePath(`/venues/${inv.venue_id}`,'layout');redirect(`${back}?notice=modification`);
 }
 redirect(back);
}
/** Register against the venue invitation, then complete its acceptance -- as on an event. Existing users sign in instead. */
export async function createVenuePartnerAccountAction(token:string,form:FormData) {
 const state=venueInvitationState(token);if(!state)notFound();const {inv}=state;const account=`/venue-invitations/${token}/account`;
 if(inv.status==='withdrawn'||!state.editable)redirect(`/venue-invitations/${token}`);
 if(inv.account_id!==null)redirect(`/venue-team/${inv.venue_id}`);
 if(!state.open)redirect(`/venue-invitations/${token}`);
 const name=String(form.get('fullName')??form.get('name')??'').trim(),password=String(form.get('password')??''),phone=String(form.get('phone')??'').trim();
 if(!name||!validPhone(phone)||!checkPasswordPolicy(password).ok)redirect(`${account}?error=account`);
 const db=getDb();
 // Not an error to correct by choosing another email: the sign-in path is right there.
 if(db.prepare('SELECT id FROM accounts WHERE email=?').get(inv.email))redirect(`${account}?error=email-taken`);
 // The account is created under the address the operator named -- never one typed here.
 const result=db.prepare('INSERT INTO accounts(login,email,password_hash,display_name,initials,role,is_demo,phone) VALUES(?,?,?,?,?,?,?,?)').run(`user_${randomBytes(6).toString('hex')}`,inv.email,hashPassword(password),name,name.split(/\s+/).map(s=>s[0]??'').join('').slice(0,2).toUpperCase(),inv.kind,+state.isDemo,phone);
 const accountId=Number(result.lastInsertRowid);
 db.prepare('UPDATE venue_invitations SET account_id=? WHERE token=?').run(accountId,token);
 // OTP (when enabled) runs first and returns the holder to the invitation to accept.
 await verifiedSignIn(accountId,`/venue-invitations/${token}`);
 const acceptance=new FormData();acceptance.set('response','accept');
 await respondVenueInvitationAction(token,acceptance);
}
/** The other path: an account already exists, so link this invitation to it and accept. */
export async function signInVenuePartnerAction(token:string,form:FormData) {
 const state=venueInvitationState(token);if(!state)notFound();const {inv}=state;const account=`/venue-invitations/${token}/account`;
 if(inv.status==='withdrawn'||!state.editable)redirect(`/venue-invitations/${token}`);
 const email=String(form.get('email')??'').trim().toLowerCase(),password=String(form.get('password')??'');
 const row=getDb().prepare('SELECT id,password_hash,role,suspended FROM accounts WHERE email=?').get(email) as {id:number;password_hash:string|null;role:string;suspended:number}|undefined;
 // One refusal for every failure: a wrong password and an unknown address must not be distinguishable.
 if(!row||!row.password_hash||row.suspended===1||!verifyPassword(password,row.password_hash)){await rememberSignInFields({email});redirect(`${account}?error=credentials`);}
 // The invitation names a role, and the account carries one.
 if(row.role!==inv.kind)redirect(`${account}?error=role`);
 if(inv.account_id!==null&&inv.account_id!==row.id)redirect('/dashboard');
 if(!venueAccountMayTake(row.id,token)){await forgetSignInFields();redirect(`${account}?error=invited-email`);}
 await forgetSignInFields();
 await verifiedSignIn(row.id,`/venue-invitations/${token}`);
 if(inv.status==='nominated'&&state.open){const acceptance=new FormData();acceptance.set('response','accept');await respondVenueInvitationAction(token,acceptance);}
 redirect(inv.status==='confirmed'?`/venue-team/${inv.venue_id}?notice=linked`:`/venue-invitations/${token}`);
}
