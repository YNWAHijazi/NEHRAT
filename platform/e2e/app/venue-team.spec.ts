import {test,expect,type Page} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';

/** Opens a collapsible card or section and returns it. */
async function open(page:Page,selector:string){const r=page.locator(selector);if(await r.getAttribute('open')===null)await r.locator('summary').first().click();return r;}
/** Fills the short form on one requirement card and saves it through the shared answer action. */
async function fillRow(page:Page,key:string){const r=await open(page,`[data-requirement="${key}"]`);const form=r.locator('[data-region=requirement-form]').first();for(const t of await form.locator('input[type=text]:enabled, textarea:enabled').all())await t.fill(`Confirmed ${key} coverage, staffing and contact +9613111111.`);for(const n of await form.locator('input[type=number]:enabled').all())await n.fill('4');for(const c of await form.locator('input[type=checkbox]:enabled').all())await c.check();await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('Saved.');}
/** A plan section or major-incident item that carries its own text. */
async function fillText(page:Page,selector:string){const d=await open(page,selector);const form=d.locator('[data-region=requirement-form]').first();await form.locator('textarea:enabled').first().fill('Confirmed arrangement, reviewed with the operator.');await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('Saved.');}
async function upload(page:Page,key:string){const r=await open(page,`[data-requirement="${key}"]`);await r.locator('input[type=file]').setInputFiles({name:'venue-medical.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nMedical document')});await r.getByRole('button',{name:'Upload',exact:true}).click();await expect(page).toHaveURL(new RegExp(`saved=${key}`));}

