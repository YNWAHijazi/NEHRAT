import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';
import {expectAbsent} from '../helpers/absence';

for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue and facility tabs stay aligned (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 for(const [service,id,paths] of [['venue','VN-0032',['','/details','/assessment','/team','/requirements','/submit']],['facility','FC-0014',['','/profile','/devices','/plan','/submit','/incidents']]] as const){
  let y:number|undefined;let identity:string|undefined;
  for(const path of paths){await page.goto(`/${service==='venue'?'venues':'facilities'}/${id}${path}`);const h=page.locator(`[data-region=${service}-workspace-header]`);await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);const nav=h.locator('nav');await expect(nav.locator('[aria-current=page]')).toHaveCount(1);const top=(await nav.boundingBox())!.y;if(y===undefined)y=top;expect(Math.abs(top-y)).toBeLessThanOrEqual(1);const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
  await page.screenshot({path:info.outputPath(`${service}-${lang}-${width}.png`),fullPage:true});
 }
});

// VN-0032 holds a certificate, and a certified venue is read-only until its renewal starts
// (2026-10-01). These two tests are about a legacy venue in PREPARATION, so they put VN-0032 in
// that state explicitly -- a draft package on its existing assessment -- and remove it after.
const asDraft=(db:DatabaseSync)=>db.prepare("INSERT OR REPLACE INTO venue_packages(venue_id,status,assessment_version) VALUES('VN-0032','draft',(SELECT MAX(version) FROM venue_assessments WHERE venue_id='VN-0032'))").run();
test('legacy venue details open read-only even when a new contact field is missing',async({page})=>{
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const v=db.prepare("SELECT responsible_phone FROM venues WHERE id='VN-0032'").get() as {responsible_phone:string};
 asDraft(db);db.prepare("UPDATE venues SET responsible_phone='' WHERE id='VN-0032'").run();
 try{await signInAs(page,'test_organizer');await page.goto('/venues/VN-0032/details');
 await expect(page.locator('[data-region=venue-details-read-only]')).toContainText('Missing');await expectAbsent(page,{anchor:'[data-region=venue-details-read-only]',absent:'input[name=contactName], input[name=contactPhone]',because:'saved details read as text until the organizer chooses Edit details'});await expect(page.getByText('Some details are missing. Choose Edit details to complete them.')).toBeVisible();
 await page.getByRole('button',{name:'Edit details',exact:true}).click();await expect(page.locator('input[name=contactPhone]')).toBeEnabled();
 }finally{db.prepare("UPDATE venues SET responsible_phone=? WHERE id='VN-0032'").run(v.responsible_phone);db.prepare("DELETE FROM venue_packages WHERE venue_id='VN-0032'").run();db.close();}
});

test('Level 1 EMS contact is set up once in Medical team and reused in Requirements',async({page})=>{
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);asDraft(db);
 try{
 await signInAs(page,'test_organizer');await page.goto('/venues/VN-0032/requirements');
 const row=page.locator('[data-requirement="7"]');
 await row.locator('summary').first().click();
 await expect(row.locator('[data-completion=pending]')).toBeVisible();
 await expect(row.locator('form,input,textarea')).toHaveCount(0);
 await row.getByRole('link',{name:'Confirm EMS contact',exact:true}).click();
 const contact=page.locator('form').filter({has:page.locator('input[name=agency]')});
 await contact.locator('input[name=agency]').fill('Confirmed local EMS');
 await contact.locator('input[name=phone]').fill('+9613111111');
 await contact.locator('input[name=confirm]').check();
 await contact.getByRole('button',{name:'Save contact',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Contact saved');
 await page.goto('/venues/VN-0032/requirements');
 await expect(page.locator('[data-region=linked-medical-team]')).toContainText('Confirmed local EMS');
 await expect(row.locator('[data-completion=complete]')).toBeVisible();
 await row.locator('summary').first().click();
 await expect(row.locator('form,input,textarea')).toHaveCount(0);
 await expect(row.locator('dd')).toHaveCount(0);
 }finally{db.prepare("DELETE FROM venue_contributions WHERE venue_id='VN-0032'").run();db.prepare("DELETE FROM venue_packages WHERE venue_id='VN-0032'").run();db.close();}
});
