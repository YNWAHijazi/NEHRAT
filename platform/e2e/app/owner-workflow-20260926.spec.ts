import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/signin";

test("public check is concise and preserves the chosen service through signup", async ({
  page,
}) => {
  await page.goto("/applicability?subject=event");
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
  await page.getByRole("button", { name: "Yes", exact: true }).click();
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

test("requirements continue opens the next document and medical tasks follow the role", async ({
  page,
}) => {
  await signInAs(page, "test_organizer");
  await page.goto("/events/EV-0418");
  await expect(page.locator("[data-region=rail] [data-rail]")).toBeVisible();
  await page.goto("/events/EV-0418/requirements");
  const first = page.locator("[data-document=plan]");
  if ((await first.getAttribute("open")) === null)
    await first.locator("summary").click();
  await first
    .getByRole("link", {
      name: "Continue to Event site or route map",
      exact: true,
    })
    .click();
  await expect(page.locator("#requirement-siteMap")).toHaveAttribute(
    "open",
    "",
  );
  await page.goto("/events/EV-0418/plan");
  await expect(page.locator("[data-region=major-incident]")).toHaveCount(0);
  await expect(
    page.getByText(
      "I have read the recommendation to prepare for a major incident. This is optional for Level 2.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/events/EV-0362/plan");
  await page
    .getByRole("button", { name: /^12 / })
    .and(page.locator("[aria-expanded]"))
    .click();
  const section = page.getByRole("textbox", { name: /^12\./ });
  if (await section.count())
    await expect(section).toHaveAttribute("readonly", "");
  await expect(
    page.locator("[data-region=major-incident] button").first(),
  ).toBeDisabled();
  await signInAs(page, "test_ems");
  await page.goto("/events/EV-0362/plan");
  await expect(
    page.locator("[data-region=major-incident] button").first(),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", {
      name: "Major-incident arrangements",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^1\./ })).toHaveCount(0);
  await expect(page.locator("[data-region=versions]")).toHaveCount(0);
  expect(
    (await page.request.get("/api/documents/EV-0362/plan-document")).status(),
  ).toBe(404);
  await signInAs(page, "test_director");
  await page.goto("/events/EV-0362");
  await expect(
    page.getByRole("heading", { name: "Medical deployment map", exact: true }),
  ).toBeVisible();
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
  await expect(page).toHaveURL(draftPath.replace("/prepare", "/requirements"));
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

  await page.goto("/dashboard");
  const venue = page.locator('a[href^="/venues/VN-"]').first();
  await venue.click();
  await page
    .getByRole("link", { name: "Download certificate", exact: true })
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
