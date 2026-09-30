import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {signInAs} from '../helpers/signin';
import {mockMapTiles,chooseMapPoint} from '../helpers/facility-map';
import {useLanguage} from '../helpers/language';

for(const lang of ['en','ar'] as const)for(const width of [1280,375])test(`venue and facility tabs stay aligned (${lang}, ${width})`,async({page,context},info)=>{
 await useLanguage(context,lang);await page.setViewportSize({width,height:900});await mockMapTiles(page);await signInAs(page,'test_organizer');
 for(const [service,id,paths] of [['venue','VN-0032',['','/details','/assessment','/team','/requirements','/submit']],['facility','FC-0014',['','/profile','/devices','/plan','/submit','/incidents']]] as const){
  let y:number|undefined;let identity:string|undefined;
  for(const path of paths){await page.goto(`/${service==='venue'?'venues':'facilities'}/${id}${path}`);const h=page.locator(`[data-region=${service}-workspace-header]`);await expect(h).toBeVisible();await page.evaluate(()=>document.fonts.ready);const nav=h.locator('nav');await expect(nav.locator('[aria-current=page]')).toHaveCount(1);const top=(await nav.boundingBox())!.y;if(y===undefined)y=top;expect(Math.abs(top-y)).toBeLessThanOrEqual(1);const t=await h.locator('[data-region=record-header]').innerText();if(identity===undefined)identity=t;expect(t).toBe(identity);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
  await page.screenshot({path:info.outputPath(`${service}-${lang}-${width}.png`),fullPage:true});
 }
});
