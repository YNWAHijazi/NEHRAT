import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';

for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue and facility tabs stay aligned (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 for(const [service,id,paths] of [['venue','VN-0032',['','/details','/assessment','/requirements','/submit']],['facility','FC-0014',['','/profile','/devices','/plan','/submit','/incidents']]] as const){
  let y:number|undefined;let identity:string|undefined;
  for(const path of paths){await page.goto(`/${service==='venue'?'venues':'facilities'}/${id}${path}`);const h=page.locator(`[data-region=${service}-workspace-header]`);await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);const nav=h.locator('nav');await expect(nav.locator('[aria-current=page]')).toHaveCount(1);const top=(await nav.boundingBox())!.y;if(y===undefined)y=top;expect(Math.abs(top-y)).toBeLessThanOrEqual(1);const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
  await page.screenshot({path:info.outputPath(`${service}-${lang}-${width}.png`),fullPage:true});
 }
});

test('venue: prepare, submit, Ministry feedback, approval, locking and renewal preserve certificates',async({page},info)=>{
 page.setDefaultTimeout(15000);await mockMapTiles(page);await signInAs(page,'test_organizer');await page.goto('/venues/new');
 for(const [k,v] of Object.entries({name:'Venue acceptance test',nameAr:'موقع اختبار القبول',address:'Main road, Beirut',contact:'Venue manager +9611234567',capacity:'1200'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=category]').selectOption('hall');await page.locator('select[name=district]').selectOption('Beirut');
 await page.getByRole('button',{name:'Yes',exact:true}).first().click();await page.getByRole('button',{name:'No',exact:true}).nth(1).click();await chooseMapPoint(page);await page.getByRole('button',{name:'Continue to assessment',exact:true}).click();await expect(page).toHaveURL(/\/venues\/VN-\d+\/assessment/);const id=page.url().match(/VN-\d+/)![0];
 await page.getByLabel(/Most people at the same time during a routine operating session/).fill('1200');
 for(const d of await page.locator('[data-domain]').all())await d.locator('button').first().click();
 await page.getByLabel(/Authorized representative/).fill('Venue manager');await page.getByLabel(/Position/).fill('Operations manager');
 await page.getByRole('button',{name:'Save and view requirements',exact:true}).click();await expect(page).toHaveURL(new RegExp(`${id}/requirements`));
 expect((await page.request.get(`/venues/${id}/certificate`)).status()).toBe(404);
 await expect(page.locator('[data-completion=complete]')).toHaveCount(0);
 await page.goto(`/venues/${id}/submit`);await expect(page.getByRole('button',{name:'Submit to the Ministry',exact:true})).toBeDisabled();
 await page.goto(`/venues/${id}/requirements`);
 const keys=await page.locator('section').filter({has:page.getByRole('heading',{name:'Required',exact:true})}).locator('[data-requirement]').evaluateAll(ns=>ns.map(n=>n.getAttribute('data-requirement')!));expect(keys.length).toBeGreaterThan(5);
 let staleRequest:{headers:Record<string,string>;body:Buffer}|undefined;
 for(const key of keys){const row=page.locator(`[data-requirement="${key}"]`);await row.locator('summary').click();for(const field of await row.locator('textarea').all())await field.fill(`Documented arrangement ${key}: medical team coverage and contact +9611234567.`);
  if(key===keys[0]){await row.locator('input[type=file]').setInputFiles({name:'venue-evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest venue evidence')});}
  const sent=page.waitForRequest(r=>r.method()==='POST'&&r.url().includes('/requirements'));
  await row.getByRole('button',{name:'Save',exact:true}).click();const req=await sent;if(key===keys[0])staleRequest={headers:{'content-type':req.headers()['content-type']!,'next-action':req.headers()['next-action']!},body:req.postDataBuffer()!};await expect(page).toHaveURL(new RegExp(`saved=${key}`));await expect(page.locator(`[data-requirement="${key}"] [data-completion]`)).toHaveAttribute('data-completion','complete');
 }
 await page.goto(`/venues/${id}/submit`);await page.locator('input[name=confirm]').check();await page.getByRole('button',{name:'Submit to the Ministry',exact:true}).click();await expect(page).toHaveURL(/submitted=yes/);
 await page.goto(`/venues/${id}/details`);await expect(page.locator('input[name=name]')).toBeDisabled();
 // A stale form opened before submission must not bypass the server lock.
 expect(staleRequest?.headers['next-action']).toBeTruthy();await page.request.post(`/venues/${id}/requirements`,{headers:staleRequest!.headers,data:Buffer.from(staleRequest!.body.toString().replaceAll('Documented arrangement','UNAUTHORIZED CHANGE'))});
 const db=new DatabaseSync('var/release-runtime.db');expect(JSON.parse((db.prepare('SELECT answers FROM venue_packages WHERE venue_id=?').get(id) as {answers:string}).answers)[keys[0]!]!.name).toBe(`Documented arrangement ${keys[0]}: medical team coverage and contact +9611234567.`);db.close();
 await signInAs(page,'test_ems');expect((await page.request.get(`/api/venue-documents/${id}/${keys[0]}`)).status()).toBe(404);
 await signInAs(page,'test_moph');await page.goto(`/ministry/venues/${id}`);await expect(page.locator('main')).toContainText('Documented arrangement');expect((await page.request.get(`/api/venue-documents/${id}/${keys[0]}?revision=1`)).status()).toBe(200);
 await page.locator('textarea[name=note]').fill('Clarify the contact number.');await page.getByRole('button',{name:'Request changes',exact:true}).click();await expect(page.locator('main')).toContainText('Clarify the contact number.');
 await signInAs(page,'test_organizer');await page.goto(`/venues/${id}/submit`);await page.locator('input[name=confirm]').check();await page.getByRole('button',{name:'Submit to the Ministry',exact:true}).click();await expect(page).toHaveURL(/submitted=yes/);
 await signInAs(page,'test_moph');await page.goto(`/ministry/venues/${id}`);await page.getByRole('button',{name:'Requirements satisfied',exact:true}).click();await expect(page.getByRole('button',{name:'Requirements satisfied',exact:true})).toHaveCount(0);
 await signInAs(page,'test_organizer');await page.goto(`/venues/${id}`);await expect(page.getByRole('link',{name:'Download venue certificate',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Renew certificate',exact:true})).toBeDisabled();
 await page.goto(`/venues/${id}/assessment`);await expect(page.getByRole('button',{name:'Save and view requirements',exact:true})).toHaveCount(0);
 // Advance only this disposable test record into the renewal window.
 const fixture=new DatabaseSync('var/release-runtime.db');fixture.prepare("UPDATE venues SET valid_until='2000-01-01' WHERE id=?").run(id);fixture.close();
 await page.goto(`/venues/${id}`);await page.getByRole('button',{name:'Renew certificate',exact:true}).click();await expect(page).toHaveURL(new RegExp(`${id}/details`));await expect(page.locator('input[name=name]')).toHaveValue('Venue acceptance test');await expect(page.locator('input[name=name]')).toBeEnabled();expect((await page.request.get(`/venues/${id}/certificate?version=1`)).status()).toBe(200);
 expect((await page.request.get(`/api/venue-documents/${id}/${keys[0]}?revision=1`)).status()).toBe(200);
 await page.screenshot({path:info.outputPath('venue-renewal.png'),fullPage:true});
});
