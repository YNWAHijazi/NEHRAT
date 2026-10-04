import { test, expect } from '@playwright/test';
import { signInAs, LANDING } from '../helpers/signin';

for (const [login, title] of [
  ['test_organizer','Start a service'], ['test_ems','Open an event'], ['test_director','Open an event'],
  ['test_moph','Choose a service'], ['test_moph_admin','Choose a service'], ['test_owner','Manage the platform'],
]) test(`optional role tour: ${login}`, async ({page}) => {
  await signInAs(page,login!);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-quick-tour]')).toHaveCount(0);
  await page.getByRole('button',{name:'Account menu',exact:true}).click();
  await page.getByRole('link',{name:'Quick tour',exact:true}).click();
  const tour = page.getByRole('dialog');
  await expect(tour.getByRole('heading',{name:'A quick look around'})).toBeVisible();
  await tour.getByRole('button',{name:'Next',exact:true}).click();
  await expect(tour.getByRole('heading',{name:title!,exact:true})).toBeVisible();
  await expect(tour.locator('[class*=spotlight]')).toBeVisible();
  if (login === 'test_organizer') await page.screenshot({path:'test-results/tour-desktop.png'});
  await tour.getByRole('button',{name:'Back',exact:true}).click();
  await expect(tour.getByRole('heading',{name:'A quick look around'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeFocused();
  await page.reload();
  await expect(page.locator('[data-quick-tour]')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(LANDING[login!]);
});

for (const lang of ['en','ar']) test(`tour fits mobile, traps keyboard focus and remains steady: ${lang}`, async ({page,context,baseURL}) => {
  await context.addCookies([{name:'lang',value:lang,url:baseURL!}]);
  await page.setViewportSize({width:320,height:640});
  await signInAs(page,'test_organizer');
  await page.goto('/dashboard?tour=1');
  const tour=page.getByRole('dialog');
  await expect(tour).toBeVisible();
  const next=()=>tour.getByRole('button',{name:lang==='ar'?'التالي':'Next',exact:true});
  await next().click();
  await expect(tour.locator('[class*=spotlight]')).toBeVisible();
  const before=await tour.locator('[class*=spotlight]').boundingBox();
  for(let i=0;i<8;i++) await page.keyboard.press('Tab');
  expect(await tour.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  expect(await tour.locator('[class*=spotlight]').boundingBox()).toEqual(before);
  const panel=await tour.locator('[class*=panel]').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x+panel!.width).toBeLessThanOrEqual(320);
  expect(panel!.y+panel!.height).toBeLessThanOrEqual(640);
  await page.screenshot({path:`test-results/tour-mobile-${lang}.png`});
  // Finish every step; no extra workflow text or extra form submission is needed.
  for (let i=0;i<4;i++) await next().click();
  await tour.getByRole('button',{name:lang==='ar'?'تمّ':'Done',exact:true}).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(tour).toHaveCount(0);
});

test('new account sees the tour once and preference survives a fresh browser context', async ({page,browser,baseURL}) => {
  const email=`tour-${Date.now()}@example.test`;
  const password='Test-Tour-Long-Password9!';
  await page.goto('/signin?mode=signup');
  await page.locator('input[name=name]').fill('Tour Test');
  await page.locator('input[name=phone]').fill('+9613111222');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button',{name:'Create the account',exact:true}).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Skip',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The suite's own server, not a hard-coded port (3102 is the release harness's).
  const context=await browser.newContext({baseURL:baseURL!});
  try {
    const other=await context.newPage();
    await other.goto('/signin');
    await other.locator('input[name=email]').fill(email);
    await other.locator('input[name=password]').fill(password);
    await other.locator('form:has(input[name=password]) button[type=submit]').click();
    await other.waitForURL('**/dashboard');
    await expect(other.getByRole('dialog')).toHaveCount(0);
  } finally { await context.close(); }
});

test('a missing target falls back to a readable card', async ({page}) => {
  await signInAs(page,'test_organizer');
  await page.goto('/dashboard?tour=1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-service-picker]').evaluate(el=>el.remove());
  await page.getByRole('dialog').getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Start a service',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').locator('[class*=spotlight]')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button',{name:'Skip',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
