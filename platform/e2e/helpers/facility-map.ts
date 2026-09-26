import { expect,type Page } from '@playwright/test';
import { PNG } from 'pngjs';
export async function mockMapTiles(page:Page){const png=new PNG({width:256,height:256});png.data.fill(240);await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:PNG.sync.write(png)}));}
export async function chooseMapPoint(page:Page,prefix='map') {const picker=page.locator(`[data-map-picker=${prefix}]`);const place=picker.getByRole('button',{name:/Place pin at map center/});await expect(place).toBeEnabled();await place.click();await picker.locator('input[type=checkbox]').check();}
export async function fillFacilityProfile(page:Page){
 await mockMapTiles(page);
 await page.goto('/facilities/new');
 for(const[k,v]of Object.entries({name:'PAD browser facility',address:'Main road',municipality:'Beirut',phone:'+9611234567',email:'facility@example.com',accessPoint:'North gate',emsNumber:'140'}))await page.locator(`input[name=${k}]`).fill(v);
 await page.locator('select[name=hours]').selectOption({index:1});await chooseMapPoint(page);
 await page.getByRole('button',{name:/Continue to the category/}).click();
}