test('venue medical team completes the shared record; the Director approves; the organizer submits; the Ministry reads the frozen record',async({page,browser,baseURL},info)=>{
 await mockMapTiles(page);await signInAs(page,'test_organizer');await page.goto('/venues/new');
 for(const[k,v]of Object.entries({name:'Venue team browser test',nameAr:'موقع اختبار الفريق الطبي',address:'Beirut main road',contactName:'Venue operator',contactPhone:'+9613111111',capacity:'5000'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=category]').selectOption('hall');await page.locator('select[name=district]').selectOption('Beirut');await page.getByRole('button',{name:'Yes',exact:true}).first().click();await page.getByRole('button',{name:'No',exact:true}).nth(1).click();await chooseMapPoint(page);await page.getByRole('button',{name:'Continue to assessment',exact:true}).click();await expect(page).toHaveURL(/\/VN-\d+\/assessment/);const id=page.url().match(/VN-\d+/)![0];
 await page.getByLabel(/Most people at the same time during a routine operating session/).fill('5000');for(const d of await page.locator('[data-domain]').all())await d.locator('button').last().click();await page.getByLabel(/Authorized representative/).fill('Operator');await page.getByLabel(/Position/).fill('Manager');await page.getByRole('button',{name:'Save and view requirements',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/venues/${id}#req-summary`));
 // THE SINGLE RECORD PAGE: the contact is prefilled from the venue details; the clinical rows take no organizer form.
 await expect(page.locator('[data-requirement="B1"]')).toHaveAttribute('data-state','complete');await expect(page.locator('[data-requirement="B8"] [data-region=requirement-form] button')).toHaveCount(0);expect((await page.request.get(`/venues/${id}/certificate`)).status()).toBe(404);
 await expect(page.locator('[data-region=final-review]')).toBeVisible();await expect(page.getByRole('button',{name:/^Submit to the Ministry — \d+ remaining$/})).toBeDisabled();
 await page.goto(`/venues/${id}/details`);await expect(page.locator('[data-region=venue-details-read-only]')).toContainText('Venue operator');await expect(page.getByRole('button',{name:'Edit details',exact:true})).toBeVisible();await page.goto(`/venues/${id}/assessment`);await expect(page.getByRole('button',{name:'Save and view requirements',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit assessment',exact:true})).toBeVisible();
 // The organizer's own rows: emergency access, insurance (fields and evidence), the permanent site map.
 await page.goto(`/venues/${id}`);await fillRow(page,'B10');await fillRow(page,'B17');await upload(page,'B17');await upload(page,'P-M');
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const emails=Object.fromEntries(['ems','director'].map(role=>{const email=`browser-${role}@venue.example.test`;db.prepare('UPDATE accounts SET email=? WHERE login=?').run(email,`test_${role}`);return[role,email]}));db.close();
 await page.goto(`/venues/${id}/team`);
 for(const kind of ['ems','director']){const f=page.locator('form').filter({has:page.locator(`input[name=kind][value=${kind}]`)});await f.locator('input[name=name]').fill(`Venue ${kind}`);await f.locator('input[name=email]').fill(emails[kind]!);await f.getByRole('button',{name:'Send invitation',exact:true}).click();await expect(page).toHaveURL(/invited=yes/);}
 // The URL already reads invited=yes after the first invitation, so wait for both rows to exist.
 await expect.poll(()=>{const f=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const n=(f.prepare('SELECT COUNT(*) AS n FROM venue_invitations WHERE venue_id=?').get(id) as {n:number}).n;f.close();return n;}).toBe(2);
 const fixture=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const invitations=fixture.prepare('SELECT kind,token FROM venue_invitations WHERE venue_id=?').all(id) as unknown as {kind:string;token:string}[];fixture.close();
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-requirement="B7"]')).toHaveAttribute('data-state','waiting');
 const staff=await browser.newPage({baseURL:baseURL!});await signInAs(staff,'test_ems');expect((await staff.request.get(`/venue-team/${id}`)).status()).toBe(404);
 await staff.goto(`/venue-invitations/${invitations.find(i=>i.kind==='ems')!.token}`);await staff.locator('input[name=phone]').fill('+9613111111');await staff.getByRole('button',{name:'Accept invitation',exact:true}).click();await expect(staff).toHaveURL(new RegExp(`/venue-team/${id}`));
 // THE SAME RECORD, OPEN TO THE AGENCY ON THE ROWS THAT NAME IT: the response team, not medical command or emergency access.
 const editable=await staff.locator('[data-group=required] > [data-requirement]').filter({has:staff.getByRole('button',{name:'Save',exact:true})}).evaluateAll(rows=>rows.map(r=>r.getAttribute('data-requirement')!));
 expect(editable).toContain('B5');expect(editable).not.toContain('B15');expect(editable).not.toContain('B10');
 await expect(staff.locator('[data-requirement="B7"]')).toHaveAttribute('data-state','pending');
 for(const key of editable.filter(k=>k!=='B2'))await fillRow(staff,key);
 for(const section of ['P13','P14','P16'])await fillText(staff,`#plan-${section}`);
 await open(staff,'#plan-P12');for(const m of ['M01','M02','M04','M05','M06','M07','M08','M09','M10','M11'])await fillText(staff,`#req-${m}`);
 await upload(staff,'P-D');
 // The organizer reads the agency's answers at once, with who recorded them; the plan waits on the Director.
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-requirement="B5"]')).toHaveAttribute('data-state','complete');await expect((await open(page,'[data-requirement="B5"]')).locator('[data-region=answered-by]')).toContainText('Venue ems');await expect(page.locator('[data-requirement="B7"]')).toContainText('Confirmed B7 coverage');await expect(page.locator('[data-requirement="B2"] summary')).toContainText('Waiting');
 await expect(page.locator('[data-remaining="B2"]')).toBeVisible();await expect(page.getByRole('button',{name:/^Submit to the Ministry — \d+ remaining$/})).toBeDisabled();
 const director=await browser.newPage({baseURL:baseURL!});await signInAs(director,'test_director');await director.goto(`/venue-invitations/${invitations.find(i=>i.kind==='director')!.token}`);await director.locator('input[name=phone]').fill('+9613111111');await director.locator('input[name=licence]').fill('LIC-TEST');await director.getByRole('button',{name:'Accept invitation',exact:true}).click();await expect(director).toHaveURL(new RegExp(`/venue-team/${id}`));await fillRow(director,'B15');
 await director.goto(`/venue-team/${id}`);await open(director,'[data-requirement="B2"]');const approve=director.locator('[data-region=plan-approval]');await approve.locator('input[name=confirm]').check();await approve.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(director).toHaveURL(/approval=recorded/);
 await expect(director.locator('[data-requirement="B2"]')).toHaveAttribute('data-state','complete');
 // EACH AGENCY SIGNS ITS OWN DECLARATION on the row; nobody signs for it.
 await staff.goto(`/venue-team/${id}`);const declaration=(await open(staff,'[data-requirement="B20"]')).locator('[data-region=venue-declaration] form');await declaration.locator('input[type=file]').setInputFiles({name:'declaration.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSigned declaration')});await declaration.locator('input[name=confirm]').check();await declaration.getByRole('button',{name:'Sign the declaration',exact:true}).click();await expect(staff).toHaveURL(/saved=B20/);
 await expect(staff.locator('[data-requirement="B20"]')).toHaveAttribute('data-state','complete');
 // ONE SUBMIT AT THE FOOT OF THE RECORD: nothing remains but the operator's confirmation.
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-region=required-count]')).toContainText(/(\d+) of \1 complete/);await expect(page.getByRole('button',{name:'Submit to the Ministry — 1 remaining',exact:true})).toBeDisabled();await page.locator('[data-region=confirm-and-submit] input[name=confirm]').check();await expect(page.getByRole('button',{name:'Submit to the Ministry',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Submit to the Ministry',exact:true}).click();await expect(page).toHaveURL(/submitted=yes/);
 await expect(page.locator('[data-region=submitted-band]')).toBeVisible();
 await staff.reload();await expect(staff.locator('main')).toContainText('Read-only');await expect(staff.locator('main').getByRole('button',{name:'Save',exact:true})).toHaveCount(0);
 // THE MINISTRY READS THE RECORD FROZEN AT SUBMISSION: each row's answer and author, the approval, the agency's signed declaration.
 await signInAs(director,'test_moph');await director.goto(`/ministry/venues/${id}`);const review=director.locator('#review-requirements');await expect(review).toContainText('Frozen at filing');await expect(review).toContainText('Approval recorded by');await expect((await open(director,'[data-review-requirement="B5"]'))).toContainText('Confirmed B5 coverage');await expect(review.locator('[data-region=review-extra-files] a')).toHaveCount(1);await expect(review.locator('[data-region=review-missing]')).toHaveCount(0);
 await director.getByRole('button',{name:'Requirements satisfied',exact:true}).click();await expect(director).toHaveURL(/recorded=1/);
 await page.goto(`/venues/${id}`);await expect(page.getByRole('link',{name:'Download venue certificate',exact:true})).toBeVisible();await expect(page.locator('[data-region=rail]')).toContainText('Stage 5 of 5');await page.screenshot({path:info.outputPath('venue-completed.png'),fullPage:true});await page.goto(`/venues/${id}/details`);await expect(page.getByRole('button',{name:'Edit details',exact:true})).toHaveCount(0);
 await staff.close();await director.close();
});
