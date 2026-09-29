import { test, expect } from '@playwright/test';
import { signInAs } from '../helpers/signin';
import { useLanguage } from '../helpers/language';

test('reviewer sees who supplied the answers, declarations and relevant Level 3 checks', async ({page}) => {
  await signInAs(page,'test_moph');
  await page.goto('/ministry/submissions/EV-0362');
  const summary=page.locator('[data-region=review-file-summary]');
  await expect(summary.getByRole('heading',{name:'Application at a glance'})).toBeVisible();
  await summary.locator('[data-region=review-document-checklist] > summary').click();
  await expect(summary.locator('[data-review-document=plan]')).toContainText('Required');
  await summary.locator('[data-region=review-organizer-declarations] > summary').click();
  await expect(summary.locator('[data-region=review-organizer-declarations]')).toContainText('Confirmed by organizer');
  const agency=page.locator('[data-review-party=ems]').first();
  await agency.locator('summary').click();
  await expect(agency.locator('[data-region=review-agency-declaration]')).toContainText('Signed');
  await expect(agency).toContainText('Confirmed by agency');
  const arrangements=page.locator('[data-region=review-director-arrangements]');
  await arrangements.locator('summary').click();
  await expect(arrangements).toContainText('All medical teams practise under the clinical protocols');
  const plan=page.locator('[data-region=review-plan]');
  await expect(plan).toContainText('Required — completed by the Medical Director or EMS agency.');
  await expect(plan).toContainText('Major-incident and mass-casualty plan');
  await expect(plan).toContainText('Latest saved plan');
  await expect(plan.locator('textarea,input')).toHaveCount(0);
  await page.screenshot({path:'test-results/reviewer-workflow-desktop.png',fullPage:true});
});

test('Level 2 review does not invent a mandatory plan or mass-casualty checklist', async ({page}) => {
  await signInAs(page,'test_moph');
  await page.goto('/ministry/submissions/EV-0455');
  await expect(page.locator('[data-region=review-header]')).toBeVisible();
  const plan=page.locator('[data-region=review-plan]');
  await expect(plan).toContainText('Recommended — not required to submit.');
  await expect(plan).not.toContainText('Major-incident and mass-casualty plan');
  await expect(plan).not.toContainText('Major-incident / mass-casualty preparedness');
  await page.locator('[data-region=review-document-checklist] > summary').click();
  await expect(page.locator('[data-review-document=plan]')).toContainText('Recommended');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/reviewer-workflow-mobile.png',fullPage:true});
});

test('EMS shares useful multiline answers; the organizer sees them under the agency', async ({page,browser,baseURL}) => {
  await signInAs(page,'test_ems');
  await page.goto('/events/EV-0418/participation');
  await expect(page.locator('[data-region=medical-plan-task]')).toContainText('Recommended — not required to submit');
  const teams='Two BLS teams.\nNorth gate and finish line, 08:00–14:00.';
  await page.locator('textarea[name=teams]').fill(teams);
  await page.locator('textarea[name=communications]').fill('Radio channel 2. Backup: operational lead telephone.');
  await page.getByRole('button',{name:'Share with organizer',exact:true}).click();
  await expect(page.getByText('Your arrangements have been shared with the organizer.',{exact:true})).toBeVisible();
  const organizer=await browser.newPage({baseURL:baseURL!});
  await signInAs(organizer,'test_organizer');
  await organizer.goto('/events/EV-0418/medical-team?tab=ems');
  await expect(organizer.locator('[data-region=medical-team-party]').first()).toContainText('North gate and finish line');
  await expect(organizer.locator('main textarea')).toHaveCount(0);
  await organizer.close();
});

test('Arabic review preserves the same plan rules and fits a phone', async ({page,context}) => {
  await signInAs(page,'test_moph');
  await useLanguage(context,'ar');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/ministry/submissions/EV-0455');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('[data-region=review-plan-requirement]')).toContainText('ليست شرطاً للتقديم');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/reviewer-workflow-arabic.png',fullPage:true});
});
