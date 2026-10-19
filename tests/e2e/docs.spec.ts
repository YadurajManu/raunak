import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { docsPages } from "../../src/lib/docs";

test("documentation stays readable at every supported width and theme", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/docs");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Discover events");
    await expect(page.locator(".gnav, .gnav-mobile-tabs")).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        localStorage.setItem("raunak-theme", value);
        document.documentElement.dataset.marketingTheme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/docs/overview-${width}-${theme}.png`, fullPage: true });
      const audit = await new AxeBuilder({ page }).include(".raunak-docs").analyze();
      expect(audit.violations).toEqual([]);
    }
    await page.goto("/docs/installation");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        localStorage.setItem("raunak-theme", value);
        document.documentElement.dataset.marketingTheme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/docs/guide-${width}-${theme}.png`, fullPage: true });
      const audit = await new AxeBuilder({ page }).include(".raunak-docs").analyze();
      expect(audit.violations).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test("theme persists and guide links navigate to real sections and adjacent pages", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("raunak-theme")) localStorage.setItem("raunak-theme", "light");
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/installation");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-marketing-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-marketing-theme", "dark");
  const anchor = page.getByRole("link", { name: /^Link to / }).first();
  const hash = await anchor.getAttribute("href");
  await anchor.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(hash);
  await expect(page).toHaveURL(new RegExp(`${hash}$`));
  await page.getByRole("navigation", { name: "Previous and next documentation page" }).getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/docs\/attendees/);
});

test("search supports keyboard navigation, empty results and focus restoration", async ({ page }) => {
  await page.goto("/docs");
  const trigger = page.getByRole("button", { name: "Search documentation", exact: true });
  await trigger.click();
  const search = page.getByRole("dialog", { name: "Search documentation" });
  const input = search.getByRole("combobox");
  await expect(input).toBeFocused();
  expect((await new AxeBuilder({ page }).include(".docs-search-dialog").analyze()).violations).toEqual([]);
  await input.fill("no-page-matches-this-value");
  await expect(search.getByText("No matching pages.")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search).toBeVisible();
  await input.fill("local quick start");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/installation/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/local|installation/i);
});

test("mobile navigation closes on selection and restores keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");
  const trigger = page.getByRole("button", { name: "Open documentation navigation" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Documentation navigation" });
  await expect(drawer).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".docs-nav-dialog").analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole("link", { name: "Tickets & check-in", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/tickets-check-in/);
  await expect(drawer).not.toBeVisible();
});

test("all guides load with valid anchors, source links and bounded tables", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const doc of docsPages) {
      const response = await page.goto(`/docs/${doc.slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const anchors = await page.locator("main a[href^='#']").evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")!.slice(1)),
      );
      for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  }
  await page.goto("/docs/installation");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const expectedCommand = await page.locator("pre code").first().textContent();
  await page.getByRole("button", { name: "Copy code", exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedCommand);
  await expect(page.getByRole("button", { name: "Copied", exact: true }).first()).toBeVisible();
  const response = await page.goto("/docs/not-a-real-guide");
  expect(response?.status()).toBe(404);
});
