import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';
import {expectAbsent} from '../helpers/absence';
import {openDetails, openAllRequirements} from '../helpers/record';

for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue record has no tabs; facility tabs stay aligned (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 // THE VENUE IS ONE RECORD PAGE, like the event's (owner, 8 October 2026): no section tabs; the two edit
 // screens keep the record's identity and lead back to it; the old team route lands on the EMS row.
 {let identity:string|undefined;
 for(const path of ['','/details','/assessment']){await page.goto(`/venues/VN-0032${path}`);const h=page.locator('[data-region=venue-workspace-header]');await expect(h).toBeVisible();
  await expectAbsent(page,{anchor:h,absent:'[data-region=venue-workspace-nav]',because:'the venue record has no section tabs'});
  if(path)await expect(page.locator('[data-region=back-to-record]')).toHaveAttribute('href','/venues/VN-0032');
  else await expect(page.locator('[data-region=details-assessment]')).toBeVisible();
  const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
 await page.goto('/venues/VN-0032/team');await expect(page).toHaveURL(/\/venues\/VN-0032\?step=B7#req-B7$/);
 await page.screenshot({path:info.outputPath(`venue-${lang}-${width}.png`),fullPage:true});}
 for(const [service,id,paths] of [['facility','FC-0014',['','/profile','/devices','/plan','/submit','/incidents']]] as const){
  let y:number|undefined;let identity:string|undefined;
  for(const path of paths){await page.goto(`/facilities/${id}${path}`);const h=page.locator(`[data-region=${service}-workspace-header]`);await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);const nav=h.locator('nav');await expect(nav.locator('[aria-current=page]')).toHaveCount(1);const top=(await nav.boundingBox())!.y;if(y===undefined)y=top;expect(Math.abs(top-y)).toBeLessThanOrEqual(1);const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
  await page.screenshot({path:info.outputPath(`${service}-${lang}-${width}.png`),fullPage:true});
 }
 await page.goto('/venues/VN-0032/requirements');await expect(page.locator('[data-region=requirement-list]')).toBeVisible();
 await page.goto('/venues/VN-0032/submit');await expect(page).toHaveURL(/\/venues\/VN-0032#final-review$/);
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

test('Level 1 local EMS contact is one confirmation on the record page, with no invitation and no team form',async({page})=>{
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);asDraft(db);
 // The answer tables' activity triggers call the app's now_stamp(); a raw connection must supply it to clean up.
 db.function('now_stamp',()=>new Date().toISOString().slice(0,19).replace('T',' '));
 try{
 await signInAs(page,'test_organizer');await page.goto('/venues/VN-0032');
 const row=page.locator('[data-requirement="B7"]');
 await expect(row).toHaveAttribute('data-state','pending');
 await openDetails(row);
 await expect(row).toContainText('Local EMS access');
 await row.locator('input[name=how]').fill('Call 140; the station knows the operating times');
 await row.locator('[data-region=save]').click();
 await expect(row.getByRole('status')).toContainText('Saved.');
 await page.goto('/venues/VN-0032');
 await expect(page.locator('[data-requirement="B7"]')).toHaveAttribute('data-state','complete');
 await openAllRequirements(page);
 await expect(page.locator('[data-region=required-count]')).toBeVisible();
 // No invitation exists at Level 1: the row names no party, and the team page carries no local-contact form.
 await openDetails(page.locator('[data-requirement="B7"]'));
 await expectAbsent(page,{anchor:'[data-requirement="B7"]',absent:'[data-requirement="B7"] [data-region=party-ems]',because:'the Level 1 contact is a confirmation by the operator, not an invitation (catalogue B7, Level 1)'});
 await expectAbsent(page,{anchor:'[data-requirement="B7"]',absent:'[data-requirement="B7"] form[data-region=invite]',because:'no EMS invitation is asked at Level 1'});
 }finally{db.prepare("DELETE FROM requirement_answers WHERE record_kind='venue' AND record_id='VN-0032'").run();db.prepare("DELETE FROM requirement_answer_history WHERE record_kind='venue' AND record_id='VN-0032'").run();db.prepare("DELETE FROM venue_packages WHERE venue_id='VN-0032'").run();db.close();}
});
