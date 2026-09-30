import { NextResponse } from 'next/server';
import { currentAccount } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';
import { can } from '../../../../../lib/rules/ministry';
import { servedType } from '../../../../../lib/rules/uploads';
export async function GET(request:Request,{params}:{params:Promise<{id:string;key:string}>}){
 const no=()=>new NextResponse('Not found',{status:404});const a=await currentAccount();if(!a)return no();const {id,key}=await params;const db=getDb();
 const v=db.prepare('SELECT account_id,is_demo FROM venues WHERE id=?').get(id) as {account_id:number;is_demo:number}|undefined;if(!v||v.is_demo!==+a.isDemo)return no();
 const rev=new URL(request.url).searchParams.get('revision');if(rev&&!/^[1-9]\d*$/.test(rev))return no();
 const own=v.account_id===a.id;if(!own&&(!can(a.role,'viewSubmission')||!rev))return no();
 const row=(rev?db.prepare(`SELECT f.file_name,f.content_type,f.bytes FROM venue_package_files f JOIN venue_package_history h ON h.id=f.package_id WHERE h.venue_id=? AND h.revision=? AND f.doc_key=?`).get(id,Number(rev),key):db.prepare('SELECT file_name,content_type,bytes FROM venue_attachments WHERE venue_id=? AND doc_key=?').get(id,key)) as {file_name:string;content_type:string;bytes:Uint8Array}|undefined;
 const type=row?servedType(row.content_type):null;if(!row?.bytes?.length||!type)return no();
 return new NextResponse(Buffer.from(row.bytes),{headers:{'Content-Type':type.mime,'Content-Length':String(row.bytes.length),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'private, no-store'}});
}
