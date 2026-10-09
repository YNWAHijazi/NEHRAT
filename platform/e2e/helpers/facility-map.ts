import { expect,type Page } from '@playwright/test';
import { PNG } from 'pngjs';
export async function mockMapTiles(page:Page){const png=new PNG({width:256,height:256});png.data.fill(240);await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:PNG.sync.write(png)}));}
export async function chooseMapPoint(page:Page,prefix='map') {const picker=page.locator(`[data-map-picker=${prefix}]`);const place=picker.getByRole('button',{name:/Place pin at map center/});await expect(place).toBeEnabled();await place.click();await picker.locator('input[type=checkbox]').check();}

/** The button that leaves the one-page intake for the record's step path. */
export const CONTINUE = 'Continue to requirements';

/**
 * The facility/site's one-page intake (latest revision, 9 October 2026): fills the site
 * profile -- the operating organization included -- the map pin and what a responding crew
 * needs. The category and the responsible contact are on the same page; the caller picks the
 * category, since that is what most facility tests are about.
 */
export async function fillFacilityProfile(page:Page){
 await mockMapTiles(page);
 await page.goto('/facilities/new');
 for(const[k,v]of Object.entries({name:'PAD browser facility',operatingOrganization:'PAD browser operator',address:'Main road',municipality:'Beirut',phoneNumber:'+9611234567',email:'facility@example.com',accessPoint:'North gate',emsNumber:'140'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=hours]').selectOption({index:1});await chooseMapPoint(page);
}

/** The whole intake: profile, category, the one responsible contact, Continue. Lands on the new record; returns its id. */
export async function registerFacility(page:Page,category:RegExp=/Sports and fitness facilities/,contact={name:'Facility manager',phone:'+9611234567',email:'facility@example.com'},extra:Record<string,string>={}):Promise<string>{
 await fillFacilityProfile(page);
 await page.getByRole('button',{name:category}).click();
 for(const[k,v]of Object.entries(extra))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('input[name=coordinatorName]').fill(contact.name);
 await page.locator('input[name=coordinatorPhoneNumber]').fill(contact.phone);
 await page.locator('input[name=coordinatorEmail]').fill(contact.email);
 await page.getByRole('button',{name:CONTINUE,exact:true}).click();
 await page.waitForURL(/\/facilities\/FC-\d+$/);
 return page.url().match(/FC-\d+/)![0];
}

/** Registers one AED on the record's AED step (or tab): the lean record, signed by the facility representative. */
export async function registerAed(page:Page,serial:string,location='Reception'){
 const aeds=page.locator('#aeds');
 if(!(await aeds.isVisible()))await page.goto(`${new URL(page.url()).pathname}?step=aeds#aeds`);
 await expect(aeds).toBeVisible();
 await aeds.locator('input[name=identification]').fill(serial);
 await aeds.locator('input[name=location]').fill(location);
 await aeds.locator('input[name=representative]').fill('Facility manager');
 await aeds.getByRole('button',{name:'Register device',exact:true}).click();
 await page.waitForURL(/notice=saved/);
}

/** Records the readiness confirmation: the six confirmations, the drill date, the representative. */
export async function recordReadiness(page:Page,drillDate='2026-08-01'){
 const form=page.locator('[data-region=plan-confirmation]');
 // The confirmation step while in preparation; the cardiac-readiness tab (?step=confirmation lands there) once submitted.
 if(!(await form.isVisible()))await page.goto(`${new URL(page.url()).pathname}?step=confirmation`);
 await expect(form).toBeVisible();
 while(await form.locator('button[aria-pressed=false]').count())await form.locator('button[aria-pressed=false]').first().click();
 await form.locator('input[name=drillDate]').fill(drillDate);
 await form.locator('input[name=representative]').fill('Facility manager');
 await form.getByRole('button',{name:'Record the readiness confirmation',exact:true}).click();
 await page.waitForURL(/notice=confirmed/);
}

/**
 * Review and submit, as an event files: open the final step, sign the declaration (the
 * representative starts as the signed-in person), submit. Lands on the acknowledgment.
 */
export async function submitRegistration(page:Page){
 const review=page.locator('#final-review');
 if(!(await review.isVisible()))await page.goto(`${new URL(page.url()).pathname}?step=review`);
 await expect(review).toBeVisible();
 await review.locator('input[name=confirm]').check();
 if(!(await review.locator('input[name=representative]').inputValue()))await review.locator('input[name=representative]').fill('Facility manager');
 await review.locator('input[name=position]').fill('Operations manager');
 await review.locator('[data-region=submit-registration]').click();
 await page.waitForURL(/\/acknowledgment$/);
}
