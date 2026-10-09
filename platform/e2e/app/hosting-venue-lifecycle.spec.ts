import {test,expect,type Page} from '@playwright/test';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';
import {openDetails} from '../helpers/record';
import {expectAbsent} from '../helpers/absence';

/**
 * THE HOSTING VENUE, END TO END IN THE BROWSER (Hosting Venue Registration, revised logic,
 * 8 October 2026): one page of details and assessment; the venue's own steps -- its
 * infrastructure and its AEDs -- filled by the operator alone, with no invitation anywhere;
 * one Submit; the filed view reads as an event's; the Ministry records the outcome; the
 * annual certificate carries the partner's wording.
 */
async function fillRow(page:Page,key:string,choice?:string){
 const r=await openDetails(page.locator(`[data-requirement="${key}"]`));const form=r.locator('[data-region=requirement-form]').first();
 for(const set of await form.locator('fieldset:has([data-choice])').all())await (choice?set.locator(`[data-choice="${choice}"]`):set.locator('[data-choice]').first()).click();
 for(const t of await form.locator('input[type=text]:enabled, textarea:enabled').all())await t.fill(`Recorded ${key}: east gate, loading bay, stairs A and B.`);
 for(const c of await form.locator('input[type=checkbox]:enabled').all())await c.check();
 await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('Saved.');
}

test('a Level 3 hosting venue: infrastructure and AEDs by the operator, submitted, determined and certified',async({page,browser,baseURL},info)=>{
 test.setTimeout(420_000);
 await mockMapTiles(page);await signInAs(page,'test_organizer');await page.goto('/venues/new');
 for(const[k,v]of Object.entries({name:'Venue baseline browser test',nameAr:'موقع اختبار خط الأساس',address:'Beirut main road',contactName:'Venue operator',contactPhoneNumber:'+9613111111',capacity:'5000'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=category]').selectOption('hall');await page.locator('select[name=district]').selectOption('Beirut');await page.getByRole('button',{name:'Yes',exact:true}).first().click();await page.getByRole('button',{name:'No',exact:true}).nth(1).click();await chooseMapPoint(page);
 await page.getByLabel(/Most people at the same time during a routine operating session/).fill('5000');for(const d of await page.locator('[data-domain]').all())await d.locator('button').last().click();await page.getByLabel(/Authorized representative/).fill('Operator');await page.getByLabel(/Position/).fill('Manager');
 await page.getByRole('button',{name:'Continue to requirements',exact:true}).click();await expect(page).toHaveURL(/\/venues\/VN-\d+$/);const id=page.url().match(/VN-\d+/)![0];
 await expect(page.locator('[data-region=details-assessment]')).toContainText('Level 3');
 // The place has its site; the rail is the document's six stages.
 await expect(page.locator('[data-region=record-header]')).toContainText(/SITE-\d{6}/);
 const rail=page.locator('[data-region=rail]');for(const s of ['Venue profile','Annual assessment','Infrastructure and access','AEDs','Review and submit','Annual certificate'])await expect(rail).toContainText(s);
 // The venue's own steps, and nothing that belongs to an event: no Director, no EMS agency, no plan, no invitation.
 const steps=await page.locator('[data-step] > [data-requirement]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-requirement')!));
 // Required steps first; the optional one sits in the recommended group, as on an event.
 expect(steps).toEqual(['V1','V2','V3','V4','V5','V7','V6']);
 await expectAbsent(page,{anchor:'[data-region=record-requirements]',absent:'form[data-region=invite], [data-region=record-guide], [data-region=handoff-dialog]',because:'a hosting venue names no EMS agency or Medical Director; each event does'});
 for(const key of ['V2','V3','V5'])await fillRow(page,key);
 await fillRow(page,'V4','no');
 await fillRow(page,'V1','indoor');await expect(page.locator('[data-requirement="V1"]')).toHaveAttribute('data-state','pending');
 const map=await openDetails(page.locator('[data-requirement="V1"]'));await map.locator('input[type=file]').setInputFiles({name:'layout.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nLayout map')});await map.getByRole('button',{name:'Upload',exact:true}).click();await expect(page).toHaveURL(/saved=V1/);
 await expect(page.locator('[data-requirement="V1"]')).toHaveAttribute('data-state','complete');
 // The AEDs: none linked, so the operator may link one, start one for this place, or record that there is none.
 const pad=(await openDetails(page.locator('[data-requirement="V7"]'))).locator('[data-region=venue-pad]');
 await expect(pad).toHaveAttribute('data-linked','false');await expect(pad.locator('[data-region=venue-pad-register]')).toHaveAttribute('href',`/facilities/new?fromVenue=${id}`);
 await fillRow(page,'V7');await expect(page.locator('[data-requirement="V7"]')).toHaveAttribute('data-state','complete');
 // One Submit at the foot of the record.
 await page.goto(`/venues/${id}`);await openDetails(page.locator('#final-review'));
 await page.locator('[data-region=confirm-and-submit] input[name=confirm]').check();await page.getByRole('button',{name:'Submit to the Ministry',exact:true}).click();await expect(page).toHaveURL(/submitted=yes/);
 // AS ON AN EVENT (owner, 8 October 2026): the receipt band, then the declaration as signed, read-only.
 const submitted=page.locator('[data-region=submitted-notice]');await expect(submitted).toContainText(`Submitted. The record ID is ${id}.`);
 await page.goto(`/venues/${id}`);await expect(page.locator('[data-region=submitted-notice]')).toContainText(`Submitted. The record ID is ${id}.`);
 const declared=page.locator('[data-region=filed-declaration]');await expect(declared).toContainText('Operator declaration');await expect(declared.locator('input').first()).toHaveValue('Operator');await expect(declared.locator('input').first()).toBeDisabled();
 await page.screenshot({path:info.outputPath('venue-filed.png'),fullPage:true});
 await page.locator('[data-region=submitted-notice]').getByRole('link',{name:'Open the acknowledgment of receipt',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/venues/${id}/acknowledgment$`));
 await expect(page.locator('[data-region=venue-acknowledgment] [data-region=status-chip]')).toContainText('In process');
 // The Ministry reads the frozen venue record and records the outcome.
 const moph=await browser.newPage({baseURL:baseURL!});await signInAs(moph,'test_moph');await moph.goto(`/ministry/venues/${id}`);
 await expect(moph.locator('#review-requirements')).toContainText('Frozen at filing');await expect(await openDetails(moph.locator('[data-review-requirement="V2"]'))).toContainText('Recorded V2');
 await moph.getByRole('button',{name:'Requirements satisfied',exact:true}).click();await expect(moph).toHaveURL(/recorded=1/);await moph.close();
 // The annual certificate, in the partner's words.
 await page.goto(`/venues/${id}`);await expect(rail).toContainText('Stage 6 of 6');
 await page.getByRole('link',{name:'Open the certificate',exact:true}).click();
 const cert=page.locator('[data-region=certificate]');
 await expect(cert.locator('h1 [data-l=en]')).toHaveText('Hosting Venue Annual Health & Medical Readiness Certificate');
 await expect(cert.locator('[data-region=certificate-classification] [data-l=en]')).toHaveText('Annual NEHRAT Classification: Level 3');
 await expect(cert.locator('[data-region=certificate-scope]')).toContainText('Each event held at the venue remains subject to its own event registration');
 await expect(cert.locator('[data-region=certificate-scope]')).toContainText('does not mean that EMS or an Event Medical Director is permanently provided');
 await page.screenshot({path:info.outputPath('venue-certificate.png'),fullPage:true});
});
