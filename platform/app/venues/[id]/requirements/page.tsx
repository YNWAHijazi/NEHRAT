import Link from 'next/link';
import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { L } from '../../../../components/L';
import { InfoNote } from '../../../../components/InfoNote';
import { UploadInput } from '../../../../components/UploadInput';
import { acceptAttribute, acceptHint } from '../../../../lib/rules/uploads';
import { saveVenueRequirementAction } from '../../actions';
export default async function Requirements({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string}>}){
 const {id}=await params;const {account,w}=await ownedVenuePage(id);const q=await searchParams;
 return <VenueWorkspace account={account} w={w} active="requirements"><h2><L en="Requirements" ar="المتطلبات"/></h2>
 {!w.assessmentDone?<p><Link href={`/venues/${id}/assessment`}><L en="Complete the assessment to see your requirements." ar="أكملوا التقييم للاطلاع على المتطلبات."/></Link></p>:<>
 <p style={{color:'var(--muted)'}}><L en="Open each item and add your arrangements. Green means complete." ar="افتحوا كل بند وأضيفوا الترتيبات. الأخضر يعني أنه مكتمل."/></p>
 {q.error?<p role="alert"><L en="The file could not be uploaded. Use a supported file type and size." ar="تعذّر رفع الملف. استخدموا نوعاً وحجماً مدعومين."/> <L en={acceptHint().en} ar={acceptHint().ar}/></p>:null}
 {q.saved?<p role="status"><L en="Saved." ar="حُفظ."/></p>:null}
 {['required','optional'].map(group=>{const rows=w.requirements.filter(r=>r.optional===(group==='optional'));return rows.length?<section key={group}><h3><L en={group==='required'?'Required':'Recommended (optional)'} ar={group==='required'?'مطلوب':'موصى به (اختياري)'}/></h3>
 <div data-region="requirements" style={{display:'grid',gap:12,marginBlockEnd:28}}>{rows.map(r=>{const key=String(r.n);const file=w.files.find(f=>f.docKey===key&&f.hasFile);return <details id={`r-${key}`} key={key} data-requirement={key} open={q.saved===key} style={{background:'var(--surface2)',borderRadius:12,borderInlineStart:`3px solid ${r.done?'var(--brand)':r.optional?'var(--line)':'var(--accent-ink)'}`,padding:20,scrollMarginBlockStart:24}}>
 <summary style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,minHeight:40}}><strong><L en={r.en} ar={r.ar}/></strong><span data-completion={r.done?'complete':'pending'} style={{flexShrink:0,color:r.done?'var(--brand)':r.optional?'var(--muted)':'var(--accent-ink)',background:r.done?'var(--brand-soft)':r.optional?'var(--bg)':'var(--accent-soft)',padding:'5px 10px',borderRadius:20,fontSize:13}}><L en={r.done?'Complete':r.optional?'Optional':'Pending'} ar={r.done?'مكتمل':r.optional?'اختياري':'قيد الانتظار'}/></span></summary>
 <div style={{display:'flex',gap:8,alignItems:'center',marginBlock:'12px 20px'}}><L en={r.respEn} ar={r.respAr}/><InfoNote><L en={r.valueEn} ar={r.valueAr}/></InfoNote></div>
 {r.n===2?<p><L en="Upload the plan prepared by your Medical Director or EMS agency. A Level 3 plan must have the Medical Director’s approval." ar="أرفقوا الخطة التي أعدّها المدير الطبي أو جهة الإسعاف. تتطلّب خطة المستوى الثالث اعتماد المدير الطبي."/></p>:null}
 <form action={saveVenueRequirementAction.bind(null,id,key)}><fieldset disabled={!w.editable} style={{border:0,padding:0,margin:0,minWidth:0}}>
 <div style={{display:'grid',gap:16}}>{r.fields.map(f=><label key={f.key} style={{display:'grid',gap:6}}><L en={f.en} ar={f.ar}/><textarea name={f.key} defaultValue={w.answers[key]?.[f.key]??''} rows={2} maxLength={5000} style={{width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:8,background:'var(--bg)',fontFamily:'inherit',fontSize:15}}/></label>)}</div>
 {file?<p><a href={`/api/venue-documents/${id}/${key}`} target="_blank" rel="noreferrer"><L en="View attached file" ar="عرض الملف المرفق"/> · {file.fileName}</a></p>:null}
 {w.editable?<><label style={{display:'grid',gap:8,marginBlock:20}}><L en={r.fileRequired?'Required document':'Supporting document (optional)'} ar={r.fileRequired?'مستند مطلوب':'مستند داعم (اختياري)'}/><UploadInput name="file" accept={acceptAttribute()}/></label><button type="submit" style={{padding:'10px 22px',border:0,borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Save" ar="حفظ"/></button></>:null}
 </fieldset></form></details>})}</div></section>:null;})}
 <Link href={`/venues/${id}/submit`} style={{display:'inline-flex',padding:'12px 24px',borderRadius:24,background:'var(--brand)',color:'var(--bg)'}}><L en="Review and submit" ar="المراجعة والتقديم"/></Link></>}
 </VenueWorkspace>;
}
