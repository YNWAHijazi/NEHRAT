import { beforeAll, afterAll, expect, test, vi } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '../lib/auth';
const session=vi.hoisted(()=>({account:null as Account|null}));
vi.mock('../lib/auth',()=>({currentAccount:async()=>session.account}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {getDb} from '../lib/db';
import {registerFacilityAction,saveFacilityProfileAction,saveFacilityDeviceAction,saveFacilityPlanAction,saveFacilityPersonsAction,submitFacilityIncidentAction} from '../app/actions';
import {facilityPoint,devicePoint,facilityMapRecords,facilityAedStatus,devicePhotoMeta,ensureFacilityCertificateToken,facilityByCertificateToken} from '../lib/facility-gis';
import {facilityPlanConfirmation} from '../lib/queries';
import {readMapPoint} from '../lib/rules/geolocation';
import {facilityIncidentError,facilityAedRequirement} from '../lib/rules/facility-intake';
import {setFacilityAedRequirementAction} from '../app/ministry-actions';
import {GET} from '../app/api/facilities/geojson/route';
import {hostingVenueForFacility} from '../lib/sites';
import {facilityRegistrationFacts} from '../lib/facility-registration';
import {facilityRecordMode} from '../lib/rules/facility-workflow';
const folder=mkdtempSync(join(tmpdir(),'moph-pad-'));let id='';
beforeAll(()=>{vi.stubEnv('DATABASE_PATH',join(folder,'test.db'));vi.stubEnv('REVIEW_CLOCK','2026-08-13');getDb();as('test_organizer');});
afterAll(()=>{getDb().close();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true});});
function as(login:string){const row=getDb().prepare('SELECT id,role,is_demo FROM accounts WHERE login=?').get(login) as {id:number;role:Account['role'];is_demo:number};session.account={...row,login,displayName:login,initials:'T',isDemo:row.is_demo===1};}
function data(fields:Record<string,string>){const f=new FormData();for(const[k,v]of Object.entries(fields))f.set(k,v);return f;}
const profile={name:'PAD test sports facility',address:'Main road',municipality:'Beirut',hours:'Daytime',phone:'+9611234567',email:'test@example.com',accessPoint:'North gate',emsNumber:'140',coordinatorName:'Facility manager',coordinatorPhone:'+9611234567',coordinatorEmail:'test@example.com',category:'sports',mapLat:'33.89',mapLng:'35.50',mapConfirmed:'yes'};
test('coordinates require a confirmed valid map pin',()=>{expect(readMapPoint(data({mapLat:'91',mapLng:'35',mapConfirmed:'yes'}))).toBeNull();expect(readMapPoint(data({mapLat:'',mapLng:'',mapConfirmed:'yes'}))).toBeNull();expect(readMapPoint(data({...profile,mapConfirmed:'no'}))).toBeNull();});
test('registration validates and saves the profile, pin and audit together',async()=>{const before=getDb().prepare('SELECT COUNT(*) n FROM facilities').get()!.n;await expect(registerFacilityAction(data({...profile,mapConfirmed:'no'}))).rejects.toThrow('error=details');expect(getDb().prepare('SELECT COUNT(*) n FROM facilities').get()!.n).toBe(before);// The one-page intake lands on the facility record (owner, 9 October 2026).
 await expect(registerFacilityAction(data(profile))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);id=String(getDb().prepare('SELECT id FROM facilities WHERE name_en=?').get(profile.name)!.id);expect(facilityPoint(id)).toEqual({lat:33.89,lng:35.5});expect(facilityAedStatus(id)).toBe('required');});
