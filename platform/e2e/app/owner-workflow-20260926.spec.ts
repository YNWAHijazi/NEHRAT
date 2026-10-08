import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/signin";
import { openDetails } from "../helpers/record";

test("public check is concise and preserves the chosen service through signup", async ({
  page,
}) => {
  await page.goto("/applicability?subject=event");
  // Two steps (partner audit, 8 October 2026): a planned organized event at all, then the criteria.
  await expect(page.locator('[data-region="planned-question"]')).toBeVisible();
  await expect(page.locator("input[type=checkbox]")).toHaveCount(0);
  await page.locator('[data-region="planned-question"]').getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator('[data-region="not-planned"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certification not required", exact: true })).toBeVisible();
  await page.locator('[data-region="planned-question"]').getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.locator("input[type=checkbox]")).toHaveCount(5);
  await page.locator("input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Certification required", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page
    .getByRole("link", { name: "Sign in to certify", exact: true })
    .click();
  await expect(page).toHaveURL(/signin\?next=/);
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .first()
    .click();
  await expect(page.locator("input[name=next]")).toHaveValue("/events/new");
  await expect(page.locator("input[name=phone]")).toBeVisible();
  await page.goto("/applicability?subject=event&checked=1");
  await expect(
    page.getByRole("heading", {
      name: "Certification not required",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/applicability?subject=venue");
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { name: "Hosting venue registration not required", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("link", { name: "Next", exact: true }),
  ).toHaveAttribute("href", "/services/register-a-venue");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/applicability?subject=event");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/moph-public-mobile-sep26.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/moph-public-mobile-ar-sep26.png",
    fullPage: true,
  });
});

test("requirements have no continue links and medical tasks follow the role", async ({
  page,
}) => {
  await signInAs(page, "test_organizer");
  await page.goto("/events/EV-0418");
  await expect(page.locator("[data-region=rail] [data-rail]")).toBeVisible();
  // The plan is one card on the record page; opening it offers no "Continue to" step.
  const plan = page.locator('[data-requirement="B2"]');
  await openDetails(plan);
  await expect(page.getByRole("link", { name: /^Continue to/ })).toHaveCount(0);
  // Level 2: the plan is recommended (D2) and section 12 is the short escalation row, not the eleven items (D3).
  await expect(plan).toHaveAttribute('data-group', 'recommended');
  await expect(plan.locator('[data-plan-section="P12"]')).toBeVisible();
  await expect(plan.locator('[data-major-incident]')).toHaveCount(0);
  await page.goto("/events/EV-0362");
  const medicalPlan=page.locator('[data-requirement="B2"]');
  await openDetails(medicalPlan);
  await expect(medicalPlan).toContainText('The EMS agency or the Medical Director prepares it');
  // The organizer reads the plan; no section of it is theirs to write (catalogue B2 authors).
  await expect(medicalPlan.locator('[data-plan-section]').first()).toBeVisible();
  await expect(medicalPlan.locator('textarea:enabled, input[type=file]')).toHaveCount(0);
  await signInAs(page, "test_ems");
  await page.goto("/events/EV-0362/participation");
  const emsPlan=page.locator('[data-region=ems-record] [data-requirement="B2"]');
  await openDetails(emsPlan);
  const incident=emsPlan.locator('[data-plan-section="P12"]');
  await openDetails(incident);
  await expect(incident.locator('[data-major-incident]').first()).toBeVisible();
  await expect(incident.locator('[data-major-incident="M01"] textarea')).toBeEnabled();
  expect((await page.request.get('/api/documents/EV-0362/plan-document')).status()).toBe(200);
  await signInAs(page, "test_director");
  await page.goto("/events/EV-0362");
  await expect(page.locator('[data-requirement="P-D"]')).toContainText("Medical deployment map");
});

test("organizer sorting, duplicate application, and venue certificate history", async ({
  page,
}) => {
  await signInAs(page, "test_organizer");
  await page.goto("/dashboard");
  await page.locator("select[name=sort]").selectOption("pending");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/sort=pending/);
  await page.goto("/events/EV-0244");
  await page
    .getByRole("button", { name: "Duplicate event", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/EV-\d+\/prepare/);
  const modal = page.locator("dialog[open]");
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("link", { name: "View previous report", exact: true }),
  ).toHaveAttribute("href", "/events/EV-0244/post-event");
  await modal.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.locator("input").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Event name (English)", exact: true }),
  ).toHaveValue("Tripoli Marathon");
  const draftPath = new URL(page.url()).pathname;
  await page
    .getByLabel("Start date", { exact: false })
    .first()
    .fill("2027-08-09");
  await page
    .getByLabel("End date", { exact: false })
    .first()
    .fill("2027-08-09");
  await page
    .getByLabel("Event type", { exact: false })
    .first()
    .selectOption("concert");
  await page
    .getByLabel("Expected participants", { exact: false })
    .first()
    .fill("2000");
  await page
    .getByLabel("Expected spectators", { exact: false })
    .first()
    .fill("100");
  await page
    .getByLabel("Expected staff and volunteers", { exact: false })
    .first()
    .fill("50");
  await page
    .getByLabel("Authorized representative", { exact: false })
    .first()
    .fill("Test organizer");
  await page
    .getByLabel("Position", { exact: false })
    .first()
    .fill("Event manager");
  await page
    .getByRole("button", { name: "Continue to requirements", exact: true })
    .click();
  await expect(page).toHaveURL(draftPath.replace("/prepare", ""));
  await page.goto(draftPath);
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByLabel("Start date", { exact: false }).first(),
  ).toHaveValue("2027-08-09");
  await expect(
    page.getByLabel("Event type", { exact: false }).first(),
  ).toHaveValue("concert");

  // VN-0032 holds a current certificate (VN-0028 and VN-0011 are mid-renewal in the seed).
  // The venue rebuild of 2026-09-30 named the link "Download venue certificate".
  await page.goto("/venues/VN-0032");
  await page
    .getByRole("link", { name: "Download venue certificate", exact: true })
    .click();
  await expect(page.locator("[data-region=certificate]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print or save PDF", exact: true }),
  ).toBeVisible();
});

test("Ministry has service tabs and event search", async ({ page }) => {
  await signInAs(page, "test_moph");
  const services = page.getByRole("navigation", {
    name: "Services",
    exact: true,
  });
  await expect(services.getByRole("link")).toHaveCount(3);
  await page.locator("input[name=q]").fill("EV-0244");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("[data-region=queue]")).toContainText(
    "Tripoli Marathon",
  );
  await expect(page.locator("[data-region=queue]")).not.toContainText(
    "Beirut Coastal",
  );
  await services
    .getByRole("link", { name: "Hosting venues", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hosting venues", exact: true }),
  ).toBeVisible();
  await services.getByRole("link", { name: "Facilities", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Facility oversight", exact: true }),
  ).toBeVisible();
});
