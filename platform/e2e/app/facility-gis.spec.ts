import {expect,test} from '@playwright/test';
import {signInAs} from '../helpers/signin';
import {fillFacilityProfile,chooseMapPoint} from '../helpers/facility-map';
test('facility registers a map, AED, plan and incident; Ministry can read and map it',async({page})=>{
 page.setDefaultTimeout(15000);
 await signInAs(page,'test_organizer');await fillFacilityProfile(page);await page.getByRole('button',{name:/Sports and aquatic facilities/}).click();await page.getByRole('button',{name:/Continue to the coordinator/}).click();
 await page.locator('input[name=coordinatorName]').fill('Facility manager');await page.locator('input[name=coordinatorPhone]').fill('+9611234567');await page.locator('input[name=coordinatorEmail]').fill('facility@example.com');await page.getByRole('button',{name:/Continue to the device records/}).click();await expect(page).toHaveURL(/\/facilities\/FC-\d+\/devices/);
 const id=page.url().match(/FC-\d+/)![0];
 await page.locator('input[name=identification]').fill('GIS-SERIAL-1');await page.locator('input[name=location]').fill('Reception');await page.locator('input[name=representative]').fill('Facility manager');await page.getByRole('button',{name:'Register device',exact:true}).click();await expect(page).toHaveURL(/notice=saved/);await expect(page.locator('[data-region=registry-table]')).toContainText('GIS-SERIAL-1');
 await page.getByRole('link',{name:'Continue to the response plan',exact:true}).click();const form=page.locator('[data-region=plan-confirmation]');while(await form.locator('button[aria-pressed=false]').count())await form.locator('button[aria-pressed=false]').first().click();await form.locator('input[name=drillDate]').fill('2026-08-01');await form.getByRole('button',{name:'Record the readiness confirmation',exact:true}).click();await expect(page).toHaveURL(/notice=confirmed/);
 await page.goto(`/facilities/${id}/devices`);await page.locator('[data-region=registry-table] button').first().click();await page.getByRole('button',{name:'Update after relocation',exact:true}).click();await page.locator('input[name=location]').fill('Pool entrance');await page.getByRole('checkbox',{name:/This AED needs a separate map pin/}).check();await chooseMapPoint(page,'aedMap');await page.locator('input[name=representative]').fill('Facility manager');await page.getByRole('button',{name:'Save new location',exact:true}).click();await expect(page).toHaveURL(/notice=saved/);await page.goto(`/facilities/${id}/plan`);await expect(page.getByText('The facility or AED details changed. Review and confirm the updated plan.',{exact:true})).toBeVisible();
 await page.goto(`/facilities/${id}/incidents/new`);await page.locator('input[name=date]').fill('2026-08-12');await page.locator('input[name=time]').fill('12:30');await page.locator('input[name=location]').fill('Pool entrance');
 // Select each answer row independently (six immediate, one attendance, two post-incident).
 for(const region of ['immediate-response','ems-attendance','post-incident'])for(const b of await page.locator(`[data-region=${region}]`).getByRole('button',{name:'Yes',exact:true}).all())await b.click();
 await page.getByRole('button',{name:'EMS ambulance',exact:true}).click();await page.locator('textarea[name=corrective]').fill('Replace the used electrode pads.');await page.getByRole('button',{name:'Submit report',exact:true}).click();await expect(page).toHaveURL(/notice=incident/);await page.getByRole('link',{name:'View incident reports',exact:true}).click();await page.locator('details summary').first().click();await expect(page.locator('main')).toContainText('Replace the used electrode pads.');expect((await page.request.get('/api/facilities/geojson')).status()).toBe(404);
 await signInAs(page,'test_moph');await page.goto('/ministry/facilities/map');await expect(page.locator('main')).toContainText(id);const response=await page.request.get('/api/facilities/geojson');expect(response.status()).toBe(200);const json=await response.json();expect(json.features.some((f:{properties:{id:string}})=>f.properties.id===`${id}/AED-001`)).toBe(true);await page.goto(`/ministry/facilities/reports?facility=${id}`);await page.locator('details summary').first().click();await expect(page.locator('main')).toContainText('Replace the used electrode pads.');
});

test('facility maps and forms fit a narrow phone in English and Arabic',async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:800});await signInAs(page,'test_organizer');
 await fillFacilityProfile(page);await page.goto('/facilities/FC-0014/profile');
 // Use the organizer's seeded facility rather than creating another record.
 if(await page.getByRole('heading',{name:'Facility details',exact:true}).count()===0){await page.goto('/dashboard');const href=await page.locator('a[href^="/facilities/FC-"]').first().getAttribute('href');await page.goto(`${href}/profile`);}
 for(const lang of ['en','ar']){
  if(lang==='ar')await page.getByRole('button',{name:'العربية',exact:true}).click();
  await expect(page.locator('[data-map-picker]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`facility-profile-${lang}.png`),fullPage:true});
 }
});
