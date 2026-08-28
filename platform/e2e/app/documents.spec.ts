/**
 * The Ministry sees DOCUMENTS, not names.
 *
 * The reviewer ruling of 2026-08-28 settled the deferred storage decision: the
 * platform stores the file. These walk the consequence -- a reviewer opens the
 * route map and gets a PDF; nobody who should not have it gets anything at all.
 *
 * The refusal assertions are the important half. A document route that is merely
 * "not linked from the wrong screen" is not protected; it has to answer 404 to a
 * direct request, which is what these check.
 */

import { test, expect } from '@playwright/test';
import { gotoRidingRestarts } from '../helpers/resilient';
import { signInAs } from '../helpers/signin';


/** EV-0362 is the filed Level 3 demonstration submission; both maps are seeded on it. */
const DOC = '/api/documents/EV-0362/siteMap';
const PLAN = '/api/documents/EV-0362/plan-document';

test.describe('the Ministry opens the file', () => {
  test('a reviewer gets the site map itself, as a PDF, sandboxed', async ({ page }) => {
    await signInAs(page, 'test_moph');
    const response = await page.request.get(DOC);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');

    // Serving organizer-supplied bytes inline on our own origin is the one place a
    // reviewer's browser parses somebody else's file. Both defences must be present.
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['content-security-policy']).toContain('sandbox');
    // A regulatory document is never a cacheable public asset.
    expect(response.headers()['cache-control']).toContain('no-store');

    const body = await response.body();
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(100);
  });

  test('the attached plan opens too -- it was a bare file name for a whole slice', async ({ page }) => {
    await signInAs(page, 'test_moph');
    const response = await page.request.get(PLAN);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('the review screen offers the reviewer a way to open each one', async ({ page }) => {
    await signInAs(page, 'test_moph');
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const panel = page.locator('[data-region="review-attachments"]');
    await expect(panel).toBeVisible();
    // Not "a link exists somewhere" -- a viewer per attached document. EV-0362 is a
    // Level 3 record and carries the site map, the deployment map and the evidence of
    // insurance, which became an attachment when it stopped being a text box.
    await expect(panel.locator('[data-region="doc-viewer"]')).toHaveCount(3);
    await expect(panel.locator(`a[href="${DOC}"]`).first()).toHaveAttribute('href', DOC);
  });

  test('the reviewer reads every assessment answer, not only the level they produced', async ({ page }) => {
    await signInAs(page, 'test_moph');
    // EV-0362 is the Level 3 demonstration submission and now carries the answers
    // behind its level. A demonstration reviewer sees only demonstration rows, so a
    // real filing is the wrong target here -- the isolation is doing its job.
    await gotoRidingRestarts(page, '/ministry/submissions/EV-0362');
    const panel = page.locator('[data-region="assessment-answers"]');
    await expect(panel).toBeVisible();
    // Nine domains, and the structured inputs the minimum conditions derive from.
    await expect(panel).toContainText('Assessment answers');
    await expect(panel).toContainText('Structured inputs');
    // Nine domains, each with the option the organizer chose. Not a summary.
    await expect(panel).toContainText('Highest expected simultaneous attendance');
    await expect(panel).toContainText('18000');
  });
});

test.describe('and nobody else does', () => {
  test('a signed-out request gets nothing -- not a 403 that confirms it exists', async ({ page }) => {
    const response = await page.request.get(DOC);
    expect(response.status()).toBe(404);
  });

  test('an organizer cannot read another organizer\'s document', async ({ page }) => {
    // test_organizer owns EV-0418; EV-0362 belongs to the same demonstration
    // organizer, so the case that matters is the SECOND organizer's event.
    await signInAs(page, 'test_organizer');
    const response = await page.request.get('/api/documents/EV-0455/siteMap');
    expect(response.status()).toBe(404);
  });

  test('a first-response unit holds no submission-reading power and gets 404', async ({ page }) => {
    await signInAs(page, 'test_response');
    const response = await page.request.get(DOC);
    expect(response.status()).toBe(404);
  });

  test('a document key with no stored file answers 404, never a broken stream', async ({ page }) => {
    await signInAs(page, 'test_moph');
    const response = await page.request.get('/api/documents/EV-0362/insuranceCertificate');
    expect(response.status()).toBe(404);
  });

  test('an unknown event answers the same 404 as a forbidden one', async ({ page }) => {
    await signInAs(page, 'test_moph');
    expect((await page.request.get('/api/documents/EV-9999/siteMap')).status()).toBe(404);
  });
});
