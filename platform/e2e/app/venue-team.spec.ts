import {test,expect,type Page} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';
import {openDetails} from '../helpers/record';
import {expectAbsent} from '../helpers/absence';

/** Fills the short form on one requirement card and saves it through the shared answer action. */
async function fillRow(page:Page,key:string){const r=await openDetails(page.locator(`[data-requirement="${key}"]`));const form=r.locator('[data-region=requirement-form]').first();for(const t of await form.locator('input[type=text]:enabled, textarea:enabled').all())await t.fill(`Confirmed ${key} coverage, staffing and contact +9613111111.`);for(const choice of await form.locator('fieldset:has([data-choice])').all())await choice.locator('[data-choice="yes"]').click();for(const n of await form.locator('input[type=number]:enabled').all())await n.fill('4');for(const c of await form.locator('input[type=checkbox]:enabled').all())await c.check();await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('Saved.');}
/** A plan section or major-incident item that carries its own text. */
async function fillText(page:Page,selector:string){const d=await openDetails(page.locator(selector));const form=d.locator('[data-region=requirement-form]').first();await form.locator('textarea:enabled').first().fill('Confirmed arrangement, reviewed with the operator.');await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('Saved.');}
async function upload(page:Page,key:string){const r=await openDetails(page.locator(`[data-requirement="${key}"]`));await r.locator('input[type=file]').setInputFiles({name:'venue-medical.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nMedical document')});await r.getByRole('button',{name:'Upload',exact:true}).click();await expect(page).toHaveURL(new RegExp(`saved=${key}`));}

