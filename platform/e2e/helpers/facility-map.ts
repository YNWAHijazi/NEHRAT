import { expect,type Page } from '@playwright/test';
import { PNG } from 'pngjs';
export async function mockMapTiles(page:Page){const png=new PNG({width:256,height:256});png.data.fill(240);await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:PNG.sync.write(png)}));}
export async function chooseMapPoint(page:Page,prefix='map') {const picker=page.locator(`[data-map-picker=${prefix}]`);const place=picker.getByRole('button',{name:/Place pin at map center/});await expect(place).toBeEnabled();await place.click();await picker.locator('input[type=checkbox]').check();}

/**
 * The facility's one-page intake (owner, 9 October 2026): fills the profile, the map pin and
 * what a responding crew needs. The category and the responsible contact are on the same
 * page; the caller picks the category, since that is what most facility tests are about.
 */
export async function fillFacilityProfile(page:Page){
 await mockMapTiles(page);
 await page.goto('/facilities/new');
 for(const[k,v]of Object.entries({name:'PAD browser facility',address:'Main road',municipality:'Beirut',phoneNumber:'+9611234567',email:'facility@example.com',accessPoint:'North gate',emsNumber:'140'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=hours]').selectOption({index:1});await chooseMapPoint(page);
}

/** The whole intake: profile, category, the one responsible contact, Continue. Lands on the new record; returns its id. */
export async function registerFacility(page:Page,category:RegExp=/Gyms, fitness centres/,contact={name:'Facility manager',phone:'+9611234567',email:'facility@example.com'}):Promise<string>{
 await fillFacilityProfile(page);
 await page.getByRole('button',{name:category}).click();
 await page.locator('input[name=coordinatorName]').fill(contact.name);
 await page.locator('input[name=coordinatorPhoneNumber]').fill(contact.phone);
 await page.locator('input[name=coordinatorEmail]').fill(contact.email);
 await page.getByRole('button',{name:'Continue to the AEDs',exact:true}).click();
 await page.waitForURL(/\/facilities\/FC-\d+$/);
 return page.url().match(/FC-\d+/)![0];
}
