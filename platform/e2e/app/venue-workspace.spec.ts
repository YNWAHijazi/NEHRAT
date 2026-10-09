import {test,expect} from '@playwright/test';
import {signInAs} from '../helpers/signin';
import {mockMapTiles} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';
import {expectAbsent} from '../helpers/absence';
import {gotoRidingRestarts} from '../helpers/resilient';

/**
 * HOSTING VENUE REGISTRATION IS REPLACED BY FACILITY/SITE REGISTRATION (owner, 9 October 2026).
 * Every venue page tells the owner so, read-only, with "Register this place as a facility/site";
 * registering a venue lands on the facility/site service; nothing about a venue is deleted.
 */
for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue pages are history with the route onward; the facility record has no tabs (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 // Every venue page carries the notice and the route onward; nothing on it edits, files or renews.
 for(const path of ['','/details','/assessment','/acknowledgment','/requirements','/certificate']){
  await gotoRidingRestarts(page,`/venues/VN-0032${path}`);
  const notice=page.locator('[data-region=venue-retired]');await expect(notice).toBeVisible();
  await expect(notice).toContainText(lang==='ar'?'حلّ تسجيل المنشأة/الموقع محلّ تسجيل الموقع المستضيف.':'Hosting venue registration is replaced by facility/site registration.');
  const go=notice.locator('a[data-action]');await expect(go).toHaveAttribute('href',/^\/facilities\/(new\?fromVenue=VN-0032|FC-\d+)$/);
  expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 }
 await gotoRidingRestarts(page,'/venues/VN-0032');
 await expectAbsent(page,{anchor:'[data-region=venue-retired]',absent:'[data-region=record-actions], [data-region=edit-details-link], [data-region=reassess-link], [data-region=confirm-and-submit]',because:'a venue is no longer an active regulatory entity'});
 await page.screenshot({path:info.outputPath(`venue-${lang}-${width}.png`),fullPage:true});
 // The forms that changed a venue lead back to its record; registering one leads to the facility/site service.
 await gotoRidingRestarts(page,'/venues/VN-0032/change');await expect(page).toHaveURL(/\/venues\/VN-0032$/);
 await gotoRidingRestarts(page,'/venues/VN-0032/team');await expect(page).toHaveURL(/\/venues\/VN-0032$/);
 await gotoRidingRestarts(page,'/venues/new');await expect(page).toHaveURL(/\/facilities\/new(\?|$)/);
 // THE FACILITY IS ONE RECORD PAGE (owner, 9 October 2026): no section tabs; the details edit
 // screen keeps the record's identity and leads back to it; the old tab routes land on the record.
 {let identity:string|undefined;
 for(const path of ['','/profile']){await gotoRidingRestarts(page,`/facilities/FC-0014${path}`);const h=page.locator('[data-region=facility-workspace-header]');await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expectAbsent(page,{anchor:h,absent:'[data-region=facility-workspace-nav]',because:'the facility record has no section tabs'});
  if(path)await expect(page.locator('[data-region=back-to-record]')).toHaveAttribute('href','/facilities/FC-0014');
  else{for(const section of ['status','aeds','plan','incidents','requests','details'])await expect(page.locator(`[data-region=section-${section}]`)).toBeVisible();}
  const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
 for(const [path,landing] of [['/devices',/\/facilities\/FC-0014\?step=aeds#aeds$/],['/plan',/\/facilities\/FC-0014\?step=plan#plan$/],['/submit',/\/facilities\/FC-0014\?step=plan#plan$/],['/incidents',/\/facilities\/FC-0014#incidents$/]] as const){await gotoRidingRestarts(page,`/facilities/FC-0014${path}`);await expect(page).toHaveURL(landing);await expect(page.locator('[data-region=facility-workspace-header]')).toBeVisible();}
 await gotoRidingRestarts(page,'/facilities/FC-0014');await page.screenshot({path:info.outputPath(`facility-${lang}-${width}.png`),fullPage:true});}
});

test('the Ministry keeps the venue register as a read-only history',async({page})=>{
 await signInAs(page,'test_moph');await gotoRidingRestarts(page,'/ministry/venues');
 await expect(page.getByRole('heading',{name:'Hosting venues (historical)',exact:true})).toBeVisible();
 await expect(page.locator('[data-region=venue-retired]')).toContainText('no outcome is recorded on it');
 await expectAbsent(page,{anchor:'[data-region=venue-retired]',absent:page.getByRole('link',{name:'Review submission',exact:true}),because:'nothing on a venue waits for a review'});
});