test('venue medical team completes the shared record; the Director approves; the organizer submits; the Ministry reads the frozen record',async({page,browser,baseURL},info)=>{
 // The whole venue lifecycle in one walk, now through the nomination's account step and the receipt as well:
 // a cold dev server compiles every one of those routes inside this test, so it gets more than the project's 300s.
 test.setTimeout(480_000);
 await mockMapTiles(page);await signInAs(page,'test_organizer');await page.goto('/venues/new');
 for(const[k,v]of Object.entries({name:'Venue team browser test',nameAr:'موقع اختبار الفريق الطبي',address:'Beirut main road',contactName:'Venue operator',contactPhone:'+9613111111',capacity:'5000'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=category]').selectOption('hall');await page.locator('select[name=district]').selectOption('Beirut');await page.getByRole('button',{name:'Yes',exact:true}).first().click();await page.getByRole('button',{name:'No',exact:true}).nth(1).click();await chooseMapPoint(page);
 // ONE PAGE, like the event's intake (owner, 8 October 2026): the assessment sits under the details and one Continue records both.
 await expect(page.locator('[data-region=registration-assessment]')).toBeVisible();
 await page.getByLabel(/Most people at the same time during a routine operating session/).fill('5000');for(const d of await page.locator('[data-domain]').all())await d.locator('button').last().click();await page.getByLabel(/Authorized representative/).fill('Operator');await page.getByLabel(/Position/).fill('Manager');
 await page.getByRole('button',{name:'Continue to requirements',exact:true}).click();await expect(page).toHaveURL(/\/venues\/VN-\d+$/);const id=page.url().match(/VN-\d+/)![0];
 await expect(page.locator('[data-region=details-assessment]')).toContainText('Level 3');
 // THE SINGLE RECORD PAGE: the contact is prefilled from the venue details; the clinical rows take no organizer form.
 await expect(page.locator('[data-requirement="B1"]')).toHaveAttribute('data-state','complete');await expect(page.locator('[data-requirement="B8"] [data-region=requirement-form] button')).toHaveCount(0);expect((await page.request.get(`/venues/${id}/certificate`)).status()).toBe(404);
 await openDetails(page.locator('#final-review'));await expect(page.locator('[data-region=final-review]')).toBeVisible();await expect(page.getByRole('button',{name:/^Submit to the Ministry — \d+ remaining$/})).toBeDisabled();
 await page.goto(`/venues/${id}/details`);await expect(page.locator('[data-region=venue-details-read-only]')).toContainText('Venue operator');await expect(page.getByRole('button',{name:'Edit details',exact:true})).toBeVisible();await page.goto(`/venues/${id}/assessment`);await expect(page.getByRole('button',{name:'Save and view requirements',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit assessment',exact:true})).toBeVisible();
 // The organizer's own rows: emergency access, insurance (fields and evidence), the permanent site map.
 await page.goto(`/venues/${id}`);await fillRow(page,'B10');await fillRow(page,'B17');await upload(page,'B17');await upload(page,'P-M');
 const db=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const emails=Object.fromEntries(['ems','director'].map(role=>{const email=`browser-${role}@venue.example.test`;db.prepare('UPDATE accounts SET email=? WHERE login=?').run(email,`test_${role}`);return[role,email]}));db.close();
 // The Director is invited at an address no account holds yet: that walk creates the account from the invitation.
 emails['director']=`venue-director-${Date.now()}@venue.example.test`;
 // The invitations are sent from the rows that need the party: the EMS agency on the EMS row, the Director on the Director row.
 for(const [kind,key] of [['ems','B7'],['director','B3']] as const){await page.goto(`/venues/${id}`);const row=await openDetails(page.locator(`[data-requirement="${key}"]`));const f=row.locator('form[data-region=invite]');await f.locator('input[name=name]').fill(`Venue ${kind}`);await f.locator('input[name=email]').fill(emails[kind]!);await f.locator('button[type=submit]').click();await expect(page).toHaveURL(new RegExp(`invited=${kind}.*step=${key}`));await expect(page.locator('[data-region=handoff-dialog]')).toBeVisible();await page.locator('[data-region=handoff-close]').click();}
 // Only the EMS row invites the agency: the BLS row is a listing with its two confirmations.
 await openDetails(page.locator('[data-requirement="B5"]'));await expectAbsent(page,{anchor:'[data-requirement="B5"]',absent:'[data-requirement="B5"] form[data-region=invite]',because:'the EMS agency is invited once, on the EMS and ambulance row'});
 // The URL already reads invited= after the first invitation, so wait for both rows to exist.
 await expect.poll(()=>{const f=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const n=(f.prepare('SELECT COUNT(*) AS n FROM venue_invitations WHERE venue_id=?').get(id) as {n:number}).n;f.close();return n;}).toBe(2);
 const fixture=new DatabaseSync(process.env['E2E_DATABASE_PATH']!);const invitations=fixture.prepare('SELECT kind,token FROM venue_invitations WHERE venue_id=?').all(id) as unknown as {kind:string;token:string}[];fixture.close();
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-requirement="B7"]')).toHaveAttribute('data-state','waiting');
 const staff=await browser.newPage({baseURL:baseURL!});await signInAs(staff,'test_ems');expect((await staff.request.get(`/venue-team/${id}`)).status()).toBe(404);
 // THE SAME NOMINATION SCREEN AS AN EVENT'S (owner, 8 October 2026): the briefing, then the same three answers.
 await staff.goto(`/venue-invitations/${invitations.find(i=>i.kind==='ems')!.token}`);
 const briefing=staff.locator('[data-region=briefing][data-service=venue]');await expect(briefing.locator('[data-region=briefing-event]')).toContainText('Venue team browser test');await expect(briefing.locator('[data-region=briefing-event]')).toContainText('Level 3');
 await briefing.locator('[data-region=briefing-more] summary').click();
 // What the agency is asked to do: the rows the record resolver names it on at Level 3 -- its readiness declaration its alone; medical command is not its row.
 await expect(briefing.locator('[data-briefing-row="B20"]')).toContainText('Yours alone');await expect(briefing.locator('[data-briefing-row="B5"]')).toContainText('Shared');await expect(briefing.locator('[data-briefing-row="B15"]')).toHaveCount(0);
 await expect(briefing.locator('[data-region=briefing-parties]')).toContainText(`Venue director`);
 const respond=staff.locator('[data-region=respond]');await expect(respond).toContainText('Decline');await expect(respond).toContainText('Request further information');
 await respond.locator('button',{hasText:'Accept'}).first().click();await staff.getByRole('button',{name:'Accept the nomination',exact:true}).click();
 await expect(staff).toHaveURL(new RegExp(`/venue-team/${id}\\?notice=accepted`));await expect(staff.locator('[data-region=landing-notice]')).toContainText('Accepted. The operator has been told.');
 // THE SAME RECORD, OPEN TO THE AGENCY ON THE ROWS THAT NAME IT: the response team, not medical command or emergency access.
 await expect(staff.locator('[data-requirement="B5"] [data-region="save"]')).toHaveCount(1);
 const editable=await staff.locator('[data-step] > [data-requirement]').filter({has:staff.locator('[data-region="save"]')}).evaluateAll(rows=>rows.map(r=>r.getAttribute('data-requirement')!));
 expect(editable).toContain('B5');expect(editable).not.toContain('B15');expect(editable).not.toContain('B10');
 await expect(staff.locator('[data-requirement="B7"]')).toHaveAttribute('data-state','pending');
 for(const key of editable.filter(k=>k!=='B2'))await fillRow(staff,key);
 for(const section of ['P13','P14','P16'])await fillText(staff,`#plan-${section}`);
 await openDetails(staff.locator('#plan-P12'));for(const m of ['M01','M02','M04','M05','M06','M07','M08','M09','M10','M11'])await fillText(staff,`#req-${m}`);
 await upload(staff,'P-D');
 // The organizer reads the agency's answers at once, with who recorded them; the plan waits on the Director.
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-requirement="B5"]')).toHaveAttribute('data-state','complete');await expect((await openDetails(page.locator('[data-requirement="B5"]'))).locator('[data-region=answered-by]')).toContainText('Venue ems');await expect((await openDetails(page.locator('[data-requirement="B7"]'))).locator('textarea[name=units]')).toHaveValue(/Confirmed B7 coverage/);await expect(page.locator('[data-requirement="B2"]')).toHaveAttribute('data-state',/pending|waiting/);
 await openDetails(page.locator('#final-review'));await expect(page.locator('[data-remaining="B2"]')).toBeVisible();await expect(page.getByRole('button',{name:/^Submit to the Ministry — \d+ remaining$/})).toBeDisabled();
 // THE DIRECTOR HOLDS NO ACCOUNT YET: reads the invitation signed out, accepts, and completes the acceptance by creating the account -- the event's stage three.
 const director=await browser.newPage({baseURL:baseURL!});const directorToken=invitations.find(i=>i.kind==='director')!.token;await director.goto(`/venue-invitations/${directorToken}`);
 await expect(director.locator('h1[data-sec-h1]')).toContainText('You have been nominated as Medical Director');await expect(director.locator('[data-region=accepting]')).toBeVisible();
 await director.locator('[data-region=briefing-more] summary').click();await expect(director.locator('[data-briefing-row="B15"]')).toContainText('Yours alone');
 await expectAbsent(director,{anchor:'[data-region="respond"]',absent:'input[type="password"]',because:'accepting must never be the same click as being signed in'});
 await director.locator('[data-region=respond] button',{hasText:'Accept'}).first().click();await director.getByRole('button',{name:'Accept the nomination',exact:true}).click();
 await expect(director).toHaveURL(new RegExp(`/venue-invitations/${directorToken}/account$`));await expect(director.locator('[data-region=answer-recorded]')).toBeVisible();await expect(director.locator('[data-region=sign-in-instead]')).toBeVisible();
 const create=director.locator('[data-region=create-account]');await expect(create.locator('input[name=email]')).toHaveValue(emails['director']!);await expect(create.locator('input[name=email]')).not.toBeEditable();
 await create.locator('input[name=fullName]').fill('Venue Director Walk');await create.locator('input[name=phone]').fill('+9613111111');await create.locator('input[name=password]').fill('Venue-director-walk-2026');await create.getByRole('button',{name:'Create account and accept',exact:true}).click();
 await expect(director).toHaveURL(new RegExp(`/venue-team/${id}\\?notice=accepted`));await expect(director.locator('[data-region=landing-notice]')).toBeVisible();await fillRow(director,'B15');
 await director.goto(`/venue-team/${id}`);await openDetails(director.locator('[data-requirement="B2"]'));const approve=director.locator('[data-region=plan-approval]');await approve.locator('input[name=confirm]').check();await approve.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(director).toHaveURL(/approval=recorded/);
 await expect(director.locator('[data-requirement="B2"]')).toHaveAttribute('data-state','complete');
 // EACH AGENCY SIGNS ITS OWN DECLARATION on the row; nobody signs for it.
 await staff.goto(`/venue-team/${id}`);const declaration=(await openDetails(staff.locator('[data-requirement="B20"]'))).locator('[data-region=venue-declaration] form');await declaration.locator('input[type=file]').setInputFiles({name:'declaration.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSigned declaration')});await declaration.locator('input[name=confirm]').check();await declaration.getByRole('button',{name:'Sign the declaration',exact:true}).click();await expect(staff).toHaveURL(/saved=B20/);
 await expect(staff.locator('[data-requirement="B20"]')).toHaveAttribute('data-state','complete');
 // ONE SUBMIT AT THE FOOT OF THE RECORD: nothing remains but the operator's confirmation.
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-region=required-count]')).toContainText(/(\d+) of \1 complete/);await expect(page.getByRole('button',{name:'Submit to the Ministry — 1 remaining',exact:true})).toBeDisabled();await page.locator('[data-region=confirm-and-submit] input[name=confirm]').check();await expect(page.getByRole('button',{name:'Submit to the Ministry',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Submit to the Ministry',exact:true}).click();await expect(page).toHaveURL(/submitted=yes/);
 await expect(page.locator('[data-region=submitted-band]')).toBeVisible();
 // AS ON AN EVENT (owner, 8 October 2026): the record ID, and the acknowledgment of receipt one click away -- printable, with the status.
 const submitted=page.locator('[data-region=submitted-notice]');await expect(submitted).toContainText(`Submitted. The record ID is ${id}.`);
 await submitted.getByRole('link',{name:'Open the acknowledgment of receipt',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/venues/${id}/acknowledgment$`));
 const receipt=page.locator('[data-region=venue-acknowledgment]');await expect(receipt.locator('[data-region=record-id]')).toHaveText(id);await expect(receipt).toContainText('Venue team browser test');await expect(receipt.locator('[data-fact=level]')).toContainText('Level 3');await expect(receipt.locator('[data-fact=submission]')).toContainText('1');await expect(receipt.locator('[data-fact=submitted]')).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
 await expect(receipt.locator('[data-region=status-chip]')).toContainText('In process');await expect(receipt).toContainText('The Ministry reviews the submission and records one of three outcomes.');
 await expect(page.getByRole('button',{name:'Print',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Download as PDF',exact:true})).toBeVisible();
 // The record keeps the receipt one click away while the package is with the Ministry; nobody but the operator opens it.
 await page.goto(`/venues/${id}`);const underReview=page.locator('[data-next-action=underReview]');await expect(underReview).toContainText('In process');await underReview.getByRole('link',{name:'View acknowledgment of receipt'}).click();await expect(page).toHaveURL(new RegExp(`/venues/${id}/acknowledgment$`));
 expect((await staff.request.get(`/venues/${id}/acknowledgment`)).status()).toBe(404);
 await staff.reload();await expect(staff.locator('main')).toContainText('Read-only');await expect(staff.locator('main [data-region="save"]')).toHaveCount(0);
 // THE MINISTRY READS THE RECORD FROZEN AT SUBMISSION: each row's answer and author, the approval, the agency's signed declaration.
 await signInAs(director,'test_moph');await director.goto(`/ministry/venues/${id}`);const review=director.locator('#review-requirements');await expect(review).toContainText('Frozen at filing');await expect(review).toContainText('Approval recorded by');await expect((await openDetails(director.locator('[data-review-requirement="B7"]')))).toContainText('Confirmed B7 coverage');await expect(review.locator('[data-region=review-extra-files] a')).toHaveCount(1);await expect(review.locator('[data-region=review-missing]')).toHaveCount(0);
 await director.getByRole('button',{name:'Requirements satisfied',exact:true}).click();await expect(director).toHaveURL(/recorded=1/);
 // The receipt moves with the record: the status it carries is the Ministry's recorded result.
 await page.goto(`/venues/${id}/acknowledgment`);await expect(page.locator('[data-region=venue-acknowledgment] [data-region=status-chip]')).toContainText('Certificate ready');
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-next-action=underReview]')).toHaveCount(0);await expect(page.getByRole('link',{name:'Download venue certificate',exact:true})).toBeVisible();await expect(page.locator('[data-region=rail]')).toContainText('Stage 5 of 5');await page.screenshot({path:info.outputPath('venue-completed.png'),fullPage:true});await page.goto(`/venues/${id}/details`);await expect(page.getByRole('button',{name:'Edit details',exact:true})).toHaveCount(0);
 await staff.close();await director.close();
});
