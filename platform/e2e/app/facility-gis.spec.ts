import {expect,test} from '@playwright/test';
import {PNG} from 'pngjs';
import {signInAs} from '../helpers/signin';
import {fillFacilityProfile,chooseMapPoint} from '../helpers/facility-map';

/** A real PNG, so the photo passes the same allow-list the server enforces. */
function aedPhoto():Buffer{const png=new PNG({width:8,height:8});png.data.fill(90);return PNG.sync.write(png);}

test('facility registers a map, one contact, a lean AED with a photo, the plan and an incident; the certificate issues; Ministry can read and map it',async({page})=>{
 page.setDefaultTimeout(15000);
 await signInAs(page,'test_organizer');await fillFacilityProfile(page);await page.getByRole('button',{name:/Gyms, fitness centres/}).click();
 // ONE responsible contact (partner audit, 2026-10-08), on the same page as the profile (owner, 9 October 2026): no alternate, no assigned guide.
 await expect(page.getByRole('heading',{name:/Responsible contact/})).toBeVisible();
 await expect(page.locator('input[name=alternateName]')).toHaveCount(0);await expect(page.locator('input[name=emsGuideName]')).toHaveCount(0);
 await page.locator('input[name=coordinatorName]').fill('Facility manager');await page.locator('input[name=coordinatorPhoneNumber]').fill('+9611234567');await page.locator('input[name=coordinatorEmail]').fill('facility@example.com');await page.getByRole('button',{name:'Continue to the AEDs',exact:true}).click();await expect(page).toHaveURL(/\/facilities\/FC-\d+$/);
 const id=page.url().match(/FC-\d+/)![0];
 // The record opens on its AED step.
 await expect(page.locator('[data-step-item=aeds]')).toHaveAttribute('data-step-state','current');
 // The lean AED record: no maintenance dates, no annual confirmation, no coordinator on the card.
 await expect(page.locator('input[name=padExpiry]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Annual readiness confirmation'})).toHaveCount(0);await expect(page.locator('[data-region=device-card]')).not.toContainText('Coordinator');
 const aedStep=page.locator('#aeds');await aedStep.locator('input[name=identification]').fill('GIS-SERIAL-1');await aedStep.locator('input[name=location]').fill('Reception');await aedStep.locator('input[name=photo]').setInputFiles({name:'aed.png',mimeType:'image/png',buffer:aedPhoto()});await aedStep.locator('input[name=representative]').fill('Facility manager');await aedStep.getByRole('button',{name:'Register device',exact:true}).click();await expect(page).toHaveURL(/notice=saved/);
 const table=page.locator('[data-region=registry-table]');await expect(table).toContainText('GIS-SERIAL-1');await expect(table).toContainText('Operational');await expect(table).not.toContainText('Readiness');
 // The stored photo is shown on the device record, served through the allow-list route.
 await table.locator('button').first().click();await expect(page.locator('[data-region=device-photo] img')).toBeVisible();expect((await page.request.get(`/api/facility-device-photos/${id}/AED-001`)).headers()['content-type']).toBe('image/png');
 // On through the steps: the contact, then the plan.
 await page.locator('[data-region=step-next]').click();await expect(page.locator('[data-step-item=contact]')).toHaveAttribute('data-step-state','current');await expect(page.locator('#contact input[name=coordinatorName]')).toHaveValue('Facility manager');
 await page.locator('[data-region=step-next]').click();await expect(page.locator('[data-step-item=plan]')).toHaveAttribute('data-step-state','current');
 // The plan: AED information, the contact read-only with an Edit link, step 6's new wording, the readiness confirmation.
 const planStep=page.locator('#plan');
 await expect(planStep.locator('[data-region=derived]')).toContainText('AED information');await expect(planStep.locator('[data-region=derived]')).not.toContainText('Latest readiness check');
 await expect(planStep.locator('[data-region=plan-contact]')).toContainText('Facility manager');await expect(planStep.locator('[data-region=plan-contact]').getByRole('link',{name:'Edit contact',exact:true})).toHaveAttribute('href','#contact');await expect(page.locator('[data-region=plan-persons]')).toHaveCount(0);
 await expect(planStep.locator('[data-region=procedure]')).toContainText('Ensure EMS personnel are met or directed promptly to the patient');
 const checks=planStep.locator('[data-region=readiness-checks]');await expect(checks.locator('button[aria-pressed=false]')).toHaveCount(6);while(await checks.locator('button[aria-pressed=false]').count())await checks.locator('button[aria-pressed=false]').first().click();await checks.locator('input[name=drillDate]').fill('2026-08-01');
 // Review and register: the facility confirmation completes the registration.
 await page.locator('[data-region=step-next]').click();const review=page.locator('#final-review');await expect(review.locator('[data-region=facility-confirmation]')).toContainText('The facility confirms that this plan is current');await expect(review.locator('input[name=representative]')).toHaveValue('Facility manager');
 await review.getByRole('button',{name:'Complete the registration',exact:true}).click();await expect(page).toHaveURL(/notice=confirmed/);
 // THE CERTIFICATE issues once the registration is complete, and verifies publicly by token.
 await expect(page.locator('[data-region=registered-band]')).toContainText(`Registered. The record ID is ${id}.`);await page.getByRole('link',{name:'Open the certificate',exact:true}).click();await expect(page.locator('[data-region=certificate]')).toContainText('Facility registration certificate');await expect(page.locator('[data-region=certificate]')).toContainText(id);
 const verifyUrl=await page.locator('[data-region=certificate-verification] a').getAttribute('href');expect(verifyUrl).toMatch(/\/lookup\/facility\/[a-f0-9]{48}$/);await expect(page.locator('[data-region=certificate-demo-note]')).toBeVisible();
 // Managed from the same page: relocating an AED makes the confirmation stale; the facility stays registered.
 await page.goto(`/facilities/${id}`);const aeds=page.locator('#aeds');await aeds.locator('[data-region=registry-table] button').first().click();await aeds.getByRole('button',{name:'Relocation',exact:true}).click();await aeds.locator('input[name=location]').fill('Pool entrance');await aeds.getByRole('checkbox',{name:/Use a separate map pin for this AED/}).check();await chooseMapPoint(page,'aedMap');await aeds.locator('input[name=representative]').fill('Facility manager');await aeds.getByRole('button',{name:'Save new location',exact:true}).click();await expect(page).toHaveURL(/notice=saved/);
 await expect(page.locator('[data-region=section-status]')).toBeVisible();await expect(page.locator('[data-region=registration-pending]')).toContainText('Readiness confirmation');
 await expect(page.locator('#plan').getByText('The facility or AED details changed. Review and confirm the updated plan.',{exact:true})).toBeVisible();
 await page.goto(`/facilities/${id}/incidents/new`);await page.locator('input[name=date]').fill('2026-08-12');await page.locator('input[name=time]').fill('12:30');await page.locator('input[name=location]').fill('Pool entrance');
 // Select each answer row independently (six immediate, one attendance, two post-incident).
 for(const region of ['immediate-response','ems-attendance','post-incident'])for(const b of await page.locator(`[data-region=${region}]`).getByRole('button',{name:'Yes',exact:true}).all())await b.click();
 await page.getByRole('button',{name:'EMS ambulance',exact:true}).click();await page.locator('textarea[name=corrective]').fill('Replace the used electrode pads.');await page.getByRole('button',{name:'Submit report',exact:true}).click();await expect(page).toHaveURL(/notice=incident/);
 const incidents=page.locator('[data-region=incidents]');await incidents.locator('details summary').first().click();await expect(incidents).toContainText('Replace the used electrode pads.');expect((await page.request.get('/api/facilities/geojson')).status()).toBe(404);
 // The verification page is public. Every seeded account is a DEMONSTRATION account, so
 // the facility this test registered is a demo row and must not resolve on the public
 // register (non-negotiable 8) -- the certificate said so. A real registration resolves
 // through the same token (tests/facility-gis.test.ts covers the lookup itself).
 await page.context().clearCookies();await page.goto(verifyUrl!);await expect(page.locator('[data-region=lookup-result]')).toContainText('No certificate answers that');await expect(page.locator('[data-region=lookup-result]')).not.toContainText('Facility manager');await expect(page.locator('[data-region=lookup-result]')).not.toContainText('facility@example.com');
 await page.goto('/lookup/facility/000000000000000000000000000000000000000000000000');await expect(page.locator('[data-region=lookup-result]')).toContainText('No certificate answers that');
 await signInAs(page,'test_moph');await page.goto('/ministry/facilities/map');await expect(page.locator('main')).toContainText(id);const response=await page.request.get('/api/facilities/geojson');expect(response.status()).toBe(200);const json=await response.json();expect(json.features.some((f:{properties:{id:string}})=>f.properties.id===`${id}/AED-001`)).toBe(true);await page.goto(`/ministry/facilities/reports?facility=${id}`);await page.locator('details summary').first().click();await expect(page.locator('main')).toContainText('Replace the used electrode pads.');
});

test('facility maps and forms fit a narrow phone in English and Arabic',async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:800});await signInAs(page,'test_organizer');
 await fillFacilityProfile(page);
 // The one-page intake fits first, then the organizer's seeded facility's details screen.
 await expect(page.locator('[data-map-picker]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.goto('/facilities/FC-0014/profile');await expect(page.getByRole('heading',{name:'Facility details',exact:true})).toBeVisible();
 for(const lang of ['en','ar']){
  if(lang==='ar')await page.getByRole('button',{name:'العربية',exact:true}).click();
  await expect(page.locator('[data-map-picker]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`facility-profile-${lang}.png`),fullPage:true});
 }
});
