'use server';
import {randomBytes} from 'node:crypto';
import {redirect,notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {currentAccount} from '../../lib/auth';
import {getDb} from '../../lib/db';
import {venueInvitation,venueInvitations, invalidateVenueMedicalWork} from '../../lib/venue/collaboration';
import {venuePackageFor,ensureVenuePackage} from '../../lib/venue/workspace';
import {sendLinkEmail} from '../../lib/email';
import {verifiedSignIn,validPhone} from '../../lib/email-verification';
import {venueLocalEmsContactApplies} from '../../lib/rules/venue-workflow';
import {checkPasswordPolicy,hashPassword} from '../../lib/password';
export async function inviteVenuePartnerAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w)notFound();
 if(!w.editable||!w.level)redirect(`/venues/${id}/team`);
 const kind=String(form.get('kind')),name=String(form.get('name')??'').trim(),email=String(form.get('email')??'').trim().toLowerCase();
 if(!['ems','director'].includes(kind)||!name||!/^\S+@\S+\.\S+$/.test(email))redirect(`/venues/${id}/team?error=details`);
 // A Director applies from Level 2 (optional) and is required at Level 3; at Level 1 there is no Director to invite.
 if(kind==='director'&&w.level<2)redirect(`/venues/${id}/team`);
 if(venueInvitations(id).some(i=>['nominated','confirmed'].includes(i.status)&&(i.kind===kind&&(i.email===email||kind==='director'))))redirect(`/venues/${id}/team?error=duplicate`);
 const token=randomBytes(24).toString('hex');const db=getDb();
 db.prepare('INSERT INTO venue_invitations(token,venue_id,kind,name,email,expires_at) VALUES(?,?,?,?,?,?)').run(token,id,kind,name,email,new Date(Date.now()+30*86400000).toISOString());
 ensureVenuePackage(a.id,id);
 const answers=kind==='ems'&&w.level===1?{...w.answers,'7':{...w.answers['7'],localConfirmed:''}}:w.answers;
 db.prepare('UPDATE venue_packages SET answers=?,work_revision=work_revision+1 WHERE venue_id=?').run(JSON.stringify(answers),id);
 db.prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
 const recipient=db.prepare('SELECT id FROM accounts WHERE email=? AND role=? AND is_demo=? AND suspended=0').get(email,kind,+a.isDemo) as {id:number}|undefined;
 if(recipient)db.prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,'needs_action',?,?,?,?,?,now_stamp(),?)").run(recipient.id,`Venue invitation: ${id}`,`دعوة لموقع: ${id}`,`Review your invitation for ${w.venue.nameEn}`,`راجعوا الدعوة للموقع ${w.venue.nameAr}`,`/venue-invitations/${token}`,+a.isDemo);
 const delivery=await sendLinkEmail({to:email,path:`/venue-invitations/${token}`,subject:`Venue medical team invitation: ${id}`,text:`You are invited to support ${w.venue.nameEn}. Review the venue and your tasks, then sign in or create an account to accept.\nدُعيتم للمشاركة في الفريق الطبي للموقع. راجعوا التفاصيل ثم سجّلوا الدخول أو أنشئوا حساباً للقبول.`,isDemo:a.isDemo});
 db.prepare('UPDATE venue_invitations SET delivery=? WHERE token=?').run(delivery,token);
 revalidatePath(`/venues/${id}`,'layout');revalidatePath('/dashboard');redirect(`/venues/${id}/team?invited=yes`);
}
export async function withdrawVenuePartnerAction(id:string,token:string) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w?.editable)notFound();
 const inv=venueInvitation(token);if(!inv||inv.venue_id!==id)notFound();
 getDb().prepare("UPDATE venue_invitations SET status='withdrawn',responded_at=now_stamp() WHERE token=?").run(token);
 getDb().prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(id);
 getDb().prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(id);
 revalidatePath(`/venues/${id}`,'layout');revalidatePath('/dashboard');redirect(`/venues/${id}/team`);
}
export async function respondVenueInvitationAction(token:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect(`/venue-invitations/${token}`);const inv=venueInvitation(token);if(!inv)notFound();
 const db=getDb();const venue=db.prepare('SELECT account_id,is_demo,archived_at FROM venues WHERE id=?').get(inv.venue_id) as {account_id:number;is_demo:number;archived_at:string|null};
 const email=(db.prepare('SELECT email FROM accounts WHERE id=?').get(a.id) as {email:string}).email;
 if(inv.kind!==a.role||venue.is_demo!==+a.isDemo||email?.toLowerCase()!==inv.email||(inv.account_id!==null&&inv.account_id!==a.id))redirect(`/venue-invitations/${token}?error=account`);
 const w=venuePackageFor(venue.account_id,inv.venue_id)!;if(!w.editable||inv.status!=='nominated'||new Date(inv.expires_at).getTime()<Date.now())redirect(`/venue-invitations/${token}`);
 const response=form.get('response'),note=String(form.get('note')??'').trim(),licence=String(form.get('licence')??'').trim(),phone=String(form.get('phone')??'').trim();
 if(!['accept','decline'].includes(String(response))||(response==='decline'&&!note)||(response==='accept'&&(!phone||!validPhone(phone)||(inv.kind==='director'&&!licence))))redirect(`/venue-invitations/${token}?error=details`);
 db.prepare('UPDATE venue_invitations SET status=?,account_id=?,note=?,licence=?,responded_at=now_stamp() WHERE token=?').run(response==='accept'?'confirmed':'declined',a.id,note,licence,token);
 if(response==='accept'){db.prepare('UPDATE accounts SET phone=? WHERE id=?').run(phone,a.id);db.prepare('UPDATE venue_packages SET work_revision=work_revision+1 WHERE venue_id=?').run(inv.venue_id);db.prepare('DELETE FROM venue_plan_approvals WHERE venue_id=?').run(inv.venue_id);}
 db.prepare("INSERT INTO notifications(account_id,kind,subject_en,subject_ar,body_en,body_ar,record_route,sent_at,is_demo) VALUES(?,'needs_action',?,?,?,?,?,now_stamp(),?)").run(venue.account_id,response==='accept'?'Venue invitation accepted':'Venue invitation declined',response==='accept'?'قُبلت دعوة الموقع':'رُفضت دعوة الموقع',inv.name,inv.name,`/venues/${inv.venue_id}/team`,venue.is_demo);
 revalidatePath(`/venues/${inv.venue_id}`,'layout');revalidatePath('/dashboard');redirect(response==='accept'?`/venue-team/${inv.venue_id}`:`/venue-invitations/${token}`);
}
export async function createVenuePartnerAccountAction(token:string,form:FormData) {
 const inv=venueInvitation(token);if(!inv||inv.status!=='nominated'||new Date(inv.expires_at).getTime()<Date.now())notFound();
 const db=getDb();const v=db.prepare('SELECT account_id,is_demo FROM venues WHERE id=?').get(inv.venue_id) as {account_id:number;is_demo:number};
 if(!venuePackageFor(v.account_id,inv.venue_id)?.editable)notFound();
 const name=String(form.get('name')??'').trim(),password=String(form.get('password')??''),phone=String(form.get('phone')??'').trim();
 if(!name||!phone||!validPhone(phone)||!checkPasswordPolicy(password).ok)redirect(`/venue-invitations/${token}?error=details`);
 if(db.prepare('SELECT id FROM accounts WHERE email=?').get(inv.email))redirect(`/venue-invitations/${token}?error=existing`);
 const result=db.prepare('INSERT INTO accounts(login,email,password_hash,display_name,initials,role,is_demo,phone) VALUES(?,?,?,?,?,?,?,?)').run(`user_${randomBytes(6).toString('hex')}`,inv.email,hashPassword(password),name,name.split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase(),inv.kind,v.is_demo,phone);
 // Account creation never counts as acceptance; OTP (when enabled) runs first.
 await verifiedSignIn(Number(result.lastInsertRowid),`/venue-invitations/${token}`);
 redirect(`/venue-invitations/${token}`);
}

/** Level 1 needs a confirmed local contact, not necessarily an on-site agency account. */
export async function saveVenueLocalEmsContactAction(id:string,form:FormData) {
 const a=await currentAccount();if(!a)redirect('/signin');const w=venuePackageFor(a.id,id);if(!w)notFound();
 if(!w.editable||!venueLocalEmsContactApplies(w.level,w.invitations.some(i=>i.kind==='ems'&&['nominated','confirmed'].includes(i.status))))redirect(`/venues/${id}/team`);
 const agency=String(form.get('agency')??'').trim().slice(0,200),phone=String(form.get('phone')??'').trim();
 if(!agency||!validPhone(phone)||form.get('confirm')!=='yes')redirect(`/venues/${id}/team?error=local`);
 ensureVenuePackage(a.id,id);getDb().prepare('UPDATE venue_packages SET answers=?,work_revision=work_revision+1 WHERE venue_id=?').run(JSON.stringify({...w.answers,'7':{agency,phone,localConfirmed:'yes'}}),id);
 revalidatePath(`/venues/${id}`,'layout');redirect(`/venues/${id}/team?saved=contact`);
}