test('AED record inherits the facility pin and stores its operational answer',async()=>{await expect(saveFacilityDeviceAction(id,data({purpose:'initial',identification:'SER-1',location:'Reception',accessibleHours:'yes',publiclyAccessible:'no',pediatric:'na',operational:'no',representative:'Facility manager',separatePin:'no'}))).rejects.toThrow('notice=saved');expect(devicePoint(id,'AED-001')).toEqual({point:facilityPoint(id),separate:false});expect(getDb().prepare('SELECT operational FROM facility_devices WHERE facility_id=?').get(id)!.operational).toBe(0);});
test('status changes cannot be forged against another facility or unknown purpose',async()=>{const other='FC-9999';await expect(saveFacilityDeviceAction(other,data({purpose:'statusChange',label:'AED-001',operational:'yes',representative:'x'}))).rejects.toThrow('/dashboard');await expect(saveFacilityDeviceAction(id,data({purpose:'fake',label:'AED-001',representative:'x'}))).rejects.toThrow('error=details');});
const plan={check_trained:'on',check_signage:'on',check_access:'on',check_routes:'on',check_staffKnow:'on',check_drill:'on',drillDate:'2026-08-01',representative:'Facility manager'};
test('readiness cannot be confirmed with a failed AED or an old drill',async()=>{await expect(saveFacilityPlanAction(id,data(plan))).rejects.toThrow('error=readiness');await expect(saveFacilityDeviceAction(id,data({purpose:'statusChange',label:'AED-001',operational:'yes',accessibleHours:'yes',representative:'Facility manager'}))).rejects.toThrow('notice=saved');await expect(saveFacilityPlanAction(id,data({...plan,drillDate:'2020-01-01'}))).rejects.toThrow('error=readiness');await expect(saveFacilityPlanAction(id,data(plan))).rejects.toThrow('notice=confirmed');expect(facilityPlanConfirmation(id)?.current).toBe(true);});
test('AED relocation creates history and requires a fresh plan confirmation',async()=>{await expect(saveFacilityDeviceAction(id,data({purpose:'relocation',label:'AED-001',location:'Pool entrance',accessibleHours:'yes',representative:'Facility manager',separatePin:'yes',aedMapLat:'33.891',aedMapLng:'35.501',aedMapConfirmed:'yes'}))).rejects.toThrow('notice=saved');expect(devicePoint(id,'AED-001')).toEqual({point:{lat:33.891,lng:35.501},separate:true});expect(facilityPlanConfirmation(id)?.current).toBe(false);expect(Number(getDb().prepare("SELECT COUNT(*) n FROM facility_device_updates WHERE facility_id=? AND snapshot != '{}'").get(id)!.n)).toBeGreaterThan(1);});
test('profile edits preserve separate AED pins and update inherited ones',async()=>{await expect(saveFacilityProfileAction(id,data({...profile,mapLat:'33.90'}))).rejects.toThrow('notice=profile');expect(facilityPoint(id)?.lat).toBe(33.9);expect(devicePoint(id,'AED-001').point?.lat).toBe(33.891);});
const incident={date:'2026-08-12',time:'12:30',location:'Reception',emsContacted:'yes',cprStarted:'yes',aedAvailable:'yes',aedApplied:'yes',shock:'unknown',guided:'yes',emsAttended:'yes',transportedBy:'ems',returned:'no',problem:'yes',corrective:'Replace the electrode pads.'};
test('updated incident answers allow unavailable AEDs and record account automatically',async()=>{expect(facilityIncidentError(incident,'2026-08-13')).toBeNull();expect(facilityIncidentError({...incident,returned:'fake'},'2026-08-13')).toBe('incomplete');expect(facilityIncidentError({...incident,date:'2026-02-30'},'2026-08-13')).toBe('invalid-date');await expect(submitFacilityIncidentAction(id,data({...incident,submittedByName:'Forged name'}))).rejects.toThrow('notice=incident');const r=getDb().prepare('SELECT submitted_by,payload FROM facility_incidents WHERE facility_id=?').get(id)!;expect(r.submitted_by).toBe(session.account!.id);expect(JSON.parse(String(r.payload))).not.toHaveProperty('submittedByName');});
test('Ministry map respects account permissions and the demo boundary',async()=>{expect((await GET()).status).toBe(404);as('test_moph');const r=await GET();expect(r.status).toBe(200);const j=await r.json();expect(j.features.some((f:{properties:{id:string}})=>f.properties.id===id)).toBe(true);const realIds=getDb().prepare('SELECT id FROM facilities WHERE is_demo=0').all().map(r=>r.id);expect(facilityMapRecords(true).some(r=>realIds.includes(r.id))).toBe(false);as('test_organizer');});
test('conditional AED rules stay conditional and fixed categories cannot be waived',()=>{expect(facilityAedRequirement({category:'sports',type:'',capacity:null,threshold:null,decision:'notRequired'})).toBe('required');expect(facilityAedRequirement({category:'transport',type:'publicVenue',capacity:1001,threshold:1000,decision:'notRequired'})).toBe('required');expect(facilityAedRequirement({category:'education',type:'',capacity:null,threshold:null})).toBe('review');expect(facilityAedRequirement({category:'transport',type:'publicVenue',capacity:1000,threshold:1000})).toBe('notRequired');expect(facilityAedRequirement({category:'transport',type:'publicVenue',capacity:1001,threshold:1000})).toBe('required');});

