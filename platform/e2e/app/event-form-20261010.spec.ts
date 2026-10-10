/**
 * THE EVENT FORM AFTER A FIRST-TIME USER (owner, 10 October 2026): one attendance figure answers
 * question 1; question 2 follows the event type until the organizer changes it; the Arabic name
 * refuses Latin letters; every question carries a plain line; the counts and boxes are gone.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInAs } from '../helpers/signin';

const question = (page: Page, n: number) => page.locator('h3', { hasText: n === 1 ? 'Maximum simultaneous attendance' : n === 2 ? 'Event activity' : n === 7 ? 'Patient access and extraction' : 'Transport time' }).locator('xpath=ancestor::div[2]');

test('one figure answers question 1, the event type answers question 2, the Arabic name is Arabic', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await signInAs(page, 'test_organizer');
  await page.goto('/events/new');
  await expect(page.locator('h1')).toContainText('Create event');

  // The counts and the two boxes are gone.
  await expect(page.getByText('Expected participants')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'This event has been held before', exact: true })).toHaveCount(0);

  // Question 1 follows the figure; its options cannot be clicked.
  const q1 = question(page, 1);
  await q1.getByLabel('Most people at the same time').fill('15000');
  await expect(q1.locator('button[aria-pressed=true]')).toContainText('10,000 persons or more');
  await expect(q1.locator('button[aria-pressed]').first()).toBeDisabled();
  await q1.getByLabel('Most people at the same time').fill('400');
  await expect(q1.locator('button[aria-pressed=true]')).toContainText('Fewer than 1,000 persons');

  // Question 2 follows the event type, with a note, until the organizer answers it.
  const q2 = question(page, 2);
  await page.getByLabel('Event type', { exact: false }).first().selectOption('running');
  await expect(q2.locator('button[aria-pressed=true]')).toContainText('Organized running event');
  await expect(q2.locator('[data-region=activity-from-type]')).toBeVisible();
  await page.getByLabel('Event type', { exact: false }).first().selectOption('gathering');
  await expect(q2.locator('button[aria-pressed=true]')).toContainText('Conference, meeting');
  await q2.locator('button[aria-pressed]').nth(1).click();
  await expect(q2.locator('[data-region=activity-from-type]')).toHaveCount(0);
  await page.getByLabel('Event type', { exact: false }).first().selectOption('concert');
  await expect(q2.locator('button[aria-pressed=true]')).toContainText('Concert, festival');

  // Plain lines under the questions.
  await expect(question(page, 7).locator('[data-region=domain-lead]')).toContainText('In an emergency, how is a patient reached and carried out to an ambulance?');
  await expect(question(page, 8).locator('[data-region=domain-lead]')).toContainText('how long would an ambulance take to reach the nearest emergency department');

  // The Arabic name refuses Latin letters.
  const ar = page.getByLabel('Event name (Arabic)');
  await ar.fill('Bla bla');
  await expect(page.locator('[data-region=arabic-name-refused]')).toBeVisible();
  await ar.fill('ماراتون بيروت');
  await expect(page.locator('[data-region=arabic-name-refused]')).toHaveCount(0);
});
