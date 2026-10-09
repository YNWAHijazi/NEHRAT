import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';
import {expectAbsent} from '../helpers/absence';
import {openDetails, openAllRequirements} from '../helpers/record';

for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue and facility records have no tabs; their edit screens keep the record's identity (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 // THE VENUE IS ONE RECORD PAGE, like the event's (owner, 8 October 2026): no section tabs; the two edit
 // screens keep the record's identity and lead back to it; the old team route lands on the record.
 {let identity:string|undefined;
 for(const path of ['','/details','/assessment']){await page.goto(`/venues/VN-0032${path}`);const h=page.locator('[data-region=venue-workspace-header]');await expect(h).toBeVisible();
  await expectAbsent(page,{anchor:h,absent:'[data-region=venue-workspace-nav]',because:'the venue record has no section tabs'});
  if(path)await expect(page.locator('[data-region=back-to-record]')).toHaveAttribute('href','/venues/VN-0032');
  else await expect(page.locator('[data-region=details-assessment]')).toBeVisible();
  const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
 await page.goto('/venues/VN-0032/team');await expect(page).toHaveURL(/\/venues\/VN-0032$/);
 await page.screenshot({path:info.outputPath(`venue-${lang}-${width}.png`),fullPage:true});}
 // THE FACILITY IS ONE RECORD PAGE TOO (owner, 9 October 2026): no section tabs; the details edit
 // screen keeps the record's identity and leads back to it; the old tab routes land on the record.
 {let identity:string|undefined;
 for(const path of ['','/profile']){await page.goto(`/facilities/FC-0014${path}`);const h=page.locator('[data-region=facility-workspace-header]');await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expectAbsent(page,{anchor:h,absent:'[data-region=facility-workspace-nav]',because:'the facility record has no section tabs'});
  if(path)await expect(page.locator('[data-region=back-to-record]')).toHaveAttribute('href','/facilities/FC-0014');
  else{for(const section of ['status','aeds','plan','incidents','requests','details'])await expect(page.locator(`[data-region=section-${section}]`)).toBeVisible();}
  const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
 for(const [path,landing] of [['/devices',/\/facilities\/FC-0014\?step=aeds#aeds$/],['/plan',/\/facilities\/FC-0014\?step=plan#plan$/],['/submit',/\/facilities\/FC-0014\?step=plan#plan$/],['/incidents',/\/facilities\/FC-0014#incidents$/]] as const){await page.goto(`/facilities/FC-0014${path}`);await expect(page).toHaveURL(landing);await expect(page.locator('[data-region=facility-workspace-header]')).toBeVisible();}
 await page.goto('/facilities/FC-0014');await page.screenshot({path:info.outputPath(`facility-${lang}-${width}.png`),fullPage:true});}
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
 await expect(page.locator('[data-region=venue-details-read-only]')).toContainText('Missing');await expectAbsent(page,{anchor:'[data-region=venue-details-read-only]',absent:'input[name=contactName], input[name=contactPhoneNumber]',because:'saved details read as text until the organizer chooses Edit details'});await expect(page.getByText('Some details are missing. Choose Edit details to complete them.')).toBeVisible();
 await page.getByRole('button',{name:'Edit details',exact:true}).click();await expect(page.locator('input[name=contactPhoneNumber]')).toBeEnabled();
 }finally{db.prepare("UPDATE venues SET responsible_phone=? WHERE id='VN-0032'").run(v.responsible_phone);db.prepare("DELETE FROM venue_packages WHERE venue_id='VN-0032'").run();db.close();}
});

test('a venue in preparation fills its own steps; its AEDs come from a facility registration, never re-entered here',async({page})=>{
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);asDraft(db);
 // The answer tables' activity triggers call the app's now_stamp(); a raw connection must supply it to clean up.
 db.function('now_stamp',()=>new Date().toISOString().slice(0,19).replace('T',' '));
 try{
 await signInAs(page,'test_organizer');await page.goto('/venues/VN-0032');
 // The optional step: the operator's own words, saved on Next like every other step.
 const row=await openDetails(page.locator('[data-requirement="V6"]'));
 await expect(row.locator('[data-region=card-owner]')).toContainText('You fill this step');
 await row.locator('textarea[name=notes]').fill('The forecourt is closed to traffic during every operating session.');
 await row.locator('[data-region=save]').click();await expect(row.getByRole('status')).toContainText('Saved.');
 await page.goto('/venues/VN-0032');await expect(page.locator('[data-requirement="V6"]')).toHaveAttribute('data-state','complete');
 // The seeded venue recorded that it has no facility registration; the step offers the facility route, not an AED form.
 const pad=(await openDetails(page.locator('[data-requirement="V7"]'))).locator('[data-region=venue-pad]');
 await expect(pad).toHaveAttribute('data-linked','false');await expect(pad.locator('[data-region=venue-pad-link] select option[value="FC-0014"]')).toHaveCount(1);
 await expectAbsent(page,{anchor:'[data-requirement="V7"]',absent:'[data-requirement="V7"] input[name=label], [data-requirement="V7"] input[name=identification]',because:'AEDs are registered once, on the facility record, and only shown on the venue'});
 await openAllRequirements(page);await expect(page.locator('[data-region=required-count]')).toBeVisible();
 }finally{db.prepare("DELETE FROM requirement_answers WHERE record_kind='venue' AND record_id='VN-0032' AND key='V6'").run();db.prepare("DELETE FROM requirement_answer_history WHERE record_kind='venue' AND record_id='VN-0032' AND key='V6'").run();db.prepare("DELETE FROM venue_packages WHERE venue_id='VN-0032'").run();db.close();}
});