test('Ministry decisions require permission, a reason, and cannot waive fixed categories',async()=>{
 as('test_organizer');await expect(setFacilityAedRequirementAction(id,data({requirement:'required',reason:'Review completed'}))).rejects.toThrow('ministry-permission');
 as('test_moph');await expect(setFacilityAedRequirementAction(id,data({requirement:'notRequired',reason:'Test waiver'}))).rejects.toThrow('error=aed');
 await expect(setFacilityAedRequirementAction(id,data({requirement:'required',reason:''}))).rejects.toThrow('error=aed');
 await expect(setFacilityAedRequirementAction(id,data({requirement:'required',reason:'Sports category confirmed'}))).rejects.toThrow('notice=aed');
 expect(getDb().prepare('SELECT reason,actor_id FROM facility_aed_decisions WHERE facility_id=?').get(id)).toMatchObject({reason:'Sports category confirmed',actor_id:session.account!.id});as('test_organizer');
});

test('the responsible facility contact cannot be erased, is the only person collected, and is edited on the details screen',async()=>{as('test_organizer');await expect(saveFacilityPersonsAction(id,data({coordinatorName:'',coordinatorPhone:'',coordinatorEmail:''}))).rejects.toThrow('/profile?error=contact');expect(getDb().prepare("SELECT name_or_position FROM facility_persons WHERE facility_id=? AND role='coordinator'").get(id)!.name_or_position).toBe('Facility manager');
 // Registration wrote ONE row (partner audit, 2026-10-08): no alternate, no assigned guide.
 expect(getDb().prepare('SELECT COUNT(*) n FROM facility_persons WHERE facility_id=?').get(id)!.n).toBe(1);
 await expect(saveFacilityPersonsAction(id,data({coordinatorName:'Duty manager',coordinatorPhone:'+9611234568',coordinatorEmail:'duty@example.com'}))).rejects.toThrow('/profile?notice=contact');
 expect(getDb().prepare("SELECT name_or_position FROM facility_persons WHERE facility_id=? AND role='coordinator'").get(id)!.name_or_position).toBe('Duty manager');});

test('the AED record is lean: no annual readiness confirmation purpose, no maintenance dates',async()=>{as('test_organizer');
 await expect(saveFacilityDeviceAction(id,data({purpose:'annual',label:'AED-001',representative:'x',check_operational:'yes'}))).rejects.toThrow('error=details');
 await expect(saveFacilityDeviceAction(id,data({purpose:'replacement',label:'AED-001',identification:'SER-2',representative:'Facility manager',padExpiry:'2030-01-01',batteryExpiry:'2030-01-01',separatePin:'no'}))).rejects.toThrow('notice=saved');
 const row=getDb().prepare('SELECT identification,pad_expiry,battery_expiry,latest_check FROM facility_devices WHERE facility_id=? AND label=?').get(id,'AED-001')!;
 expect(row.identification).toBe('SER-2');expect(row.pad_expiry).toBeNull();expect(row.battery_expiry).toBeNull();expect(row.latest_check).toBeNull();});

test('a photo of the installed AED is stored with the record; a non-image is refused before anything is written',async()=>{as('test_organizer');
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201e2c3b3a10000000049454e44ae426082','hex');
 const withFile=(file:File)=>{const f=data({purpose:'statusChange',label:'AED-001',operational:'yes',accessibleHours:'yes',representative:'Facility manager'});f.set('photo',file);return f;};
 await expect(saveFacilityDeviceAction(id,withFile(new File([png],'aed.png',{type:'image/png'})))).rejects.toThrow('notice=saved');
 const stored=getDb().prepare('SELECT file_name,content_type,byte_size FROM facility_device_photos WHERE facility_id=? AND label=?').get(id,'AED-001')!;
 expect(stored).toMatchObject({file_name:'aed.png',content_type:'image/png',byte_size:png.length});
 expect(devicePhotoMeta(id,'AED-001')?.contentType).toBe('image/png');
 const before=getDb().prepare('SELECT COUNT(*) n FROM facility_device_updates WHERE facility_id=?').get(id)!.n;
 await expect(saveFacilityDeviceAction(id,withFile(new File([png],'plan.pdf',{type:'application/pdf'})))).rejects.toThrow('error=photo-wrongType');
 expect(getDb().prepare('SELECT COUNT(*) n FROM facility_device_updates WHERE facility_id=?').get(id)!.n).toBe(before);
 expect(devicePhotoMeta(id,'AED-001')?.fileName).toBe('aed.png');});

test('the certificate token is unguessable, minted once, and resolves to the certificate facts only',()=>{
 const token=ensureFacilityCertificateToken(id);expect(token).toMatch(/^[a-f0-9]{48}$/);expect(ensureFacilityCertificateToken(id)).toBe(token);
 const facts=facilityByCertificateToken(token);expect(facts?.id).toBe(id);expect(facts?.isDemo).toBe(session.account!.isDemo);expect(Object.keys(facts!).sort()).toEqual(['archivedAt','categoryKey','id','isDemo','nameAr','nameEn','registeredOn']);
 expect(facilityByCertificateToken(id)).toBeNull();expect(facilityByCertificateToken('0'.repeat(48))).toBeNull();});

test('the facility record reads its mode from the facts: registering until the first confirmation, managed after it',()=>{
 // The facility above recorded a confirmation, then relocated an AED: still registered, its certificate withheld.
 const facts=facilityRegistrationFacts(id);expect(facts.confirmationRecorded).toBe(true);expect(facts.confirmationCurrent).toBe(false);expect(facilityRecordMode(facts)).toBe('manage');});

test('a facility registered from a hosting venue stands on its site, and only its owner sees the venue named on the record',async()=>{as('test_organizer');
 await expect(registerFacilityAction(data({...profile,name:'PAD from a venue',fromVenue:'VN-0032'}))).rejects.toThrow(/redirect:\/facilities\/FC-\d+$/);
 const fromVenue=String(getDb().prepare('SELECT id FROM facilities WHERE name_en=?').get('PAD from a venue')!.id);
 expect(facilityRecordMode(facilityRegistrationFacts(fromVenue))).toBe('register');
 expect(hostingVenueForFacility(session.account!.id,fromVenue)?.id).toBe('VN-0032');
 expect(hostingVenueForFacility(session.account!.id,id)).toBeNull();
 as('test_moph');expect(hostingVenueForFacility(session.account!.id,fromVenue)).toBeNull();as('test_organizer');});
